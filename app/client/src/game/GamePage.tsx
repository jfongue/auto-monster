// Tout se passe sur une seule page (hub) :
//  - une GRANDE carte scrollable avec des lieux de types variés (combat, boutique,
//    centre de soin, ranch, dialogues) et un AVATAR joueur qui se déplace ;
//  - on clique un lieu → sa fiche apparaît → on valide le déplacement ;
//  - une fois arrivé, un PANNEAU d'interactions s'ouvre au-dessus de la carte.
//  - inventaire (soin/boost) et fiches détaillées en modals.
// Les montées de niveau augmentent les stats automatiquement (aucun choix).

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import CombatView from "./renderer/CombatView";
import {
  SPECIES,
  STARTERS,
  RARE_REWARD,
  MAP_LOCATIONS,
  MAP_PATHS,
  MAP_W,
  MAP_H,
  POTION_HEAL,
  FULL_HEAL_COST,
  POTION_PRICE,
  HEAL_CENTER_COST,
  BOOST_COST,
  BOOST_AMOUNT,
  RANCH_OFFERS,
  RANCH_EXTEND,
  type MapLocation,
} from "./engine/data";
import { runCombat } from "./engine/combat";
import {
  makeCharacter,
  makeLeveledCharacter,
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
import { freshState, migrate, GameState, isLocationCleared, allCleared } from "./state";
import "./game.css";

type CombatCtx = { loc: MapLocation; result: CombatResult; charId: string };
type Outcome = "win" | "lose" | "draw";
type RewardData = { outcome: Outcome; loc: MapLocation; pStat: any; firstClear: boolean; levelsGained: number };
type Modal =
  | { k: "none" }
  | { k: "travel"; locId: string }
  | { k: "combat"; ctx: CombatCtx }
  | { k: "reward"; reward: RewardData }
  | { k: "capture" }
  | { k: "inventory" }
  | { k: "sheet"; charId: string }
  | { k: "ranchExtend" };

const STAT_LABELS: Record<StatKey, string> = {
  hp: "❤️ PV",
  atk: "⚔️ ATK",
  def: "🛡️ DEF",
  spd: "💨 VIT",
  sta: "⚡ STA",
};

const locById = (id: string) => MAP_LOCATIONS.find((l) => l.id === id)!;

export default function GamePage() {
  const { logout, user } = useAuth();
  const [gs, setGs] = useState<GameState>(freshState());
  const [loaded, setLoaded] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState<Modal>({ k: "none" });
  const [, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { state } = await api.getGameState<Partial<GameState>>();
        if (state && state.started) setGs(migrate(state));
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
    const all = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
    if (!all.some((c) => c.healStart != null)) return;
    const id = window.setInterval(() => {
      setGs((prev) => {
        let changed = false;
        const fix = (c: Character) => {
          if (c.healStart != null && currentLife(c) >= c.stats.hp) {
            changed = true;
            return { ...c, life: c.stats.hp, healStart: null };
          }
          return c;
        };
        const team = prev.team.map(fix);
        const rental = prev.rental ? { ...prev.rental, char: fix(prev.rental.char) } : null;
        if (changed) {
          const next = { ...prev, team, rental };
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
      /* hors-ligne */
    }
  }

  // applique une transformation à un Character de l'équipe OU au monstre loué
  function updateChar(charId: string, fn: (c: Character) => Character, extra?: Partial<GameState>) {
    const team = gs.team.map((c) => (c.id === charId ? fn(c) : c));
    const rental =
      gs.rental && gs.rental.char.id === charId ? { ...gs.rental, char: fn(gs.rental.char) } : gs.rental;
    persist({ ...gs, team, rental, ...extra });
  }

  const findChar = (id: string): Character | undefined =>
    gs.team.find((c) => c.id === id) ?? (gs.rental?.char.id === id ? gs.rental.char : undefined);

  // ── Adoption ──────────────────────────────────────────────────────────────
  function adopt(speciesId: string) {
    const c = makeCharacter(speciesId);
    setAdopting(false);
    persist({ ...freshState(), started: true, team: [c], gold: 30, potions: 1 });
  }

  // ── Soins ───────────────────────────────────────────────────────────────
  const toggleHeal = (charId: string) =>
    updateChar(charId, (c) => (c.healStart != null ? commitHeal(c) : startHeal(c)));

  function healPotion(charId: string) {
    if (gs.potions <= 0) return;
    const c = findChar(charId);
    if (!c || isFull(c)) return;
    updateChar(
      charId,
      (x) => ({ ...x, healStart: null, life: Math.min(x.stats.hp, Math.round(currentLife(x) + x.stats.hp * POTION_HEAL)) }),
      { potions: gs.potions - 1 }
    );
  }
  function healFullPaid(charId: string) {
    const c = findChar(charId);
    if (!c || gs.gold < FULL_HEAL_COST || isFull(c)) return;
    updateChar(charId, (x) => ({ ...x, life: x.stats.hp, healStart: null }), { gold: gs.gold - FULL_HEAL_COST });
  }

  function boost(charId: string, stat: StatKey) {
    if (gs.gold < BOOST_COST) return;
    updateChar(charId, (x) => boostStat(x, stat), { gold: gs.gold - BOOST_COST });
  }

  // ── Boutique / Centre de soin / Ranch ───────────────────────────────────
  function buyPotion() {
    if (gs.gold < POTION_PRICE) return;
    persist({ ...gs, gold: gs.gold - POTION_PRICE, potions: gs.potions + 1 });
  }
  function healAllTeam() {
    if (gs.gold < HEAL_CENTER_COST) return;
    const needs = gs.team.some((c) => currentLife(c) < c.stats.hp);
    if (!needs) return;
    persist({
      ...gs,
      gold: gs.gold - HEAL_CENTER_COST,
      team: gs.team.map((c) => ({ ...c, life: c.stats.hp, healStart: null })),
    });
  }
  function rent(offerIdx: number) {
    const offer = RANCH_OFFERS[offerIdx];
    if (!offer || gs.rental || gs.gold < offer.price) return;
    const char = makeLeveledCharacter(offer.speciesId, offer.level);
    persist({ ...gs, gold: gs.gold - offer.price, rental: { char, fightsLeft: offer.fights } });
  }
  function extendRental() {
    if (!gs.rental || gs.gold < RANCH_EXTEND.price) return;
    persist({ ...gs, gold: gs.gold - RANCH_EXTEND.price, rental: { ...gs.rental, fightsLeft: gs.rental.fightsLeft + RANCH_EXTEND.fights } });
    setModal({ k: "none" });
  }
  function returnRental() {
    persist({ ...gs, rental: null });
    setModal({ k: "none" });
  }

  // ── Déplacement ─────────────────────────────────────────────────────────
  function travelTo(locId: string) {
    persist({ ...gs, playerLoc: locId });
    setModal({ k: "none" });
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  function startCombat(loc: MapLocation, charId: string) {
    const base = findChar(charId);
    if (!base) return;
    const player = commitHeal(base);
    if (player.life <= 0) return;
    updateChar(charId, () => player);

    const enemy = makeEnemy(loc);
    if (loc.isBoss && gs.bossLife[loc.id] != null) enemy.life = gs.bossLife[loc.id];
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const result = runCombat({
      seed,
      teamA: [{ ...player }],
      teamB: [enemy],
      rules: loc.maxTurns ? { maxTurns: loc.maxTurns } : undefined,
    });
    setModal({ k: "combat", ctx: { loc, result, charId } });
  }

  function onCombatFinish(winner: 0 | 1 | null) {
    if (modal.k !== "combat") return;
    const { loc, result, charId } = modal.ctx;
    const pStat = result.stats.find((s) => s.side === 0)!;
    const eStat = result.stats.find((s) => s.side === 1)!;
    const outcome: Outcome = winner === 0 ? "win" : winner === 1 ? "lose" : "draw";

    let team = gs.team.map((c) => ({ ...c }));
    let rental = gs.rental ? { ...gs.rental, char: { ...gs.rental.char } } : null;
    const usedRental = !!rental && rental.char.id === charId;
    const ti = team.findIndex((c) => c.id === charId);
    const getF = (): Character => (usedRental ? rental!.char : team[ti]);
    const setF = (c: Character) => {
      if (usedRental) rental!.char = c;
      else team[ti] = c;
    };

    setF({ ...getF(), life: Math.max(0, pStat.lifeLeft), healStart: null });

    const bossLife = { ...gs.bossLife };
    if (loc.isBoss) bossLife[loc.id] = Math.max(0, eStat.lifeLeft);
    const bossDefeated = loc.isBoss && bossLife[loc.id] === 0;

    let gold = gs.gold;
    let potions = gs.potions;
    let cleared = gs.cleared;
    let levelsGained = 0;
    let firstClear = false;

    if (outcome === "win" || bossDefeated) {
      firstClear = !isLocationCleared(gs, loc.id);
      const xpAmt = firstClear ? loc.xp ?? 0 : Math.round((loc.xp ?? 0) / 2);
      gold += firstClear ? loc.gold ?? 0 : Math.round((loc.gold ?? 0) / 2);
      if (firstClear) potions += loc.potions ?? 0;
      const xpRes = addXp(getF(), xpAmt);
      setF(xpRes.character);
      levelsGained = xpRes.levelsGained;
      if (firstClear) cleared = [...gs.cleared, loc.id];
      if (loc.isBoss) delete bossLife[loc.id];
    } else if (outcome === "lose") {
      gold = Math.floor(gs.gold * 0.9);
      if (getF().life <= 0) setF({ ...getF(), life: Math.max(1, Math.round(getF().stats.hp * 0.3)) });
    }

    if (usedRental && rental) rental.fightsLeft -= 1;

    persist({ ...gs, team, rental, gold, potions, cleared, bossLife });
    setModal({ k: "reward", reward: { outcome: outcome === "lose" || outcome === "draw" ? outcome : "win", loc, pStat, firstClear, levelsGained } });
  }

  function closeReward() {
    if (modal.k !== "reward") return;
    const r = modal.reward;
    const wonBoss = r.loc.isBoss && r.outcome === "win" && r.firstClear;
    if (wonBoss && !gs.capturedRare) setModal({ k: "capture" });
    else if (gs.rental && gs.rental.fightsLeft <= 0) setModal({ k: "ranchExtend" });
    else setModal({ k: "none" });
  }

  function captureRare() {
    const rare = makeCharacter(RARE_REWARD);
    persist({ ...gs, team: [...gs.team, rare], capturedRare: true });
    setModal(gs.rental && gs.rental.fightsLeft <= 0 ? { k: "ranchExtend" } : { k: "none" });
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

  const here = locById(gs.playerLoc);

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
        <div className="hub">
          <LocationPanel
            gs={gs}
            here={here}
            onFight={startCombat}
            onToggleHeal={toggleHeal}
            onPotion={healPotion}
            onFull={healFullPaid}
            onBuyPotion={buyPotion}
            onHealAll={healAllTeam}
            onRent={rent}
            onReturnRental={returnRental}
            onSheet={(id) => setModal({ k: "sheet", charId: id })}
          />

          <MapBoard gs={gs} onClickNode={(id) => (id === gs.playerLoc ? null : setModal({ k: "travel", locId: id }))} />

          <div className="team-strip">
            {gs.team.map((c) => (
              <TeamMini key={c.id} c={c} onSheet={() => setModal({ k: "sheet", charId: c.id })} onToggleHeal={() => toggleHeal(c.id)} />
            ))}
            {gs.rental && (
              <TeamMini c={gs.rental.char} rented={gs.rental.fightsLeft} onSheet={() => setModal({ k: "sheet", charId: gs.rental!.char.id })} onToggleHeal={() => toggleHeal(gs.rental!.char.id)} />
            )}
          </div>
        </div>
      )}

      {modal.k === "travel" && (
        <TravelModal gs={gs} loc={locById(modal.locId)} onConfirm={() => travelTo(modal.locId)} onClose={() => setModal({ k: "none" })} />
      )}

      {modal.k === "inventory" && (
        <InventoryModal gs={gs} onToggleHeal={toggleHeal} onPotion={healPotion} onFull={healFullPaid} onBoost={boost} onSheet={(id) => setModal({ k: "sheet", charId: id })} onClose={() => setModal({ k: "none" })} />
      )}

      {modal.k === "sheet" && (() => {
        const c = findChar(modal.charId);
        if (!c) return null;
        return <SheetModal c={c} gold={gs.gold} potions={gs.potions} onToggleHeal={toggleHeal} onPotion={healPotion} onFull={healFullPaid} onBoost={boost} onClose={() => setModal({ k: "none" })} />;
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
      {modal.k === "ranchExtend" && gs.rental && (
        <RanchExtendModal species={SPECIES[gs.rental.char.speciesId].name} gold={gs.gold} onExtend={extendRental} onReturn={returnRental} />
      )}

      {gs.started && allCleared(gs) && !adopting && modal.k === "none" && (
        <div className="cleared-banner">🏆 Vallée entièrement nettoyée ! <button className="ghost sm" onClick={resetGame}>Recommencer</button></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Partagés
// ═══════════════════════════════════════════════════════════════════════════

function StatRow({ stats }: { stats: Stats }) {
  return (
    <div className="statgrid">
      <span>❤️ {stats.hp}</span><span>⚔️ {stats.atk}</span><span>🛡️ {stats.def}</span><span>💨 {stats.spd}</span><span>⚡ {stats.sta}</span>
    </div>
  );
}

function HpBar({ c }: { c: Character }) {
  const life = currentLife(c);
  const pct = Math.round((life / c.stats.hp) * 100);
  const healing = isHealing(c);
  return (
    <div className="hpline">
      <div className={`hpbar sm ${healing ? "healing" : ""}`}><div className="hpbar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="hp-num sm">{Math.round(life)}/{c.stats.hp}{healing ? " 💚" : ""}</span>
    </div>
  );
}

function HealControls({ c, gold, potions, onToggleHeal, onPotion, onFull }: {
  c: Character; gold: number; potions: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
}) {
  const full = isFull(c);
  const healing = isHealing(c);
  const eta = healing ? Math.ceil(healEtaMs(c) / 1000) : 0;
  return (
    <div className="heal-row">
      <button disabled={full} onClick={() => onToggleHeal(c.id)}>{healing ? `⏸️ Stopper (${eta}s)` : "💚 Soin progressif"}</button>
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
      {ids.map((t) => <span key={t} className="talent-mini" title={TALENTS[t]?.desc}>{talentName(t)}</span>)}
    </div>
  );
}

function TeamMini({ c, rented, onSheet, onToggleHeal }: { c: Character; rented?: number; onSheet: () => void; onToggleHeal: () => void }) {
  const sp = SPECIES[c.speciesId];
  return (
    <div className="team-mini" onClick={onSheet}>
      <img src={`/sprites/${sp.gfx}.png`} alt={c.name} />
      <div className="team-mini-meta">
        <div className="team-name">
          {c.name} <span className="lvl">N.{c.level}</span>
          {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
          {rented != null && <span className="rent-tag">loué · {rented}c</span>}
        </div>
        <HpBar c={c} />
      </div>
      <button className="ghost sm heal-quick" onClick={(e) => { e.stopPropagation(); onToggleHeal(); }} disabled={isFull(c)}>
        {isHealing(c) ? "⏸️" : "💚"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Carte
// ═══════════════════════════════════════════════════════════════════════════

function MapBoard({ gs, onClickNode }: { gs: GameState; onClickNode: (id: string) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const here = locById(gs.playerLoc);

  // centre la vue sur le joueur à chaque déplacement
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    vp.scrollTo({ left: here.x - vp.clientWidth / 2, top: here.y - vp.clientHeight / 2, behavior: "smooth" });
  }, [gs.playerLoc, here.x, here.y]);

  return (
    <div className="map-board">
      <div className="map-title">🗺️ Carte — clique un lieu pour t'y rendre</div>
      <div className="map-viewport" ref={viewport}>
        <div className="map-canvas-lg" style={{ width: MAP_W, height: MAP_H }}>
          <svg className="map-paths" viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={MAP_W} height={MAP_H}>
            {MAP_PATHS.map(([a, b]) => {
              const pa = locById(a), pb = locById(b);
              return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
            })}
          </svg>

          {MAP_LOCATIONS.map((l) => {
            const cleared = l.type === "combat" && isLocationCleared(gs, l.id);
            const current = l.id === gs.playerLoc;
            return (
              <button
                key={l.id}
                className={`map-loc type-${l.type} ${cleared ? "done" : ""} ${l.isBoss ? "boss" : ""} ${current ? "current" : ""}`}
                style={{ left: l.x, top: l.y }}
                onClick={() => onClickNode(l.id)}
                title={l.name}
              >
                <span className="loc-dot">{cleared ? "✓" : l.icon}</span>
                <span className="loc-name">{l.name}</span>
                {l.type === "combat" && <span className="loc-lvl">N.{l.recommendedLevel}</span>}
              </button>
            );
          })}

          {/* avatar joueur */}
          <div className="player-token" style={{ left: here.x, top: here.y }}>🧍</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Panneau d'interactions du lieu courant
// ═══════════════════════════════════════════════════════════════════════════

function LocationPanel(props: {
  gs: GameState; here: MapLocation;
  onFight: (loc: MapLocation, charId: string) => void;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onBuyPotion: () => void; onHealAll: () => void; onRent: (i: number) => void; onReturnRental: () => void;
  onSheet: (id: string) => void;
}) {
  const { here } = props;
  return (
    <div className="loc-panel">
      <div className="loc-panel-head">
        <span className="loc-panel-icon">{here.icon}</span>
        <div>
          <div className="loc-panel-name">{here.name}</div>
          <div className="muted small">{here.desc}</div>
        </div>
      </div>
      <div className="loc-panel-body">
        {here.type === "combat" && <CombatPanel {...props} />}
        {here.type === "shop" && <ShopPanel gold={props.gs.gold} potions={props.gs.potions} onBuy={props.onBuyPotion} />}
        {here.type === "heal" && <HealPanel gs={props.gs} onHealAll={props.onHealAll} />}
        {here.type === "ranch" && <RanchPanel gs={props.gs} onRent={props.onRent} onReturn={props.onReturnRental} />}
        {here.type === "dialogue" && <DialoguePanel lines={here.lines ?? []} />}
      </div>
    </div>
  );
}

function CombatPanel({ gs, here, onFight, onToggleHeal, onPotion, onFull }: {
  gs: GameState; here: MapLocation;
  onFight: (loc: MapLocation, charId: string) => void;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
}) {
  const combatants = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
  const firstAlive = combatants.find((c) => currentLife(c) > 0) ?? combatants[0];
  const [pick, setPick] = useState(firstAlive?.id ?? "");
  useEffect(() => {
    if (!combatants.some((c) => c.id === pick)) setPick(firstAlive?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.team, gs.rental]);

  const sp = SPECIES[here.enemySpecies!];
  const chosen = combatants.find((c) => c.id === pick);
  const ko = chosen ? currentLife(chosen) <= 0 : true;
  const cleared = isLocationCleared(gs, here.id);

  return (
    <>
      <div className="enemy-preview">
        <img src={`/sprites/${sp.gfx}.png`} alt="ennemi" style={{ transform: `scale(${sp.size / 100})` }} />
        <div>
          <div className="enemy-name">
            {sp.name} <span className="lvl">N.{here.enemyLevel}</span>
            {here.isBoss && <span className="boss-tag">BOSS</span>}
          </div>
          {here.isBoss && gs.bossLife[here.id] != null && <div className="boss-chip">PV restants du boss : {gs.bossLife[here.id]}</div>}
          <div className="loot-line">
            Butin{cleared ? " (déjà nettoyé : ½)" : ""} : 💰 {cleared ? Math.round((here.gold ?? 0) / 2) : here.gold}
            {!cleared && ` · 🧪 ${here.potions}`} · ⭐ {cleared ? Math.round((here.xp ?? 0) / 2) : here.xp} XP
          </div>
        </div>
      </div>

      <h4 className="pick-title">Choisis ton AM</h4>
      <div className="pick-list">
        {combatants.map((c) => {
          const spc = SPECIES[c.speciesId];
          const isRent = gs.rental?.char.id === c.id;
          return (
            <div key={c.id} className={`pick-row ${c.id === pick ? "active" : ""}`} onClick={() => setPick(c.id)}>
              <img className="mini" src={`/sprites/${spc.gfx}.png`} alt={c.name} />
              <div className="pick-meta">
                <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span>{isRent && <span className="rent-tag">loué · {gs.rental!.fightsLeft}c</span>}</div>
                <HpBar c={c} />
              </div>
              {c.id === pick && <span className="active-tag">choisi</span>}
            </div>
          );
        })}
      </div>

      {chosen && currentLife(chosen) < chosen.stats.hp && (
        <HealControls c={chosen} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
      )}
      {here.isBoss && <p className="hint">⚠️ Coriace. S'il s'éternise → égalité, mais les PV du boss sont conservés.</p>}
      {ko ? <p className="warn">Cet AM est K.O. — soigne-le ou choisis-en un autre.</p> : (
        <button className="primary big" onClick={() => onFight(here, pick)}>⚔️ Combattre</button>
      )}
    </>
  );
}

function ShopPanel({ gold, potions, onBuy }: { gold: number; potions: number; onBuy: () => void }) {
  return (
    <div className="kiosk">
      <p className="muted">« Une potion ? Ça remet d'aplomb un AM amoché. »</p>
      <div className="kiosk-item">
        <span>🧪 Potion de soin <span className="muted small">(+50% PV, instantané)</span></span>
        <button className="primary" disabled={gold < POTION_PRICE} onClick={onBuy}>Acheter — {POTION_PRICE}💰</button>
      </div>
      <p className="muted small">Tu as {potions} potion(s) · 💰 {gold}</p>
    </div>
  );
}

function HealPanel({ gs, onHealAll }: { gs: GameState; onHealAll: () => void }) {
  const needs = gs.team.some((c) => currentLife(c) < c.stats.hp);
  return (
    <div className="kiosk">
      <p className="muted">« Confie-moi ton équipe, je la remets sur pied en un instant. »</p>
      <div className="team-heal-grid">
        {gs.team.map((c) => (
          <div key={c.id} className="thg-row">
            <span className="team-name">{c.name}</span>
            <HpBar c={c} />
          </div>
        ))}
      </div>
      <button className="primary big" disabled={!needs || gs.gold < HEAL_CENTER_COST} onClick={onHealAll}>
        ➕ Soigner toute l'équipe — {HEAL_CENTER_COST}💰
      </button>
      {!needs && <p className="muted small">Toute ton équipe est déjà au max.</p>}
    </div>
  );
}

function RanchPanel({ gs, onRent, onReturn }: { gs: GameState; onRent: (i: number) => void; onReturn: () => void }) {
  if (gs.rental) {
    const c = gs.rental.char;
    const sp = SPECIES[c.speciesId];
    return (
      <div className="kiosk">
        <p className="muted">« Tu as déjà un de mes monstres. Ramène-le-moi quand tu veux. »</p>
        <div className="pick-row">
          <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={c.name} />
          <div className="pick-meta">
            <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span> <span className="rent-tag">loué · {gs.rental.fightsLeft} combat(s)</span></div>
            <HpBar c={c} />
          </div>
        </div>
        <button className="ghost" onClick={onReturn}>Rendre le monstre</button>
      </div>
    );
  }
  return (
    <div className="kiosk">
      <p className="muted">« Loue un de mes Auto Monsters pour quelques combats. »</p>
      {RANCH_OFFERS.map((o, i) => {
        const sp = SPECIES[o.speciesId];
        return (
          <div key={o.speciesId} className="ranch-offer">
            <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
            <div className="ranch-meta">
              <div className="team-name">{sp.name} <span className="lvl">N.{o.level}</span>{sp.rarity === "rare" && <span className="rare-tag">RARE</span>}</div>
              <div className="muted small">{o.fights} combats · talent : {sp.innate ? talentName(sp.innate) : "—"}</div>
            </div>
            <button className="primary" disabled={gs.gold < o.price} onClick={() => onRent(i)}>Louer — {o.price}💰</button>
          </div>
        );
      })}
    </div>
  );
}

function DialoguePanel({ lines }: { lines: string[] }) {
  return (
    <div className="dialogue">
      {lines.map((l, i) => <p key={i} className="dialogue-line">{l}</p>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="ghost sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function TravelModal({ gs, loc, onConfirm, onClose }: { gs: GameState; loc: MapLocation; onConfirm: () => void; onClose: () => void }) {
  const cleared = loc.type === "combat" && isLocationCleared(gs, loc.id);
  return (
    <ModalShell title={`${loc.icon} ${loc.name}`} onClose={onClose}>
      <p className="muted blurb">{loc.desc}</p>
      {loc.type === "combat" && (() => {
        const sp = SPECIES[loc.enemySpecies!];
        return (
          <div className="enemy-preview">
            <img src={`/sprites/${sp.gfx}.png`} alt="ennemi" style={{ transform: `scale(${sp.size / 100})` }} />
            <div>
              <div className="enemy-name">{sp.name} <span className="lvl">N.{loc.enemyLevel}</span>{loc.isBoss && <span className="boss-tag">BOSS</span>}</div>
              <div className="loot-line">Niveau conseillé : {loc.recommendedLevel}{cleared ? " · déjà nettoyé" : ""}</div>
            </div>
          </div>
        );
      })()}
      {loc.type === "shop" && <p>🏪 Boutique : potions de soin.</p>}
      {loc.type === "heal" && <p>➕ Centre de soin : remise à neuf de l'équipe.</p>}
      {loc.type === "ranch" && <p>🐴 Ranch : location d'Auto Monsters.</p>}
      <button className="primary big" onClick={onConfirm}>🚶 Se déplacer ici</button>
    </ModalShell>
  );
}

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
              {sp.innate && <div className="talent-chip">✨ {talentName(sp.innate)} — <span className="muted">{TALENTS[sp.innate]?.desc}</span></div>}
              <button className="primary">Adopter</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryModal({ gs, onToggleHeal, onPotion, onFull, onBoost, onSheet, onClose }: {
  gs: GameState;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onBoost: (id: string, stat: StatKey) => void; onSheet: (id: string) => void; onClose: () => void;
}) {
  const list = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
  return (
    <ModalShell title="🎒 Inventaire" onClose={onClose} wide>
      <p className="muted">Soigne et booste tes Auto Monsters. (💰 {gs.gold})</p>
      {list.map((c) => {
        const sp = SPECIES[c.speciesId];
        const isRent = gs.rental?.char.id === c.id;
        return (
          <div key={c.id} className="inv-card">
            <div className="inv-head" onClick={() => onSheet(c.id)}>
              <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={c.name} />
              <div className="inv-meta">
                <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span>{sp.rarity === "rare" && <span className="rare-tag">RARE</span>}{isRent && <span className="rent-tag">loué · {gs.rental!.fightsLeft}c</span>}</div>
                <HpBar c={c} />
                <StatRow stats={c.stats} />
              </div>
            </div>
            <HealControls c={c} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
            <div className="boost-row">
              <span className="boost-label">Booster ({BOOST_COST}💰) :</span>
              {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
                <button key={k} className="boost-btn" disabled={gs.gold < BOOST_COST} onClick={() => onBoost(c.id, k)}>{STAT_LABELS[k]} +{BOOST_AMOUNT[k]}</button>
              ))}
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}

function SheetModal({ c, gold, potions, onToggleHeal, onPotion, onFull, onBoost, onClose }: {
  c: Character; gold: number; potions: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onBoost: (id: string, stat: StatKey) => void; onClose: () => void;
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
          <div className="team-name big">{c.name} <span className="lvl">N.{c.level}</span>{sp.rarity === "rare" && <span className="rare-tag">RARE</span>}</div>
          <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
          <HpBar c={c} />
          <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
          <div className="muted small">XP {c.xp}/{xpNext}</div>
        </div>
      </div>
      <div className="sheet-stats">
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <div key={k} className="sheet-stat"><span>{STAT_LABELS[k]}</span><strong>{c.stats[k]}</strong></div>
        ))}
      </div>
      <TalentChips c={c} />
      <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
      <div className="boost-row">
        <span className="boost-label">Booster ({BOOST_COST}💰) :</span>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <button key={k} className="boost-btn" disabled={gold < BOOST_COST} onClick={() => onBoost(c.id, k)}>{STAT_LABELS[k]} +{BOOST_AMOUNT[k]}</button>
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
            <p>+ 💰 {firstClear ? loc.gold : Math.round((loc.gold ?? 0) / 2)} or{firstClear && ` · 🧪 ${loc.potions} potion(s)`}{` · ⭐ ${firstClear ? loc.xp : Math.round((loc.xp ?? 0) / 2)} XP`}</p>
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

function RanchExtendModal({ species, gold, onExtend, onReturn }: { species: string; gold: number; onExtend: () => void; onReturn: () => void }) {
  return (
    <div className="overlay">
      <div className="modal center">
        <h1>🐴 Fin de contrat</h1>
        <p className="muted">{species} a terminé ses combats loués. Boris propose de prolonger le contrat.</p>
        <div className="loot-box"><p>Prolonger : +{RANCH_EXTEND.fights} combats — {RANCH_EXTEND.price}💰</p></div>
        <div className="heal-row">
          <button className="primary" disabled={gold < RANCH_EXTEND.price} onClick={onExtend}>Prolonger ({RANCH_EXTEND.price}💰)</button>
          <button className="ghost" onClick={onReturn}>Rendre le monstre</button>
        </div>
      </div>
    </div>
  );
}
