// Tout se passe sur une seule page (hub) :
//  - une petite carte avec des lieux cliquables (accès libre)
//  - l'inventaire (soigner / booster ses AM)
//  - la fiche détaillée d'un AM (+ soin progressif en attendant)
//  - au clic d'un lieu : aperçu du combat, choix de l'AM, soin éventuel, puis combat
// Les montées de niveau augmentent les stats automatiquement (aucun choix).

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import CombatView from "./renderer/CombatView";
import {
  SPECIES,
  STARTERS,
  RARE_REWARD,
  MAP_LOCATIONS,
  POTION_HEAL,
  FULL_HEAL_COST,
  BOOST_COST,
  BOOST_AMOUNT,
  type MapLocation,
} from "./engine/data";
import { runCombat } from "./engine/combat";
import {
  makeCharacter,
  makeEnemy,
  addXp,
  xpForNext,
  currentLife,
  isHealing,
  isFull,
  startHeal,
  commitHeal,
  healEtaMs,
  boostStat,
} from "./engine/progression";
import { TALENTS, talentName } from "./engine/talents";
import type { Character, CombatResult, Stats, StatKey } from "./engine/types";
import { freshState, GameState, isLocationCleared, allCleared } from "./state";
import "./game.css";

type CombatCtx = { loc: MapLocation; result: CombatResult; charId: string; enemy: Character };
type Outcome = "win" | "lose" | "draw";
type RewardData = {
  outcome: Outcome;
  loc: MapLocation;
  pStat: any;
  firstClear: boolean;
  levelsGained: number;
};
type Modal =
  | { k: "none" }
  | { k: "inventory" }
  | { k: "location"; locId: string; pick: string }
  | { k: "sheet"; charId: string }
  | { k: "combat"; ctx: CombatCtx }
  | { k: "reward"; reward: RewardData }
  | { k: "capture" };

const STAT_LABELS: Record<StatKey, string> = {
  hp: "❤️ PV",
  atk: "⚔️ ATK",
  def: "🛡️ DEF",
  spd: "💨 VIT",
  sta: "⚡ STA",
};

export default function GamePage() {
  const { logout, user } = useAuth();
  const [gs, setGs] = useState<GameState>(freshState());
  const [loaded, setLoaded] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState<Modal>({ k: "none" });
  const [, setTick] = useState(0);

  // chargement initial
  useEffect(() => {
    (async () => {
      try {
        const { state } = await api.getGameState<GameState>();
        if (state && state.started) setGs(state);
        else setAdopting(true);
      } catch {
        setAdopting(true);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // tick temps réel tant qu'un AM se soigne (+ commit auto quand plein)
  useEffect(() => {
    const anyHealing = gs.team.some((c) => c.healStart != null);
    if (!anyHealing) return;
    const id = window.setInterval(() => {
      setGs((prev) => {
        let changed = false;
        const team = prev.team.map((c) => {
          if (c.healStart != null && currentLife(c) >= c.stats.hp) {
            changed = true;
            return { ...c, life: c.stats.hp, healStart: null };
          }
          return c;
        });
        if (changed) {
          const next = { ...prev, team };
          api.saveGameState(next).catch(() => {});
          return next;
        }
        return prev;
      });
      setTick((t) => t + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [gs]);

  async function persist(next: GameState) {
    setGs(next);
    try {
      await api.saveGameState(next);
    } catch {
      /* hors-ligne : l'état reste en mémoire */
    }
  }

  const setChar = (charId: string, fn: (c: Character) => Character) =>
    persist({ ...gs, team: gs.team.map((c) => (c.id === charId ? fn(c) : c)) });

  // ── Adoption ──────────────────────────────────────────────────────────────
  function adopt(speciesId: string) {
    const c = makeCharacter(speciesId);
    setAdopting(false);
    persist({ ...freshState(), started: true, team: [c], gold: 30, potions: 1 });
  }

  // ── Soins ───────────────────────────────────────────────────────────────
  const toggleHeal = (charId: string) =>
    setChar(charId, (c) => (c.healStart != null ? commitHeal(c) : startHeal(c)));

  function healPotion(charId: string) {
    if (gs.potions <= 0) return;
    const c = gs.team.find((x) => x.id === charId);
    if (!c || isFull(c)) return;
    persist({
      ...gs,
      potions: gs.potions - 1,
      team: gs.team.map((x) =>
        x.id === charId
          ? { ...x, healStart: null, life: Math.min(x.stats.hp, Math.round(currentLife(x) + x.stats.hp * POTION_HEAL)) }
          : x
      ),
    });
  }
  function healFullPaid(charId: string) {
    const c = gs.team.find((x) => x.id === charId);
    if (!c || gs.gold < FULL_HEAL_COST || isFull(c)) return;
    persist({
      ...gs,
      gold: gs.gold - FULL_HEAL_COST,
      team: gs.team.map((x) => (x.id === charId ? { ...x, life: x.stats.hp, healStart: null } : x)),
    });
  }

  // ── Boost de stat (payant) ───────────────────────────────────────────────
  function boost(charId: string, stat: StatKey) {
    if (gs.gold < BOOST_COST) return;
    persist({
      ...gs,
      gold: gs.gold - BOOST_COST,
      team: gs.team.map((x) => (x.id === charId ? boostStat(x, stat) : x)),
    });
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  function openLocation(loc: MapLocation) {
    const alive = gs.team.find((c) => currentLife(c) > 0) ?? gs.team[0];
    setModal({ k: "location", locId: loc.id, pick: alive?.id ?? "" });
  }

  function startCombat(loc: MapLocation, charId: string) {
    const base = gs.team.find((c) => c.id === charId);
    if (!base) return;
    const player = commitHeal(base);
    if (player.life <= 0) return;
    // on fige le soin dans l'état persistant
    persist({ ...gs, team: gs.team.map((c) => (c.id === charId ? player : c)) });

    const enemy = makeEnemy(loc);
    if (loc.isBoss && gs.bossLife[loc.id] != null) enemy.life = gs.bossLife[loc.id];
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const result = runCombat({
      seed,
      teamA: [{ ...player }],
      teamB: [enemy],
      rules: loc.maxTurns ? { maxTurns: loc.maxTurns } : undefined,
    });
    setModal({ k: "combat", ctx: { loc, result, charId, enemy } });
  }

  function onCombatFinish(winner: 0 | 1 | null) {
    if (modal.k !== "combat") return;
    const { loc, result, charId } = modal.ctx;
    const pStat = result.stats.find((s) => s.side === 0)!;
    const eStat = result.stats.find((s) => s.side === 1)!;
    const outcome: Outcome = winner === 0 ? "win" : winner === 1 ? "lose" : "draw";

    let team = gs.team.map((c) => ({ ...c }));
    const idx = team.findIndex((c) => c.id === charId);
    team[idx].life = Math.max(0, pStat.lifeLeft);
    team[idx].healStart = null;

    // PV du boss persistés (on grignote sur plusieurs parties)
    const bossLife = { ...gs.bossLife };
    if (loc.isBoss) bossLife[loc.id] = Math.max(0, eStat.lifeLeft);
    const bossDefeated = loc.isBoss && bossLife[loc.id] === 0;

    if (outcome === "win" || bossDefeated) {
      const firstClear = !isLocationCleared(gs, loc.id);
      let gold = gs.gold;
      let potions = gs.potions;
      let levelsGained = 0;
      if (firstClear) {
        gold += loc.gold;
        potions += loc.potions;
        const xpRes = addXp(team[idx], loc.xp);
        team[idx] = xpRes.character;
        levelsGained = xpRes.levelsGained;
      } else {
        // farm : moitié de l'or, pas de potion, XP réduite
        gold += Math.round(loc.gold / 2);
        const xpRes = addXp(team[idx], Math.round(loc.xp / 2));
        team[idx] = xpRes.character;
        levelsGained = xpRes.levelsGained;
      }
      const cleared = firstClear ? [...gs.cleared, loc.id] : gs.cleared;
      if (loc.isBoss) delete bossLife[loc.id];
      persist({ ...gs, team, gold, potions, cleared, bossLife });
      setModal({ k: "reward", reward: { outcome: "win", loc, pStat, firstClear, levelsGained } });
    } else {
      let gold = gs.gold;
      if (outcome === "lose") {
        gold = Math.floor(gs.gold * 0.9); // pénalité légère
        if (team[idx].life <= 0) team[idx].life = Math.max(1, Math.round(team[idx].stats.hp * 0.3));
      }
      persist({ ...gs, team, gold, bossLife });
      setModal({ k: "reward", reward: { outcome, loc, pStat, firstClear: false, levelsGained: 0 } });
    }
  }

  function closeReward() {
    if (modal.k !== "reward") return;
    const r = modal.reward;
    const wonBoss = r.loc.isBoss && r.outcome === "win" && r.firstClear;
    if (wonBoss && !gs.capturedRare) setModal({ k: "capture" });
    else setModal({ k: "none" });
  }

  function captureRare() {
    const rare = makeCharacter(RARE_REWARD);
    persist({ ...gs, team: [...gs.team, rare], capturedRare: true });
    setModal({ k: "none" });
  }

  async function resetGame() {
    try {
      await api.resetGameState();
    } catch {
      /* ignore */
    }
    setGs(freshState());
    setModal({ k: "none" });
    setAdopting(true);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (!loaded) return <div className="game-shell"><div className="center pad">Chargement…</div></div>;

  return (
    <div className="game-shell">
      <header className="game-top">
        <div className="brand">⚔️ AutoMonster</div>
        <div className="top-right">
          {gs.started && (
            <>
              <span className="purse">💰 {gs.gold} &nbsp;·&nbsp; 🧪 {gs.potions}</span>
              <button className="ghost" onClick={() => setModal({ k: "inventory" })}>🎒 Inventaire</button>
            </>
          )}
          <button className="ghost" onClick={() => logout()}>{user?.displayName || "Déconnexion"} ⏻</button>
        </div>
      </header>

      {adopting ? (
        <Adoption onPick={adopt} />
      ) : (
        <Hub gs={gs} onOpenLocation={openLocation} onOpenSheet={(id) => setModal({ k: "sheet", charId: id })} onToggleHeal={toggleHeal} />
      )}

      {modal.k === "location" && (() => {
        const loc = MAP_LOCATIONS.find((l) => l.id === modal.locId)!;
        return (
          <LocationModal
            gs={gs}
            loc={loc}
            pick={modal.pick}
            onPick={(id) => setModal({ ...modal, pick: id })}
            onToggleHeal={toggleHeal}
            onPotion={healPotion}
            onFull={healFullPaid}
            onFight={() => startCombat(loc, modal.pick)}
            onClose={() => setModal({ k: "none" })}
          />
        );
      })()}

      {modal.k === "inventory" && (
        <InventoryModal
          gs={gs}
          onToggleHeal={toggleHeal}
          onPotion={healPotion}
          onFull={healFullPaid}
          onBoost={boost}
          onSheet={(id) => setModal({ k: "sheet", charId: id })}
          onClose={() => setModal({ k: "none" })}
        />
      )}

      {modal.k === "sheet" && (() => {
        const c = gs.team.find((x) => x.id === modal.charId);
        if (!c) return null;
        return (
          <SheetModal
            c={c}
            gold={gs.gold}
            potions={gs.potions}
            onToggleHeal={toggleHeal}
            onPotion={healPotion}
            onFull={healFullPaid}
            onBoost={boost}
            onClose={() => setModal({ k: "none" })}
          />
        );
      })()}

      {modal.k === "combat" && (
        <div className="overlay">
          <div className="combat-wrap">
            <div className="combat-head">
              <span>{modal.ctx.loc.name}</span>
              <div className="speedctl">
                {[1, 2, 4].map((sp) => (
                  <button key={sp} className={speed === sp ? "on" : ""} onClick={() => setSpeed(sp)}>×{sp}</button>
                ))}
              </div>
            </div>
            <CombatView log={modal.ctx.result.log} speed={speed} onFinish={onCombatFinish} />
          </div>
        </div>
      )}

      {modal.k === "reward" && <RewardModal reward={modal.reward} onContinue={closeReward} />}
      {modal.k === "capture" && <CaptureModal onCapture={captureRare} />}

      {gs.started && allCleared(gs) && !adopting && modal.k === "none" && (
        <div className="cleared-banner">
          🏆 Zone entièrement nettoyée ! <button className="ghost sm" onClick={resetGame}>Recommencer</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Composants partagés
// ═══════════════════════════════════════════════════════════════════════════

function StatRow({ stats }: { stats: Stats }) {
  return (
    <div className="statgrid">
      <span>❤️ {stats.hp}</span>
      <span>⚔️ {stats.atk}</span>
      <span>🛡️ {stats.def}</span>
      <span>💨 {stats.spd}</span>
      <span>⚡ {stats.sta}</span>
    </div>
  );
}

function HpBar({ c }: { c: Character }) {
  const life = currentLife(c);
  const pct = Math.round((life / c.stats.hp) * 100);
  const healing = isHealing(c);
  return (
    <div className="hpline">
      <div className={`hpbar sm ${healing ? "healing" : ""}`}>
        <div className="hpbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="hp-num sm">{Math.round(life)}/{c.stats.hp}{healing ? " 💚" : ""}</span>
    </div>
  );
}

function HealControls({
  c,
  gold,
  potions,
  onToggleHeal,
  onPotion,
  onFull,
}: {
  c: Character;
  gold: number;
  potions: number;
  onToggleHeal: (id: string) => void;
  onPotion: (id: string) => void;
  onFull: (id: string) => void;
}) {
  const full = isFull(c);
  const healing = isHealing(c);
  const eta = healing ? Math.ceil(healEtaMs(c) / 1000) : 0;
  return (
    <div className="heal-row">
      <button disabled={full} onClick={() => onToggleHeal(c.id)}>
        {healing ? `⏸️ Stopper (${eta}s)` : "💚 Soin progressif"}
      </button>
      <button disabled={potions <= 0 || full} onClick={() => onPotion(c.id)}>🧪 Potion ({potions})</button>
      <button disabled={gold < FULL_HEAL_COST || full} onClick={() => onFull(c.id)}>💰 Soin complet ({FULL_HEAL_COST})</button>
    </div>
  );
}

function TalentChips({ c }: { c: Character }) {
  const sp = SPECIES[c.speciesId];
  const ids = [sp.innate, ...c.talents].filter(Boolean) as string[];
  if (ids.length === 0) return null;
  return (
    <div className="talents-line">
      {ids.map((t) => (
        <span key={t} className="talent-mini" title={TALENTS[t]?.desc}>{talentName(t)}</span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════════════════

function Adoption({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="screen adoption">
      <h1>Choisis ton premier Auto Monster</h1>
      <p className="muted">Ce compagnon se battra automatiquement. Chaque espèce a un talent inné.</p>
      <div className="cards3">
        {STARTERS.map((id) => {
          const sp = SPECIES[id];
          const c = makeCharacter(id);
          return (
            <div key={id} className="amcard pick" onClick={() => onPick(id)}>
              <div className="amcard-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}33, transparent 70%)` }}>
                <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
              </div>
              <h3>{sp.name}</h3>
              <StatRow stats={c.stats} />
              {sp.innate && (
                <div className="talent-chip">✨ {talentName(sp.innate)} — <span className="muted">{TALENTS[sp.innate]?.desc}</span></div>
              )}
              <button className="primary">Adopter</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hub({
  gs,
  onOpenLocation,
  onOpenSheet,
  onToggleHeal,
}: {
  gs: GameState;
  onOpenLocation: (loc: MapLocation) => void;
  onOpenSheet: (id: string) => void;
  onToggleHeal: (id: string) => void;
}) {
  return (
    <div className="hub">
      <div className="map-board">
        <h3 className="map-title">🗺️ Carte — choisis un lieu</h3>
        <div className="map-canvas">
          <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
            {MAP_LOCATIONS.slice(1).map((l, i) => {
              const p = MAP_LOCATIONS[i];
              return <line key={l.id} x1={p.x} y1={p.y} x2={l.x} y2={l.y} />;
            })}
          </svg>
          {MAP_LOCATIONS.map((l) => {
            const cleared = isLocationCleared(gs, l.id);
            return (
              <button
                key={l.id}
                className={`map-loc ${cleared ? "done" : ""} ${l.isBoss ? "boss" : ""}`}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
                onClick={() => onOpenLocation(l)}
                title={l.name}
              >
                <span className="loc-dot">{cleared ? "✓" : l.isBoss ? "☠" : ""}</span>
                <span className="loc-name">{l.name}</span>
                <span className="loc-lvl">N.{l.recommendedLevel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="team-strip">
        {gs.team.map((c) => {
          const sp = SPECIES[c.speciesId];
          return (
            <div key={c.id} className="team-mini" onClick={() => onOpenSheet(c.id)}>
              <img src={`/sprites/${sp.gfx}.png`} alt={c.name} />
              <div className="team-mini-meta">
                <div className="team-name">
                  {c.name} <span className="lvl">N.{c.level}</span>
                  {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
                </div>
                <HpBar c={c} />
              </div>
              <button
                className="ghost sm heal-quick"
                onClick={(e) => { e.stopPropagation(); onToggleHeal(c.id); }}
                disabled={isFull(c)}
              >
                {isHealing(c) ? "⏸️" : "💚"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function LocationModal({
  gs,
  loc,
  pick,
  onPick,
  onToggleHeal,
  onPotion,
  onFull,
  onFight,
  onClose,
}: {
  gs: GameState;
  loc: MapLocation;
  pick: string;
  onPick: (id: string) => void;
  onToggleHeal: (id: string) => void;
  onPotion: (id: string) => void;
  onFull: (id: string) => void;
  onFight: () => void;
  onClose: () => void;
}) {
  const sp = SPECIES[loc.enemySpecies];
  const chosen = gs.team.find((c) => c.id === pick);
  const ko = chosen ? currentLife(chosen) <= 0 : true;
  const cleared = isLocationCleared(gs, loc.id);

  return (
    <ModalShell title={loc.name} onClose={onClose} wide>
      <p className="muted blurb">{loc.blurb}</p>
      <div className="enemy-preview">
        <img src={`/sprites/${sp.gfx}.png`} alt="ennemi" style={{ transform: `scale(${sp.size / 100})` }} />
        <div>
          <div className="enemy-name">
            {sp.name} <span className="lvl">N.{loc.enemyLevel}</span>
            {loc.isBoss && <span className="boss-tag">BOSS</span>}
          </div>
          {loc.isBoss && gs.bossLife[loc.id] != null && (
            <div className="boss-chip">PV restants du boss : {gs.bossLife[loc.id]}</div>
          )}
          <div className="loot-line">
            Butin{cleared ? " (déjà nettoyé : récompense réduite)" : ""} : 💰 {cleared ? Math.round(loc.gold / 2) : loc.gold}
            {!cleared && ` · 🧪 ${loc.potions}`} · ⭐ {cleared ? Math.round(loc.xp / 2) : loc.xp} XP
          </div>
        </div>
      </div>

      <h4 className="pick-title">Choisis ton AM</h4>
      <div className="pick-list">
        {gs.team.map((c) => {
          const spc = SPECIES[c.speciesId];
          return (
            <div key={c.id} className={`pick-row ${c.id === pick ? "active" : ""}`} onClick={() => onPick(c.id)}>
              <img className="mini" src={`/sprites/${spc.gfx}.png`} alt={c.name} />
              <div className="pick-meta">
                <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span></div>
                <HpBar c={c} />
              </div>
              {c.id === pick && <span className="active-tag">choisi</span>}
            </div>
          );
        })}
      </div>

      {chosen && (
        <>
          {currentLife(chosen) < chosen.stats.hp && (
            <HealControls c={chosen} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
          )}
          {loc.isBoss && <p className="hint">⚠️ Coriace. S'il s'éternise → égalité, mais les PV du boss sont conservés.</p>}
          {ko ? (
            <p className="warn">Cet AM est K.O. — soigne-le ou choisis-en un autre.</p>
          ) : (
            <button className="primary big" onClick={onFight}>⚔️ Combattre</button>
          )}
        </>
      )}
    </ModalShell>
  );
}

function InventoryModal({
  gs,
  onToggleHeal,
  onPotion,
  onFull,
  onBoost,
  onSheet,
  onClose,
}: {
  gs: GameState;
  onToggleHeal: (id: string) => void;
  onPotion: (id: string) => void;
  onFull: (id: string) => void;
  onBoost: (id: string, stat: StatKey) => void;
  onSheet: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="🎒 Inventaire" onClose={onClose} wide>
      <p className="muted">Soigne et booste tes Auto Monsters. (💰 {gs.gold})</p>
      {gs.team.map((c) => {
        const sp = SPECIES[c.speciesId];
        return (
          <div key={c.id} className="inv-card">
            <div className="inv-head" onClick={() => onSheet(c.id)}>
              <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={c.name} />
              <div className="inv-meta">
                <div className="team-name">
                  {c.name} <span className="lvl">N.{c.level}</span>
                  {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
                </div>
                <HpBar c={c} />
                <StatRow stats={c.stats} />
              </div>
            </div>
            <HealControls c={c} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
            <div className="boost-row">
              <span className="boost-label">Booster ({BOOST_COST}💰) :</span>
              {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
                <button key={k} className="boost-btn" disabled={gs.gold < BOOST_COST} onClick={() => onBoost(c.id, k)} title={`+${BOOST_AMOUNT[k]}`}>
                  {STAT_LABELS[k]} +{BOOST_AMOUNT[k]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}

function SheetModal({
  c,
  gold,
  potions,
  onToggleHeal,
  onPotion,
  onFull,
  onBoost,
  onClose,
}: {
  c: Character;
  gold: number;
  potions: number;
  onToggleHeal: (id: string) => void;
  onPotion: (id: string) => void;
  onFull: (id: string) => void;
  onBoost: (id: string, stat: StatKey) => void;
  onClose: () => void;
}) {
  const sp = SPECIES[c.speciesId];
  const xpNext = xpForNext(c.level);
  return (
    <ModalShell title={`Fiche — ${c.name}`} onClose={onClose}>
      <div className="sheet-top">
        <div className="amcard-art sheet-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}44, transparent 70%)` }}>
          <img src={`/sprites/${sp.gfx}.png`} alt={c.name} />
        </div>
        <div className="sheet-side">
          <div className="team-name big">
            {c.name} <span className="lvl">N.{c.level}</span>
            {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
          </div>
          <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
          <HpBar c={c} />
          <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
          <div className="muted small">XP {c.xp}/{xpNext}</div>
        </div>
      </div>

      <div className="sheet-stats">
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <div key={k} className="sheet-stat">
            <span>{STAT_LABELS[k]}</span>
            <strong>{c.stats[k]}</strong>
          </div>
        ))}
      </div>

      <TalentChips c={c} />

      <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
      <div className="boost-row">
        <span className="boost-label">Booster ({BOOST_COST}💰) :</span>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <button key={k} className="boost-btn" disabled={gold < BOOST_COST} onClick={() => onBoost(c.id, k)}>
            {STAT_LABELS[k]} +{BOOST_AMOUNT[k]}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function RewardModal({ reward, onContinue }: { reward: RewardData; onContinue: () => void }) {
  const { outcome, loc, pStat, firstClear, levelsGained } = reward;
  const title = outcome === "win" ? "🎉 Victoire !" : outcome === "draw" ? "⏳ Égalité" : "💀 Défaite";
  return (
    <div className="overlay">
      <div className="modal center">
        <h1>{title}</h1>
        {outcome === "win" && (
          <div className="loot-box">
            <p>
              + 💰 {firstClear ? loc.gold : Math.round(loc.gold / 2)} or
              {firstClear && ` · 🧪 ${loc.potions} potion(s)`}
              {` · ⭐ ${firstClear ? loc.xp : Math.round(loc.xp / 2)} XP`}
            </p>
            {levelsGained > 0 && <p className="muted">🆙 +{levelsGained} niveau(x) — stats augmentées automatiquement.</p>}
            {!firstClear && <p className="muted small">Lieu déjà nettoyé : récompense réduite.</p>}
          </div>
        )}
        {outcome === "draw" && loc.isBoss && <p className="muted">Le boss est entamé — ses PV sont conservés. Soigne-toi et retente !</p>}
        {outcome === "draw" && !loc.isBoss && <p className="muted">Match nul. Réessaie.</p>}
        {outcome === "lose" && <p className="muted">Ton AM a été vaincu. Petite pénalité d'or. Soigne-toi et retente.</p>}
        <div className="stat-summary muted">Dégâts infligés : {pStat.damageDealt} · reçus : {pStat.damageTaken}</div>
        <button className="primary big" onClick={onContinue}>Continuer</button>
      </div>
    </div>
  );
}

function CaptureModal({ onCapture }: { onCapture: () => void }) {
  const sp = SPECIES[RARE_REWARD];
  return (
    <div className="overlay">
      <div className="modal center">
        <h1>✨ Un Auto Monster rare apparaît !</h1>
        <div className="amcard reveal">
          <div className="amcard-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}55, transparent 70%)` }}>
            <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
          </div>
          <h3>{sp.name} <span className="rare-tag">RARE</span></h3>
          <StatRow stats={makeCharacter(RARE_REWARD).stats} />
          {sp.innate && <div className="talent-chip">✨ {talentName(sp.innate)}</div>}
        </div>
        <button className="primary big" onClick={onCapture}>Capturer</button>
      </div>
    </div>
  );
}
