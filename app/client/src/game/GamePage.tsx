// AutoMonster — refonte "monde à zones" + mise en scène.
//  - Onboarding : dialogue façon Disco Elysium avec la mentor, choix du 1er AM.
//  - Carte du monde CLAIRE : 3 zones, anneaux de complétion, voyage animé.
//  - À l'arrivée : la carte fade out → vue de zone.
//  - Zones d'exploration : combats en boucle → taux de complétion ; 75% débloque
//    la zone suivante (menacée par un boss). Boss vaincu → zone pacifiée (PNJ).
//  - PNJ : chat plein écran façon Disco Elysium (marchand, soin, ranch, lore).
//  - Bestiaire (pokédex) des espèces rencontrées.

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
  POTION_HEAL,
  FULL_HEAL_COST,
  POTION_PRICE,
  HEAL_CENTER_COST,
  RANCH_OFFERS,
  RANCH_EXTEND,
  INTERACT_LABELS,
  ZONES,
  ZONE_PATHS,
  MAP_WORLD_W,
  MAP_WORLD_H,
  START_ZONE,
  zoneById,
  encounterById,
  type MapLocation,
  type Npc,
  type Zone,
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
  withMoodBattle,
  moodOf,
  moodLabel,
  pushHistory,
  interact,
  interactReadyIn,
} from "./engine/progression";
import { TALENTS, talentName } from "./engine/talents";
import type { Character, CombatResult, Stats, StatKey, InteractKind } from "./engine/types";
import {
  freshState,
  migrate,
  GameState,
  isLocationCleared,
  zoneCompletion,
  zoneMood,
  isZoneUnlocked,
  isZonePacified,
  registerZoneWin,
  recordBestiary,
} from "./state";
import "./game.css";

type CombatCtx = { loc: MapLocation; result: CombatResult; charId: string };
type Outcome = "win" | "lose" | "draw";
type RewardData = { outcome: Outcome; loc: MapLocation; pStat: any; firstClear: boolean; levelsGained: number };

type Route = { v: "map" } | { v: "zone"; zoneId: string };
type Modal =
  | { k: "none" }
  | { k: "combat"; ctx: CombatCtx }
  | { k: "reward"; reward: RewardData }
  | { k: "capture" }
  | { k: "chat"; npcId: string; zoneId: string }
  | { k: "amPage"; charId: string }
  | { k: "bestiary" }
  | { k: "inventory" }
  | { k: "ranchExtend" };

const STAT_LABELS: Record<StatKey, string> = {
  hp: "❤️ PV",
  atk: "⚔️ ATK",
  def: "🛡️ DEF",
  spd: "💨 VIT",
  sta: "⚡ STA",
};

/** Zone contenant un encounter (combat). */
const zoneOfEncounter = (locId: string): Zone | undefined =>
  ZONES.find((z) => z.encounters.includes(locId));

export default function GamePage() {
  const { logout, user } = useAuth();
  const [gs, setGs] = useState<GameState>(freshState());
  const [loaded, setLoaded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [route, setRoute] = useState<Route>({ v: "map" });
  const [modal, setModal] = useState<Modal>({ k: "none" });
  const [worldFading, setWorldFading] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { state } = await api.getGameState<Partial<GameState>>();
        if (state && state.started) setGs(migrate(state));
      } catch {
        /* hors-ligne : état frais */
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
        const rental = prev.rental ? { ...prev.rental, char: fix(prev.rental.char) } : prev.rental;
        if (changed) {
          const next = { ...prev, team, rental };
          api.saveGameState(next).catch(() => {});
          return next;
        }
        setTick((x) => x + 1);
        return prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [gs.team, gs.rental]);

  async function persist(next: GameState) {
    setGs(next);
    try {
      await api.saveGameState(next);
    } catch {
      /* hors-ligne */
    }
  }

  function updateChar(charId: string, fn: (c: Character) => Character, extra?: Partial<GameState>) {
    const team = gs.team.map((c) => (c.id === charId ? fn(c) : c));
    const rental =
      gs.rental && gs.rental.char.id === charId ? { ...gs.rental, char: fn(gs.rental.char) } : gs.rental;
    persist({ ...gs, team, rental, ...extra });
  }

  const findChar = (id: string): Character | undefined =>
    gs.team.find((c) => c.id === id) ?? (gs.rental?.char.id === id ? gs.rental.char : undefined);

  // ── Onboarding : adoption du 1er AM ─────────────────────────────────────────
  function adopt(speciesId: string) {
    const c = makeCharacter(speciesId);
    persist({ ...freshState(), started: true, team: [c], gold: 30, potions: 1, bestiary: [speciesId] });
    setRoute({ v: "map" });
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
  function doInteract(charId: string, kind: InteractKind) {
    const c = findChar(charId);
    if (!c || interactReadyIn(c, kind) > 0) return;
    const res = interact(c, kind);
    updateChar(charId, () => res.character);
  }

  // ── Marchand / soin / ranch ─────────────────────────────────────────────
  function buyPotion() {
    if (gs.gold < POTION_PRICE) return;
    persist({ ...gs, gold: gs.gold - POTION_PRICE, potions: gs.potions + 1 });
  }
  function healAllTeam() {
    if (gs.gold < HEAL_CENTER_COST) return;
    const needs = gs.team.some((c) => currentLife(c) < c.stats.hp);
    if (!needs) return;
    persist({ ...gs, gold: gs.gold - HEAL_CENTER_COST, team: gs.team.map((c) => ({ ...c, life: c.stats.hp, healStart: null })) });
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

  // ── Voyage vers une zone (fade de la carte) ──────────────────────────────
  function goToZone(zoneId: string) {
    if (!isZoneUnlocked(gs, zoneId)) return;
    setWorldFading(true);
    window.setTimeout(() => {
      persist({ ...gs, playerZone: zoneId });
      setRoute({ v: "zone", zoneId });
      setWorldFading(false);
    }, 480);
  }
  function backToMap() {
    setRoute({ v: "map" });
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  function startCombat(loc: MapLocation, charId: string) {
    const base = findChar(charId);
    if (!base) return;
    const player = commitHeal(base);
    if (player.life <= 0) return;

    const enemy = makeEnemy(loc);
    if (loc.isBoss && gs.bossLife[loc.id] != null) enemy.life = gs.bossLife[loc.id];
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const result = runCombat({
      seed,
      teamA: [withMoodBattle(player)],
      teamB: [enemy],
      rules: loc.maxTurns ? { maxTurns: loc.maxTurns } : undefined,
    });
    // rencontre → bestiaire + commit du soin en cours
    const withBest = loc.enemySpecies ? recordBestiary(gs, loc.enemySpecies) : gs;
    persist(withCharUpdate(withBest, charId, () => player));
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
    const bossKilled = loc.isBoss && bossLife[loc.id] === 0;

    let gold = gs.gold;
    let potions = gs.potions;
    let cleared = gs.cleared;
    let bossDefeated = gs.bossDefeated;
    let zoneProgress = gs.zoneProgress;
    let zonesUnlocked = gs.zonesUnlocked;
    let levelsGained = 0;
    let firstClear = false;

    const won = outcome === "win" || bossKilled;
    if (won) {
      firstClear = !isLocationCleared(gs, loc.id);
      const xpAmt = firstClear ? loc.xp ?? 0 : Math.round((loc.xp ?? 0) / 2);
      gold += firstClear ? loc.gold ?? 0 : Math.round((loc.gold ?? 0) / 2);
      if (firstClear) potions += loc.potions ?? 0;
      const xpRes = addXp(getF(), xpAmt);
      setF(xpRes.character);
      levelsGained = xpRes.levelsGained;
      if (firstClear) cleared = [...gs.cleared, loc.id];
      if (loc.isBoss) delete bossLife[loc.id];

      // progression de zone + déblocage
      const z = zoneOfEncounter(loc.id);
      if (z) {
        const advanced = registerZoneWin({ ...gs, zoneProgress, zonesUnlocked }, z.id);
        zoneProgress = advanced.zoneProgress;
        zonesUnlocked = advanced.zonesUnlocked;
        // boss vaincu → zone pacifiée
        if (bossKilled && z.boss === loc.id && !bossDefeated.includes(z.id)) {
          bossDefeated = [...bossDefeated, z.id];
        }
      }
    } else if (outcome === "lose") {
      gold = Math.floor(gs.gold * 0.9);
      if (getF().life <= 0) setF({ ...getF(), life: Math.max(1, Math.round(getF().stats.hp * 0.3)) });
    }

    const enemyName = SPECIES[loc.enemySpecies!]?.name ?? loc.name;
    const histText =
      outcome === "win" ? `Victoire vs ${enemyName} (N.${loc.enemyLevel})`
      : outcome === "draw" ? `Égalité vs ${enemyName}`
      : `Défaite vs ${enemyName}`;
    setF(pushHistory(getF(), "combat", histText));
    if (levelsGained > 0) setF(pushHistory(getF(), "levelup", `Niveau ${getF().level} atteint`));

    if (usedRental && rental) rental.fightsLeft -= 1;

    persist({ ...gs, team, rental, gold, potions, cleared, bossLife, bossDefeated, zoneProgress, zonesUnlocked });
    setModal({ k: "reward", reward: { outcome: won ? "win" : outcome === "lose" ? "lose" : "draw", loc, pStat, firstClear, levelsGained } });
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
    persist({ ...gs, team: [...gs.team, rare], capturedRare: true, bestiary: gs.bestiary.includes(RARE_REWARD) ? gs.bestiary : [...gs.bestiary, RARE_REWARD] });
    setModal(gs.rental && gs.rental.fightsLeft <= 0 ? { k: "ranchExtend" } : { k: "none" });
  }

  async function resetGame() {
    try { await api.resetGameState(); } catch { /* ignore */ }
    setGs(freshState());
    setModal({ k: "none" });
    setRoute({ v: "map" });
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (!loaded) return <div className="game-shell"><div className="center-screen"><div className="spinner" /></div></div>;

  if (!gs.started) {
    return (
      <div className="game-shell">
        <Onboarding onPick={adopt} />
      </div>
    );
  }

  const openChat = (npc: Npc, zoneId: string) => setModal({ k: "chat", npcId: npc.id, zoneId });
  const allPacified = isZonePacified(gs, "cimes");

  return (
    <div className="game-shell">
      <header className="game-top">
        <div className="brand"><span className="brand-badge">⚔️</span> AutoMonster</div>
        <div className="top-right">
          <span className="purse">💰 {gs.gold} · 🧪 {gs.potions}</span>
          <button className="ghost sm" onClick={() => setModal({ k: "bestiary" })}>📖 Bestiaire</button>
          <button className="ghost sm" onClick={() => setModal({ k: "inventory" })}>🎒 Équipe</button>
          <button className="ghost sm" onClick={() => logout()}>{user?.displayName || "Déconnexion"} ⏻</button>
        </div>
      </header>

      <div className="hub">
        <div className="team-strip">
          <div className="team-strip-title">⚜️ Ton équipe — clique un compagnon</div>
          <div className="team-strip-grid stagger">
            {gs.team.map((c) => (
              <TeamMini key={c.id} c={c} onSheet={() => setModal({ k: "amPage", charId: c.id })} onToggleHeal={() => toggleHeal(c.id)} />
            ))}
            {gs.rental && (
              <TeamMini c={gs.rental.char} rented={gs.rental.fightsLeft} onSheet={() => setModal({ k: "amPage", charId: gs.rental!.char.id })} onToggleHeal={() => toggleHeal(gs.rental!.char.id)} />
            )}
          </div>
        </div>

        {route.v === "map" && (
          <WorldMap gs={gs} fading={worldFading} onEnter={goToZone} />
        )}
        {route.v === "zone" && (
          <ZoneScreen
            gs={gs}
            zone={zoneById(route.zoneId)}
            onBack={backToMap}
            onFight={startCombat}
            onToggleHeal={toggleHeal}
            onPotion={healPotion}
            onFull={healFullPaid}
            onOpenChat={openChat}
          />
        )}
      </div>

      {modal.k === "chat" && (() => {
        const zone = zoneById(modal.zoneId);
        const pool = zoneMood(gs, zone.id) === "peaceful" ? zone.npcs : (zone.wildNpcs ?? zone.npcs);
        const npc = pool.find((n) => n.id === modal.npcId) ?? pool[0];
        if (!npc) return null;
        return (
          <NpcChat
            npc={npc} gs={gs}
            onClose={() => setModal({ k: "none" })}
            onBuy={buyPotion} onHealAll={healAllTeam} onRent={rent} onReturn={returnRental}
          />
        );
      })()}

      {modal.k === "inventory" && (
        <InventoryModal gs={gs} onToggleHeal={toggleHeal} onPotion={healPotion} onFull={healFullPaid} onSheet={(id) => setModal({ k: "amPage", charId: id })} onClose={() => setModal({ k: "none" })} />
      )}

      {modal.k === "bestiary" && <BestiaryModal gs={gs} onClose={() => setModal({ k: "none" })} />}

      {modal.k === "amPage" && (() => {
        const c = findChar(modal.charId);
        if (!c) return null;
        const isRent = gs.rental?.char.id === c.id;
        return (
          <AmPage
            c={c} gold={gs.gold} potions={gs.potions}
            rentedFights={isRent ? gs.rental!.fightsLeft : undefined}
            onToggleHeal={toggleHeal} onPotion={healPotion} onFull={healFullPaid}
            onInteract={doInteract} onClose={() => setModal({ k: "none" })}
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
      {modal.k === "ranchExtend" && gs.rental && (
        <RanchExtendModal species={SPECIES[gs.rental.char.speciesId].name} gold={gs.gold} onExtend={extendRental} onReturn={returnRental} />
      )}

      {allPacified && modal.k === "none" && (
        <div className="cleared-banner">🏆 Les trois zones sont pacifiées ! <button className="ghost sm" onClick={resetGame}>Recommencer</button></div>
      )}
    </div>
  );
}

/** Applique une transformation à un Character sur un état donné (pur). */
function withCharUpdate(s: GameState, charId: string, fn: (c: Character) => Character): GameState {
  const team = s.team.map((c) => (c.id === charId ? fn(c) : c));
  const rental = s.rental && s.rental.char.id === charId ? { ...s.rental, char: fn(s.rental.char) } : s.rental;
  return { ...s, team, rental };
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — dialogue Disco Elysium + choix du starter
// ═══════════════════════════════════════════════════════════════════════════

function Onboarding({ onPick }: { onPick: (id: string) => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [pick, setPick] = useState<string>(STARTERS[0]);
  const sylve = ZONES[0].npcs[0];

  return (
    <div className="onboard">
      <div className="de-scene">
        <div className="de-portrait" style={{ ["--pt" as any]: `${sylve.tint}44` }}>
          <div className="de-emoji">{sylve.emoji}</div>
          <div className="de-frame">
            <div className="de-name">{sylve.name}</div>
            <div className="de-title">{sylve.title}</div>
          </div>
        </div>

        <div className="de-body">
          {step === 0 ? (
            <>
              <div className="de-lines">
                {sylve.lines.map((l, i) => (
                  <div key={i} className="de-line" style={{ ["--lc" as any]: sylve.tint }}>
                    <span className="de-speaker">{sylve.name}</span>{l}
                  </div>
                ))}
                <div className="de-line thought">
                  <span className="de-speaker">Ton instinct</span>Un compagnon. Le choix qui décidera de tout. Choisis-le bien.
                </div>
              </div>
              <div className="de-choices">
                <button className="de-choice primary" onClick={() => setStep(1)}>
                  <span className="de-choice-icon">🐾</span>
                  <span>
                    Choisir mon premier Auto Monster
                    <span className="de-choice-sub">Trois compagnons t'attendent</span>
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="de-lines">
                <div className="de-line" style={{ ["--lc" as any]: sylve.tint }}>
                  <span className="de-speaker">{sylve.name}</span>« Approche-toi. Lequel répond à ton regard ? »
                </div>
              </div>
              <div className="starter-grid">
                {STARTERS.map((id) => {
                  const sp = SPECIES[id];
                  const c = makeCharacter(id);
                  return (
                    <div
                      key={id}
                      className={`starter-card ${pick === id ? "active" : ""}`}
                      onClick={() => setPick(id)}
                    >
                      <div className="starter-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}33, transparent 70%)` }}>
                        <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
                      </div>
                      <h3>{sp.name}</h3>
                      <StatRow stats={c.stats} />
                      {sp.innate && <div className="talent-chip">✨ {talentName(sp.innate)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="de-choices">
                <button className="de-choice primary" onClick={() => onPick(pick)}>
                  <span className="de-choice-icon">🤝</span>
                  <span>Adopter {SPECIES[pick].name} et partir à l'aventure</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARTE DU MONDE
// ═══════════════════════════════════════════════════════════════════════════

function WorldMap({ gs, fading, onEnter }: { gs: GameState; fading: boolean; onEnter: (id: string) => void }) {
  const here = zoneById(gs.playerZone);
  const R = 46, C = 2 * Math.PI * R;
  const pctX = (x: number) => (x / MAP_WORLD_W) * 100;
  const pctY = (y: number) => (y / MAP_WORLD_H) * 100;

  return (
    <div className={`world ${fading ? "fading" : ""}`}>
      <div className="world-head">
        <div className="world-title">🗺️ Carte du monde</div>
        <div className="world-sub">Clique une zone pour t'y rendre</div>
      </div>
      <div className="world-canvas">
        <svg className="world-paths" viewBox={`0 0 ${MAP_WORLD_W} ${MAP_WORLD_H}`} preserveAspectRatio="none">
          {ZONE_PATHS.map(([a, b]) => {
            const za = zoneById(a), zb = zoneById(b);
            const live = isZoneUnlocked(gs, a) && isZoneUnlocked(gs, b);
            const mx = (za.x + zb.x) / 2, my = (za.y + zb.y) / 2 - 40;
            const d = `M ${za.x} ${za.y} Q ${mx} ${my} ${zb.x} ${zb.y}`;
            return <path key={`${a}-${b}`} className={live ? "wp-live" : "wp"} d={d} />;
          })}
        </svg>

        {ZONES.map((z) => {
          const unlocked = isZoneUnlocked(gs, z.id);
          const mood = zoneMood(gs, z.id);
          const comp = zoneCompletion(gs, z.id);
          const here = z.id === gs.playerZone;
          const threatened = mood === "threatened";
          const cls = ["zone-node", here ? "here" : "", threatened ? "threatened" : "", unlocked ? "" : "locked"].join(" ");
          const showRing = z.winsToComplete > 0 && !z.boss;
          const badge =
            !unlocked ? { c: "lock", t: "🔒 Verrouillé" }
            : threatened ? { c: "threat", t: "⚠ Menace" }
            : mood === "peaceful" && z.baseMood !== "peaceful" ? { c: "calm", t: "✓ Pacifiée" }
            : comp >= 0.75 && z.unlocks ? { c: "new", t: "✦ Zone suivante ouverte" }
            : null;
          return (
            <button
              key={z.id}
              className={cls}
              style={{ left: `${pctX(z.x)}%`, top: `${pctY(z.y)}%`, ["--zt" as any]: z.tint + "66" }}
              onClick={() => unlocked && onEnter(z.id)}
              disabled={!unlocked}
              title={z.name}
            >
              {badge && <span className={`zone-badge ${badge.c}`}>{badge.t}</span>}
              <span className="zone-orb">
                {showRing && (
                  <svg className="zone-ring" viewBox="0 0 100 100" width="100%" height="100%">
                    <circle className="track" cx="50" cy="50" r={R} />
                    <circle className="prog" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - comp)} />
                  </svg>
                )}
                {unlocked ? z.icon : "🔒"}
              </span>
              <span className="zone-label">
                <span className="zn">{z.name}</span>
                {showRing && <div className="zpct">{Math.round(comp * 100)}% exploré</div>}
              </span>
            </button>
          );
        })}

        <div className="player-pin" style={{ left: `${pctX(here.x)}%`, top: `${pctY(here.y)}%` }}>🧍</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VUE DE ZONE
// ═══════════════════════════════════════════════════════════════════════════

function ZoneScreen({ gs, zone, onBack, onFight, onToggleHeal, onPotion, onFull, onOpenChat }: {
  gs: GameState; zone: Zone; onBack: () => void;
  onFight: (loc: MapLocation, charId: string) => void;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onOpenChat: (npc: Npc, zoneId: string) => void;
}) {
  const mood = zoneMood(gs, zone.id);
  const comp = zoneCompletion(gs, zone.id);
  const npcs = mood === "peaceful" ? zone.npcs : (zone.wildNpcs ?? []);
  const hasCombat = zone.encounters.length > 0 && !(zone.boss && isZonePacified(gs, zone.id));
  const moodLabelTxt = mood === "threatened" ? "⚠ Zone menacée" : mood === "exploration" ? "🧭 Exploration" : "☮ Zone paisible";

  return (
    <div className="zone-view">
      <button className="ghost sm zone-back" onClick={onBack}>← Carte du monde</button>

      <div className="zone-hero" style={{ ["--zt" as any]: zone.tint }}>
        <div className="zh-icon">{zone.icon}</div>
        <div className="zone-name">{zone.name}</div>
        <div className="zh-sub">{zone.subtitle}</div>
        <span className={`zh-state ${mood}`}>{moodLabelTxt}</span>

        {zone.winsToComplete > 0 && !zone.boss && (
          <div className="zone-progress">
            <div className="zp-bar"><div className="zp-fill" style={{ width: `${comp * 100}%` }} /></div>
            <div className="zp-meta">
              <span>Exploration : {Math.round(comp * 100)}%</span>
              <span>{comp >= 0.75 ? "✦ Cimes Orageuses débloquées" : `${Math.ceil(0.75 * zone.winsToComplete - (gs.zoneProgress[zone.id] ?? 0))} victoire(s) avant la zone suivante`}</span>
            </div>
          </div>
        )}
      </div>

      <div className="zone-cols">
        {hasCombat ? (
          <ZoneCombat gs={gs} zone={zone} onFight={onFight} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
        ) : (
          <div className="card">
            <div className="card-title">☮ Havre de paix</div>
            <p className="muted">Aucun combat ici — profite du calme, discute et prépare la suite.</p>
          </div>
        )}

        <div className="card">
          <div className="card-title">💬 Personnages</div>
          {npcs.length === 0 && <p className="muted small">Personne à qui parler pour l'instant.</p>}
          <div className="npc-strip">
            {npcs.map((n) => (
              <button key={n.id} className="npc-chip" style={{ ["--nt" as any]: n.tint + "22" }} onClick={() => onOpenChat(n, zone.id)}>
                <span className="npc-av">{n.emoji}</span>
                <span className="npc-meta">
                  <div className="npc-nm">{n.name}</div>
                  <div className="npc-role">{n.title}</div>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoneCombat({ gs, zone, onFight, onToggleHeal, onPotion, onFull }: {
  gs: GameState; zone: Zone;
  onFight: (loc: MapLocation, charId: string) => void;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
}) {
  const encounters = zone.encounters.map(encounterById);
  const [encId, setEncId] = useState(encounters[0]?.id ?? "");
  const enc = encounters.find((e) => e.id === encId) ?? encounters[0];
  const combatants = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
  const firstAlive = combatants.find((c) => currentLife(c) > 0) ?? combatants[0];
  const [pick, setPick] = useState(firstAlive?.id ?? "");
  useEffect(() => {
    if (!combatants.some((c) => c.id === pick)) setPick(firstAlive?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.team, gs.rental]);

  if (!enc) return null;
  const sp = SPECIES[enc.enemySpecies!];
  const chosen = combatants.find((c) => c.id === pick);
  const ko = chosen ? currentLife(chosen) <= 0 : true;
  const cleared = isLocationCleared(gs, enc.id);

  return (
    <div className="card">
      <div className="card-title">⚔️ {zone.boss ? "Affrontement" : "Rencontres sauvages"}</div>

      {encounters.length > 1 && (
        <div className="pick-list" style={{ marginBottom: 12 }}>
          <div className="statgrid" style={{ gap: 6 }}>
            {encounters.map((e) => {
              const done = isLocationCleared(gs, e.id);
              return (
                <span
                  key={e.id}
                  onClick={() => setEncId(e.id)}
                  style={{ cursor: "pointer", borderColor: e.id === encId ? "var(--acc)" : undefined, background: e.id === encId ? "var(--acc-soft)" : undefined, color: e.id === encId ? "var(--acc)" : undefined }}
                >
                  {done ? "✓ " : ""}{e.name} · N.{e.recommendedLevel}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="enemy-preview">
        <img src={`/sprites/${sp.gfx}.png`} alt="ennemi" style={{ transform: `scale(${sp.size / 100})` }} />
        <div>
          <div className="enemy-name">
            {sp.name} <span className="lvl">N.{enc.enemyLevel}</span>
            {enc.isBoss && <span className="boss-tag">BOSS</span>}
          </div>
          {enc.isBoss && gs.bossLife[enc.id] != null && <div className="boss-chip">PV restants du boss : {gs.bossLife[enc.id]}</div>}
          <div className="loot-line">
            Butin{cleared ? " (déjà nettoyé : ½)" : ""} : 💰 {cleared ? Math.round((enc.gold ?? 0) / 2) : enc.gold}
            {!cleared && ` · 🧪 ${enc.potions}`} · ⭐ {cleared ? Math.round((enc.xp ?? 0) / 2) : enc.xp} XP
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
      {enc.isBoss && <p className="hint">⚠️ Coriace. S'il s'éternise → égalité, mais les PV du boss sont conservés.</p>}
      {ko ? <p className="warn">Cet AM est K.O. — soigne-le ou choisis-en un autre.</p> : (
        <button className="primary big" style={{ width: "100%", marginTop: 12 }} onClick={() => onFight(enc, pick)}>⚔️ Combattre</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT PNJ (Disco Elysium)
// ═══════════════════════════════════════════════════════════════════════════

function NpcChat({ npc, gs, onClose, onBuy, onHealAll, onRent, onReturn }: {
  npc: Npc; gs: GameState; onClose: () => void;
  onBuy: () => void; onHealAll: () => void; onRent: (i: number) => void; onReturn: () => void;
}) {
  return (
    <div className="de-overlay" onClick={onClose}>
      <div className="de-panel" onClick={(e) => e.stopPropagation()}>
        <div className="de-side" style={{ ["--pt" as any]: npc.tint + "44" }}>
          <button className="ghost sm de-close" onClick={onClose}>✕</button>
          <div className="de-emoji">{npc.emoji}</div>
          <div className="de-name">{npc.name}</div>
          <div className="de-title">{npc.title}</div>
        </div>
        <div className="de-main">
          <div className="de-lines">
            {npc.lines.map((l, i) => (
              <div key={i} className="de-line" style={{ ["--lc" as any]: npc.tint }}>{l}</div>
            ))}
          </div>

          {npc.role === "merchant" && (
            <div className="de-actions">
              <button className="de-action" disabled={gs.gold < POTION_PRICE} onClick={onBuy}>
                <span>🧪 Acheter une potion <span className="muted small">(+50% PV)</span></span>
                <span className="de-a-price">{POTION_PRICE}💰</span>
              </button>
              <p className="muted small">Tu as {gs.potions} potion(s) · 💰 {gs.gold}</p>
            </div>
          )}

          {npc.role === "healer" && (
            <div className="de-actions">
              <div className="team-heal-grid">
                {gs.team.map((c) => (
                  <div key={c.id} className="thg-row"><span className="team-name">{c.name}</span><HpBar c={c} /></div>
                ))}
              </div>
              <button className="de-action" disabled={gs.gold < HEAL_CENTER_COST || !gs.team.some((c) => currentLife(c) < c.stats.hp)} onClick={onHealAll}>
                <span>⛲ Soigner toute l'équipe</span>
                <span className="de-a-price">{HEAL_CENTER_COST}💰</span>
              </button>
            </div>
          )}

          {npc.role === "ranch" && (
            <div className="de-actions">
              {gs.rental ? (
                <>
                  <div className="pick-row">
                    <img className="mini" src={`/sprites/${SPECIES[gs.rental.char.speciesId].gfx}.png`} alt="" />
                    <div className="pick-meta">
                      <div className="team-name">{gs.rental.char.name} <span className="rent-tag">loué · {gs.rental.fightsLeft}c</span></div>
                      <HpBar c={gs.rental.char} />
                    </div>
                  </div>
                  <button className="de-action" onClick={onReturn}><span>↩ Rendre le monstre</span></button>
                </>
              ) : (
                RANCH_OFFERS.map((o, i) => {
                  const sp = SPECIES[o.speciesId];
                  return (
                    <button key={o.speciesId} className="de-action" disabled={gs.gold < o.price} onClick={() => onRent(i)}>
                      <span>🐴 {sp.name} <span className="muted small">N.{o.level} · {o.fights} combats</span></span>
                      <span className="de-a-price">{o.price}💰</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BESTIAIRE (pokédex)
// ═══════════════════════════════════════════════════════════════════════════

function BestiaryModal({ gs, onClose }: { gs: GameState; onClose: () => void }) {
  const owned = new Set([...gs.team.map((c) => c.speciesId), ...(gs.rental ? [gs.rental.char.speciesId] : [])]);
  const known = new Set([...gs.bestiary, ...owned]);
  const all = Object.values(SPECIES);
  return (
    <ModalShell title={`📖 Bestiaire — ${known.size}/${all.length}`} onClose={onClose} wide>
      <div className="bestiary">
        <p className="bestiary-count">Espèces découvertes en combattant et en explorant le monde.</p>
        <div className="bestiary-grid">
          {all.map((sp) => {
            const seen = known.has(sp.id);
            return (
              <div key={sp.id} className={`bestiary-card ${seen ? "" : "locked"}`}>
                <div className="bc-art"><img src={`/sprites/${sp.gfx}.png`} alt={seen ? sp.name : "?"} /></div>
                <div className="bc-name">{seen ? sp.name : "???"}</div>
                <div className="bc-kind">
                  {seen ? (sp.kind === "automonster" ? "Auto Monster" : "Bestiole") : "Non découvert"}
                  {seen && sp.rarity === "rare" && " · RARE"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Composants partagés (réutilisés)
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

function InventoryModal({ gs, onToggleHeal, onPotion, onFull, onSheet, onClose }: {
  gs: GameState;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onSheet: (id: string) => void; onClose: () => void;
}) {
  const list = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
  return (
    <ModalShell title="🎒 Ton équipe" onClose={onClose} wide>
      <p className="muted">Soigne tes Auto Monsters. Pour les entraîner, ouvre leur fiche. (💰 {gs.gold})</p>
      {list.map((c) => {
        const sp = SPECIES[c.speciesId];
        const isRent = gs.rental?.char.id === c.id;
        return (
          <div key={c.id} className="inv-card card" style={{ marginTop: 12 }}>
            <div className="pick-row" onClick={() => onSheet(c.id)} style={{ border: "none", background: "transparent", padding: 0 }}>
              <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={c.name} />
              <div className="pick-meta">
                <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span>{sp.rarity === "rare" && <span className="rare-tag">RARE</span>}{isRent && <span className="rent-tag">loué · {gs.rental!.fightsLeft}c</span>}</div>
                <HpBar c={c} />
                <StatRow stats={c.stats} />
              </div>
            </div>
            <HealControls c={c} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
          </div>
        );
      })}
    </ModalShell>
  );
}

function fmtDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
const HIST_ICON: Record<string, string> = { capture: "⭐", combat: "⚔️", interact: "💞", levelup: "🆙" };

function InteractButtons({ c, onInteract }: { c: Character; onInteract: (id: string, k: InteractKind) => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const kinds = Object.keys(INTERACT_LABELS) as InteractKind[];
  const lastText = c.history?.find((h) => h.kind === "interact")?.text;
  return (
    <div className="interact-block">
      <h4 className="block-title">Interagir <span className="muted small">— effet aléatoire selon son caractère</span></h4>
      <div className="interact-grid">
        {kinds.map((k) => {
          const ready = interactReadyIn(c, k);
          const meta = INTERACT_LABELS[k];
          return (
            <button key={k} className="interact-btn" disabled={ready > 0} onClick={() => onInteract(c.id, k)} title={meta.hint}>
              <span className="interact-emoji">{meta.emoji}</span>
              <span>{meta.name}</span>
              <span className="muted small">{ready > 0 ? `${Math.ceil(ready / 1000)}s` : meta.hint}</span>
            </button>
          );
        })}
      </div>
      {lastText && <p className="interact-last">« {lastText} »</p>}
    </div>
  );
}

function AmPage({ c, gold, potions, rentedFights, onToggleHeal, onPotion, onFull, onInteract, onClose }: {
  c: Character; gold: number; potions: number; rentedFights?: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onInteract: (id: string, k: InteractKind) => void; onClose: () => void;
}) {
  const sp = SPECIES[c.speciesId];
  const xpNext = xpForNext(c.level);
  const p = c.personality;
  return (
    <div className="am-page">
      <header className="am-page-top">
        <button className="ghost sm" onClick={onClose}>← Retour</button>
        <div className="am-page-title">{c.name}</div>
        <span />
      </header>

      <div className="am-page-body">
        <section className="am-hero">
          <div className="am-art" style={{ background: `radial-gradient(circle at 50% 38%, ${sp.tint}33, transparent 72%)` }}>
            <img src={`/sprites/${sp.gfx}.png`} alt={c.name} />
          </div>
          <div className="am-hero-info">
            <div className="team-name big">
              {c.name} <span className="lvl">N.{c.level}</span>
              {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
              {rentedFights != null && <span className="rent-tag">loué · {rentedFights}c</span>}
            </div>
            <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
            {p && <div className="am-trait">{p.emoji} {p.archetype} — <span className="muted">{p.blurb}</span></div>}
            <div className="am-mood">Humeur : <strong>{moodLabel(c)}</strong> <span className="muted small">({moodOf(c)}/100)</span></div>
            <HpBar c={c} />
            <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
            <div className="muted small">XP {c.xp}/{xpNext} · Capturé·e le {fmtDate(c.capturedAt)}</div>
          </div>
        </section>

        <div className="am-cols">
          <div className="am-col">
            <h4 className="block-title">Caractéristiques</h4>
            <div className="sheet-stats">
              {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
                <div key={k} className="sheet-stat"><span>{STAT_LABELS[k]}</span><strong>{c.stats[k]}</strong></div>
              ))}
            </div>
            <TalentChips c={c} />
            <h4 className="block-title">Soins</h4>
            <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
            <InteractButtons c={c} onInteract={onInteract} />
          </div>

          <div className="am-col">
            <h4 className="block-title">Descriptif de l'espèce</h4>
            <p className="am-species-desc">{sp.desc}</p>
            <h4 className="block-title">Historique</h4>
            <div className="am-history">
              {(c.history ?? []).length === 0 && <p className="muted small">Aucun évènement pour l'instant.</p>}
              {(c.history ?? []).map((h, i) => (
                <div key={i} className="hist-row">
                  <span className="hist-icon">{HIST_ICON[h.kind] ?? "•"}</span>
                  <span className="hist-text">{h.text}</span>
                  <span className="hist-date muted small">{fmtDate(h.t)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
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
