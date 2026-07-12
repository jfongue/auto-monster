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
  applySpeciesOverrides,
  branchesOf,
  branchDef,
  activeTalents,
  needsBranchChoice,
  BRANCH_CHOICE_LEVEL,
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
  chooseBranch,
} from "./engine/progression";
import { TALENTS, talentName } from "./engine/talents";
import { HpBar, StatRow, TalentList, talentTooltip, RoleTag } from "./shared";
import { Icon, type IconName } from "./icons";
import House, { type QuestGlance } from "./House";
import DailyJournal from "./Daily";
import Arena, { makeDuelEnemy } from "./Arena";
import type { ArenaOpponent } from "../lib/api";
import type { Character, CombatResult, StatKey, InteractKind } from "./engine/types";
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
  todayKey,
  canClaimDaily,
  claimDaily,
  ensureDaily,
  bumpQuest,
  questDef,
  hasDailyClaimable,
  applyOfflineRest,
  arenaWinsToday,
  ARENA_MAX_REWARDED_WINS,
  ARENA_WIN_GOLD,
} from "./state";
import "./game.css";

type CombatCtx = { loc: MapLocation; result: CombatResult; charId: string; duel?: ArenaOpponent };
type Outcome = "win" | "lose" | "draw";
type RewardData = { outcome: Outcome; loc: MapLocation; pStat: any; firstClear: boolean; levelsGained: number };
type DuelRewardData = { won: boolean; trainer: string; gold: number; dmg: number };

type Route = { v: "house" } | { v: "forest" } | { v: "zone"; zoneId: string } | { v: "shop" } | { v: "arena" };
type Modal =
  | { k: "none" }
  | { k: "combat"; ctx: CombatCtx }
  | { k: "reward"; reward: RewardData }
  | { k: "duelReward"; r: DuelRewardData }
  | { k: "capture" }
  | { k: "chat"; npcId: string; zoneId: string }
  | { k: "amPage"; charId: string }
  | { k: "branch"; charId: string }
  | { k: "bestiary" }
  | { k: "inventory" }
  | { k: "ranchExtend" }
  | { k: "daily" };

type Toast = { id: number; text: string };

const STAT_LABELS: Record<StatKey, { icon: IconName; label: string }> = {
  hp: { icon: "hp", label: "Vie" },
  atk: { icon: "atk", label: "Force" },
  def: { icon: "def", label: "Armure" },
  spd: { icon: "spd", label: "Vitesse" },
};

/** Zone contenant un encounter (combat). */
const zoneOfEncounter = (locId: string): Zone | undefined =>
  ZONES.find((z) => z.encounters.includes(locId));

export default function GamePage() {
  const { logout, user } = useAuth();
  const [gs, setGs] = useState<GameState>(freshState());
  const [loaded, setLoaded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [route, setRoute] = useState<Route>({ v: "house" });
  const [modal, setModal] = useState<Modal>({ k: "none" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  function pushToast(text: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  // Back navigateur / Android : ferme d'abord le modal ouvert, puis remonte à la
  // maison, sans jamais quitter l'app. On maintient toujours une entrée d'historique
  // à dépiler.
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const routeRef = useRef(route);
  routeRef.current = route;
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  useEffect(() => {
    window.history.pushState(null, "");
    const onPop = () => {
      if (modalRef.current.k !== "none") setModal({ k: "none" });
      else if (menuOpenRef.current) setMenuOpen(false);
      else if (routeRef.current.v !== "house") setRoute({ v: "house" });
      window.history.pushState(null, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { state } = await api.getGameState<Partial<GameState>>();
        if (state && state.started) {
          // Repos hors-ligne + quêtes fraîches du jour, puis persist.
          const { state: rested, report } = applyOfflineRest(migrate(state));
          const s = ensureDaily(rested);
          setGs(s);
          api.saveGameState(s).catch(() => {});
          if (report.healedHp >= 5) {
            pushToast(`😴 Pendant ton absence, tes AM se sont reposés : +${report.healedHp} PV${report.moodUp ? " et le moral est remonté" : ""}.`);
          }
          if (canClaimDaily(s)) setModal({ k: "daily" });
        }
      } catch {
        /* hors-ligne : état frais */
      }
      try {
        const { overrides } = await api.getSpeciesOverrides();
        applySpeciesOverrides(overrides as any);
      } catch {
        /* pas grave : overrides indisponibles hors-ligne */
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
    const stamped = { ...next, lastSeen: Date.now() };
    setGs(stamped);
    try {
      await api.saveGameState(stamped);
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
    persist(ensureDaily({ ...freshState(), started: true, team: [c], gold: 30, potions: 1, bestiary: [speciesId] }));
    setRoute({ v: "house" });
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
    const { state: bumped, completed } = bumpQuest(gs, "interact");
    persist(withCharUpdate(bumped, charId, () => res.character));
    completed.forEach((d) => pushToast(`✅ ${d.label} — +${d.gold}💰${d.potions > 0 ? ` +${d.potions}🧪` : ""} !`));
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

  // ── Voyage vers une zone (entrée immédiate, sans délai artificiel) ───────
  function goToZone(zoneId: string) {
    if (!isZoneUnlocked(gs, zoneId)) return;
    persist({ ...gs, playerZone: zoneId });
    setRoute({ v: "zone", zoneId });
  }
  function backToForest() {
    setRoute({ v: "forest" });
  }
  function goHouse() {
    setRoute({ v: "house" });
  }
  function goShop() {
    setRoute({ v: "shop" });
  }
  function goArena() {
    setRoute({ v: "arena" });
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

  // ── Duels d'arène (asynchrones, amicaux : pas de dégâts persistés) ────────
  function startDuel(opp: ArenaOpponent, charId: string) {
    const base = findChar(charId);
    if (!base) return;
    const player = commitHeal(base);
    if (player.life <= 0) return;
    const enemy = makeDuelEnemy(opp);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const result = runCombat({ seed, teamA: [withMoodBattle(player)], teamB: [enemy] });
    persist(withCharUpdate(gs, charId, () => player));
    const loc = { id: "duel", name: `Duel — ${opp.trainer}` } as MapLocation;
    setModal({ k: "combat", ctx: { loc, result, charId, duel: opp } });
  }

  function finishDuel(winner: 0 | 1 | null) {
    if (modal.k !== "combat" || !modal.ctx.duel) return;
    const { result, charId, duel } = modal.ctx;
    const pStat = result.stats.find((s) => s.side === 0)!;
    const won = winner === 0;
    let s = gs;
    let goldGain = 0;
    if (won) {
      const day = todayKey();
      const wins = arenaWinsToday(s, day);
      if (wins < ARENA_MAX_REWARDED_WINS) goldGain = ARENA_WIN_GOLD;
      s = { ...s, gold: s.gold + goldGain, duels: { day, wins: wins + 1 } };
      const b = bumpQuest(s, "duel");
      s = b.state;
      b.completed.forEach((d) => pushToast(`✅ ${d.label} — +${d.gold}💰${d.potions > 0 ? ` +${d.potions}🧪` : ""} !`));
    }
    s = withCharUpdate(s, charId, (c) =>
      pushHistory(c, "combat", won ? `Duel gagné vs ${duel.trainer}` : `Duel perdu vs ${duel.trainer}`)
    );
    persist(s);
    setModal({ k: "duelReward", r: { won, trainer: duel.trainer, gold: goldGain, dmg: pStat.damageDealt } });
  }

  function onCombatFinish(winner: 0 | 1 | null) {
    if (modal.k !== "combat") return;
    if (modal.ctx.duel) return finishDuel(winner);
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

    let nextState: GameState = { ...gs, team, rental, gold, potions, cleared, bossLife, bossDefeated, zoneProgress, zonesUnlocked };
    if (won) {
      const b = bumpQuest(nextState, "win");
      nextState = b.state;
      b.completed.forEach((d) => pushToast(`✅ ${d.label} — +${d.gold}💰${d.potions > 0 ? ` +${d.potions}🧪` : ""} !`));
    }
    persist(nextState);
    setModal({ k: "reward", reward: { outcome: won ? "win" : outcome === "lose" ? "lose" : "draw", loc, pStat, firstClear, levelsGained } });
  }

  function closeReward() {
    if (modal.k !== "reward") return;
    const r = modal.reward;
    const wonBoss = r.loc.isBoss && r.outcome === "win" && r.firstClear;
    const pendingBranch = gs.team.find(needsBranchChoice);
    if (wonBoss && !gs.capturedRare) setModal({ k: "capture" });
    else if (pendingBranch) setModal({ k: "branch", charId: pendingBranch.id });
    else if (gs.rental && gs.rental.fightsLeft <= 0) setModal({ k: "ranchExtend" });
    else setModal({ k: "none" });
  }

  /** Applique le choix de branche d'un AM (au palier ou depuis sa fiche). */
  function pickBranch(charId: string, branchId: string) {
    const team = gs.team.map((c) => (c.id === charId ? chooseBranch(c, branchId) : c));
    const next: GameState = { ...gs, team };
    persist(next);
    const c = team.find((x) => x.id === charId);
    const b = c ? branchDef(c.speciesId, branchId) : undefined;
    if (b) pushToast(`${b.icon} ${c!.name} se spécialise : ${b.name} !`);
    setModal({ k: "none" });
  }

  function captureRare() {
    const rare = makeCharacter(RARE_REWARD);
    persist({ ...gs, team: [...gs.team, rare], capturedRare: true, bestiary: gs.bestiary.includes(RARE_REWARD) ? gs.bestiary : [...gs.bestiary, RARE_REWARD] });
    setModal(gs.rental && gs.rental.fightsLeft <= 0 ? { k: "ranchExtend" } : { k: "none" });
  }

  // ── Journal du jour ───────────────────────────────────────────────────────
  function claimDailyBonus() {
    const { state, reward } = claimDaily(gs);
    persist(state);
    pushToast(`🎁 Bonus du jour : +${reward.gold}💰${reward.potions ? ` +${reward.potions}🧪` : ""} — ${reward.streak} jour${reward.streak > 1 ? "s" : ""} d'affilée !`);
  }
  async function resetGame() {
    try { await api.resetGameState(); } catch { /* ignore */ }
    setGs(freshState());
    setModal({ k: "none" });
    setRoute({ v: "house" });
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (!loaded) return <div className="game-shell"><div className="center-screen"><div className="spinner" /></div></div>;

  if (!gs.started || gs.team.length === 0) {
    // Filet de sécurité : un état corrompu/partiel (started=true mais équipe
    // vide, ex. reset interrompu) ne doit jamais afficher une page blanche —
    // on retombe sur l'onboarding plutôt que de rendre une House sans AM.
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
      <header className="mini-top">
        <button className="mini-logo" onClick={goHouse} aria-label="Accueil"><Icon name="home" size={20} /></button>
        <div className="mini-right">
          <span className="mini-purse">
            <span className="purse-item"><Icon name="gold" size={15} /> {gs.gold}</span>
            <span className="purse-item"><Icon name="potion" size={15} /> {gs.potions}</span>
          </span>
          <button
            className={`journal-btn ${hasDailyClaimable(gs) ? "attention" : ""}`}
            onClick={() => setModal({ k: "daily" })}
            aria-label="Journal du jour"
          >
            <Icon name="journal" size={18} />
            {hasDailyClaimable(gs) && <span className="notif-dot" />}
          </button>
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </header>

      {route.v === "house" && (
        <House
          team={gs.team}
          quests={questGlance(gs)}
          onOpenSheet={(id) => setModal({ k: "amPage", charId: id })}
          onOpenDaily={() => setModal({ k: "daily" })}
          onGoForest={() => setRoute({ v: "forest" })}
          onGoShop={goShop}
          onGoArena={goArena}
        />
      )}

      {route.v === "arena" && <Arena gs={gs} onBack={goHouse} onDuel={startDuel} />}

      {(route.v === "forest" || route.v === "zone") && (
        <div className="hub">
          <div className="team-strip">
            <div className="team-strip-title chip-ico"><Icon name="team" size={15} /> ÉQUIPE</div>
            <div className="team-strip-grid stagger">
              {gs.team.map((c) => (
                <TeamMini key={c.id} c={c} onSheet={() => setModal({ k: "amPage", charId: c.id })} onToggleHeal={() => toggleHeal(c.id)} />
              ))}
              {gs.rental && (
                <TeamMini c={gs.rental.char} rented={gs.rental.fightsLeft} onSheet={() => setModal({ k: "amPage", charId: gs.rental!.char.id })} onToggleHeal={() => toggleHeal(gs.rental!.char.id)} />
              )}
            </div>
          </div>

          {route.v === "forest" && (
            <>
              <button className="ghost sm zone-back chip-ico" onClick={goHouse}><Icon name="back" size={15} /> Maison</button>
              <WorldMap gs={gs} onEnter={goToZone} />
            </>
          )}
          {route.v === "zone" && (
            <ZoneScreen
              gs={gs}
              zone={zoneById(route.zoneId)}
              onBack={backToForest}
              onFight={startCombat}
              onToggleHeal={toggleHeal}
              onPotion={healPotion}
              onFull={healFullPaid}
              onOpenChat={openChat}
            />
          )}
        </div>
      )}

      {route.v === "shop" && (
        <BoutiqueScreen gold={gs.gold} potions={gs.potions} onBuy={buyPotion} onBack={goHouse} />
      )}

      {menuOpen && (
        <div className="hmenu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="hmenu-panel" onClick={(e) => e.stopPropagation()}>
            <button className="ghost sm hmenu-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><Icon name="close" size={16} /></button>
            <div className="hmenu-user">{user?.displayName || user?.username || "Dresseur"}</div>
            <div className="hmenu-purse chip-ico"><Icon name="gold" size={14} /> {gs.gold} <span className="dot">·</span> <Icon name="potion" size={14} /> {gs.potions}</div>
            <button className="hmenu-item chip-ico" onClick={() => { setModal({ k: "bestiary" }); setMenuOpen(false); }}><Icon name="bestiary" size={18} /> Bestiaire</button>
            <button className="hmenu-item chip-ico" onClick={() => { setModal({ k: "inventory" }); setMenuOpen(false); }}><Icon name="team" size={18} /> Équipe</button>
            <button
              className="hmenu-item danger chip-ico"
              onClick={() => {
                if (window.confirm("Réinitialiser ton compte ? Toute la progression (équipe, or, zones) sera perdue et tu referas l'onboarding depuis le début.")) {
                  resetGame();
                  setMenuOpen(false);
                }
              }}
            >
              <Icon name="reset" size={18} /> Réinitialiser le compte
            </button>
            <button className="hmenu-item danger chip-ico" onClick={() => logout()}><Icon name="power" size={18} /> Déconnexion</button>
          </div>
        </div>
      )}

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
            onChooseBranch={() => setModal({ k: "branch", charId: c.id })}
          />
        );
      })()}

      {modal.k === "branch" && (() => {
        const c = findChar(modal.charId);
        if (!c) return null;
        return <BranchModal c={c} onPick={(bid) => pickBranch(c.id, bid)} />;
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
                <button
                  className="ghost sm combat-flee chip-ico"
                  aria-label="Abandonner le combat"
                  title="Abandonner (aucun gain ni perte)"
                  onClick={() => { if (window.confirm("Abandonner ce combat ? Aucun gain ni perte.")) setModal({ k: "none" }); }}
                >
                  <Icon name="flee" size={15} /> Abandonner
                </button>
              </div>
            </div>
            <CombatView log={modal.ctx.result.log} speed={speed} onFinish={onCombatFinish} />
          </div>
        </div>
      )}

      {modal.k === "daily" && (
        <DailyJournal gs={gs} onClaimDaily={claimDailyBonus} onClose={() => setModal({ k: "none" })} />
      )}

      {modal.k === "duelReward" && (
        <div className="overlay">
          <div className="modal center">
            <h1>{modal.r.won ? "🏆 Duel remporté !" : "🤝 Duel perdu"}</h1>
            <p className="muted">
              {modal.r.won ? `Battu : ${modal.r.trainer}.` : `${modal.r.trainer} l'emporte.`}
            </p>
            {modal.r.won && modal.r.gold > 0 && <div className="loot-box"><p className="chip-ico"><Icon name="gold" size={16} /> +{modal.r.gold} or</p></div>}
            {modal.r.won && modal.r.gold === 0 && <p className="muted small">Récompenses du jour épuisées.</p>}
            <p className="muted small">Duel amical — AM indemne.</p>
            <button className="primary big" onClick={() => setModal({ k: "none" })}>Continuer</button>
          </div>
        </div>
      )}

      {modal.k === "reward" && <RewardModal reward={modal.reward} onContinue={closeReward} />}
      {modal.k === "capture" && <CaptureModal onCapture={captureRare} />}
      {modal.k === "ranchExtend" && gs.rental && (
        <RanchExtendModal species={SPECIES[gs.rental.char.speciesId].name} gold={gs.gold} onExtend={extendRental} onReturn={returnRental} />
      )}

      {allPacified && modal.k === "none" && (
        <div className="cleared-banner">🏆 Les trois zones sont pacifiées ! <button className="ghost sm" onClick={() => { if (window.confirm("Tout recommencer ? Ta progression sera définitivement perdue.")) resetGame(); }}>Recommencer</button></div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>

    </div>
  );
}

/** Résumé des quêtes du jour pour le rappel affiché sur la House. */
function questGlance(s: GameState): QuestGlance[] {
  const day = todayKey();
  const list = s.quests?.day === day ? s.quests.list : [];
  return list.map((q) => {
    const def = questDef(q.id);
    return { id: q.id, icon: def.icon, label: def.label, progress: q.progress, target: def.target, done: q.claimed || q.progress >= def.target };
  });
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

// Ennemi débilité du combat guidé : victoire garantie, combat court et lisible.
function makeTutorialEnemy(): Character {
  const base = makeCharacter("sprigling");
  return {
    ...base,
    id: "tuto-enemy",
    name: SPECIES["sprigling"]?.name ?? "Sauvageon",
    stats: { hp: 34, atk: 6, def: 1, spd: 5 },
    life: 34,
  };
}

const STAT_CARDS: { key: StatKey; icon: IconName; label: string; desc: string }[] = [
  { key: "hp", icon: "hp", label: "Vie", desc: "À 0, K.O." },
  { key: "atk", icon: "atk", label: "Force", desc: "Dégâts infligés." },
  { key: "def", icon: "def", label: "Armure", desc: "Réduit les dégâts subis." },
  { key: "spd", icon: "spd", label: "Vitesse", desc: "Agit plus souvent." },
];

// Onboarding en wizard : (0) choix du monstre, (1) lecture de sa fiche,
// (2) combat guidé avec bulles, (3) présentation du hub et de la boucle.
function Onboarding({ onPick }: { onPick: (id: string) => void }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [pick, setPick] = useState<string>(STARTERS[0]);
  const [fight, setFight] = useState<CombatResult | null>(null);
  const sp = SPECIES[pick];
  const hero = makeCharacter(pick);

  function beginFight() {
    const res = runCombat({ seed: 424242, teamA: [makeCharacter(pick)], teamB: [makeTutorialEnemy()] });
    setFight(res);
    setStep(2);
  }

  const TITLES = ["Choisis ton monstre", "Sa fiche", "Ton premier combat", "Ta maison"];

  return (
    <div className="onboard">
      <div className="ob-wizard">
        <div className="ob-head">
          <div className="ob-dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`ob-dot ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} />
            ))}
          </div>
          <div className="ob-step-title">{TITLES[step]}</div>
        </div>

        {step === 0 && (
          <div className="ob-panel">
            <p className="ob-lead">Ton monstre combat <b>tout seul</b>. Choisis-le bien.</p>
            <div className="starter-grid">
              {STARTERS.map((id) => {
                const s = SPECIES[id];
                const c = makeCharacter(id);
                return (
                  <div key={id} className={`starter-card ${pick === id ? "active" : ""}`} onClick={() => setPick(id)}>
                    <div className="starter-art" style={{ background: `radial-gradient(circle at 50% 40%, ${s.tint}33, transparent 70%)` }}>
                      <img src={`/sprites/${s.gfx}.png`} alt={s.name} />
                    </div>
                    <h3>{s.name}</h3>
                    <StatRow stats={c.stats} />
                    {s.innate && <div className="talent-chip" title={talentTooltip(s.innate)}>{TALENTS[s.innate]?.icon ?? "✨"} {talentName(s.innate)}<span className="talent-chip-desc">{TALENTS[s.innate]?.desc}</span></div>}
                  </div>
                );
              })}
            </div>
            <div className="ob-actions">
              <button className="ob-btn primary" onClick={() => setStep(1)}>Choisir {sp.name} →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="ob-panel">
            <div className="ob-hero">
              <div className="ob-hero-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}33, transparent 70%)` }}>
                <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
              </div>
              <div className="ob-hero-id">
                <h3>{sp.name}</h3>
                <RoleTag stats={hero.stats} className="ob-role" />
              </div>
            </div>
            <div className="ob-statcards">
              {STAT_CARDS.map((sc) => (
                <div key={sc.key} className="ob-statcard">
                  <div className="ob-statcard-top"><span className="ob-statcard-icon"><Icon name={sc.icon} size={18} /></span><b>{sc.label}</b><span className="ob-statcard-val">{hero.stats[sc.key]}</span></div>
                  <div className="ob-statcard-desc">{sc.desc}</div>
                </div>
              ))}
            </div>
            {sp.innate && (
              <div className="ob-talentcard">
                <span className="ob-statcard-icon">{TALENTS[sp.innate]?.icon ?? "✨"}</span>
                <div><b>{talentName(sp.innate)}</b> — {TALENTS[sp.innate]?.desc ?? "toujours actif"}. Se déclenche <b>seul</b>.</div>
              </div>
            )}
            <div className="ob-actions">
              <button className="ob-btn ghost" onClick={() => setStep(0)}>← Retour</button>
              <button className="ob-btn primary" onClick={beginFight}>Voir un combat →</button>
            </div>
          </div>
        )}

        {step === 2 && fight && (
          <div className="ob-panel ob-panel-fight">
            <p className="ob-lead">Tu ne pilotes rien : tout est automatique.</p>
            <CombatView log={fight.log} speed={1} tutorial onFinish={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="ob-panel">
            <p className="ob-lead"><b>La stratégie, c'est la préparation.</b></p>
            <div className="ob-loop">
              <div className="ob-loop-step"><span><Icon name="map" size={26} /></span>Explore</div>
              <div className="ob-loop-arrow">→</div>
              <div className="ob-loop-step"><span><Icon name="gold" size={26} /></span>Or &amp; XP</div>
              <div className="ob-loop-arrow">→</div>
              <div className="ob-loop-step"><span><Icon name="levelup" size={26} /></span>Renforce-toi</div>
            </div>
            <div className="ob-actions">
              <button className="ob-btn primary big" onClick={() => onPick(pick)}>Adopter {sp.name}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARTE DU MONDE
// ═══════════════════════════════════════════════════════════════════════════

function WorldMap({ gs, onEnter }: { gs: GameState; onEnter: (id: string) => void }) {
  const here = zoneById(gs.playerZone);
  const lead = gs.team[0];
  const leadSp = lead ? SPECIES[lead.speciesId] : null;
  const R = 46, C = 2 * Math.PI * R;
  const pctX = (x: number) => (x / MAP_WORLD_W) * 100;
  const pctY = (y: number) => (y / MAP_WORLD_H) * 100;

  return (
    <div className="world">
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
          const badge: { c: string; t: ReactNode } | null =
            !unlocked ? { c: "lock", t: <><Icon name="lock" size={12} /> Verrouillé</> }
            : threatened ? { c: "threat", t: <><Icon name="warn" size={12} /> Menace</> }
            : mood === "peaceful" && z.baseMood !== "peaceful" ? { c: "calm", t: <><Icon name="check" size={12} /> Pacifiée</> }
            : comp >= 0.75 && z.unlocks ? { c: "new", t: "✦ Suivante ouverte" }
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
              {badge && <span className={`zone-badge chip-ico ${badge.c}`}>{badge.t}</span>}
              <span className="zone-orb">
                {showRing && (
                  <svg className="zone-ring" viewBox="0 0 100 100" width="100%" height="100%">
                    <circle className="track" cx="50" cy="50" r={R} />
                    <circle className="prog" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - comp)} />
                  </svg>
                )}
                {unlocked ? z.icon : <Icon name="lock" size={30} />}
              </span>
              <span className="zone-label">
                <span className="zn">{z.name}</span>
              </span>
            </button>
          );
        })}

        {leadSp && (
          <img
            className="player-pin"
            src={`/sprites/${leadSp.gfx}.png`}
            alt="Toi"
            style={{ left: `${pctX(here.x)}%`, top: `${pctY(here.y)}%` }}
          />
        )}
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
  const moodLabelTxt: ReactNode =
    mood === "threatened" ? <><Icon name="warn" size={13} /> Zone menacée</>
    : mood === "exploration" ? <><Icon name="map" size={13} /> Exploration</>
    : <><Icon name="check" size={13} /> Zone paisible</>;

  return (
    <div className="zone-view">
      <button className="ghost sm zone-back chip-ico" onClick={onBack}><Icon name="back" size={15} /> Carte du monde</button>

      <div className="zone-hero" style={{ ["--zt" as any]: zone.tint }}>
        <div className="zh-icon">{zone.icon}</div>
        <div className="zone-name">{zone.name}</div>
        <div className="zh-sub">{zone.subtitle}</div>
        <span className={`zh-state chip-ico ${mood}`}>{moodLabelTxt}</span>

        {zone.winsToComplete > 0 && !zone.boss && (
          <div className="zone-progress">
            <div className="zp-bar"><div className="zp-fill" style={{ width: `${comp * 100}%` }} /></div>
            <div className="zp-meta">
              <span>{Math.round(comp * 100)}%</span>
              <span>{comp >= 0.75 ? "✦ Zone suivante ouverte" : `Plus que ${Math.ceil(0.75 * zone.winsToComplete - (gs.zoneProgress[zone.id] ?? 0))}`}</span>
            </div>
          </div>
        )}
      </div>

      <div className="zone-cols">
        {hasCombat ? (
          <ZoneCombat gs={gs} zone={zone} onFight={onFight} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
        ) : (
          <div className="card">
            <div className="card-title chip-ico"><Icon name="check" size={16} /> Havre de paix</div>
            <p className="muted small">Aucun combat ici — profite du calme.</p>
          </div>
        )}

        <div className="card">
          <div className="card-title chip-ico"><Icon name="chat" size={16} /> Personnages</div>
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

// ═══════════════════════════════════════════════════════════════════════════
// BOUTIQUE — page dédiée minimale (accessible depuis la House). Réutilise la
// même logique d'achat que le marchand PNJ (F2 : combats/boutique/etc réutilisés).
// ═══════════════════════════════════════════════════════════════════════════

function BoutiqueScreen({ gold, potions, onBuy, onBack }: {
  gold: number; potions: number; onBuy: () => void; onBack: () => void;
}) {
  return (
    <div className="screen boutique-screen view">
      <button className="ghost sm zone-back chip-ico" onClick={onBack}><Icon name="back" size={15} /> Maison</button>
      <div className="card boutique-card">
        <div className="card-title chip-ico" style={{ justifyContent: "center" }}><Icon name="shop" size={18} /> Boutique</div>
        <div className="boutique-icon"><Icon name="potion" size={46} /></div>
        <p className="muted small">Potion de soin — +50% PV</p>
        <p className="muted small chip-ico" style={{ justifyContent: "center" }}><Icon name="potion" size={13} /> {potions} <span className="dot">·</span> <Icon name="gold" size={13} /> {gold}</p>
        <button className="primary big chip-ico" disabled={gold < POTION_PRICE} onClick={onBuy} style={{ width: "100%", justifyContent: "center" }}>
          Acheter — {POTION_PRICE} <Icon name="gold" size={15} />
        </button>
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
  // Pas de choix d'ennemi : on présente automatiquement la première rencontre
  // non encore nettoyée (sinon la première), centrée à l'écran.
  const enc = encounters.find((e) => !isLocationCleared(gs, e.id)) ?? encounters[0];
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

  return (
    <div className="card">
      <div className="card-title chip-ico"><Icon name={zone.boss ? "boss" : "atk"} size={16} /> {zone.boss ? "Affrontement" : "Rencontres sauvages"}</div>

      <div className="enemy-preview centered">
        <img src={`/sprites/${sp.gfx}.png`} alt="ennemi" style={{ transform: `scale(${sp.size / 100})` }} />
        <div className="enemy-name">
          {sp.name} <span className="lvl">N.{enc.enemyLevel}</span>
          {enc.isBoss && <span className="boss-tag chip-ico"><Icon name="boss" size={11} /> BOSS</span>}
        </div>
        {enc.isBoss && gs.bossLife[enc.id] != null && <div className="boss-chip chip-ico"><Icon name="hp" size={12} /> Boss : {gs.bossLife[enc.id]} PV</div>}
      </div>

      {combatants.length > 1 ? (
        <>
          <h4 className="pick-title">Qui envoyer au combat ?</h4>
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
        </>
      ) : (
        chosen && (
          <div className="pick-list">
            <div className="pick-row">
              <img className="mini" src={`/sprites/${SPECIES[chosen.speciesId].gfx}.png`} alt={chosen.name} />
              <div className="pick-meta">
                <div className="team-name">{chosen.name} <span className="lvl">N.{chosen.level}</span></div>
                <HpBar c={chosen} />
              </div>
            </div>
          </div>
        )
      )}

      {chosen && currentLife(chosen) < chosen.stats.hp && (
        <HealControls c={chosen} gold={gs.gold} potions={gs.potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
      )}
      {enc.isBoss && <p className="hint chip-ico"><Icon name="warn" size={14} /> Coriace : s'il s'éternise, égalité (PV conservés).</p>}
      {ko ? <p className="warn chip-ico"><Icon name="warn" size={14} /> AM K.O. — soigne-le ou choisis-en un autre.</p> : (
        <button className="primary big chip-ico" style={{ width: "100%", marginTop: 12, justifyContent: "center" }} onClick={() => onFight(enc, pick)}><Icon name="atk" size={16} /> Combattre</button>
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
          <button className="ghost sm de-close" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
          <div className="de-emoji">{npc.emoji}</div>
          <div className="de-name">{npc.name}</div>
          <div className="de-title">{npc.title}</div>
        </div>
        <div className="de-main">
          {npc.role === "merchant" && (
            <div className="de-actions">
              <button className="de-action" disabled={gs.gold < POTION_PRICE} onClick={onBuy}>
                <span className="chip-ico"><Icon name="potion" size={16} /> Acheter une potion <span className="muted small">(+50% PV)</span></span>
                <span className="de-a-price chip-ico">{POTION_PRICE} <Icon name="gold" size={14} /></span>
              </button>
              <p className="muted small chip-ico"><Icon name="potion" size={13} /> {gs.potions} <span className="dot">·</span> <Icon name="gold" size={13} /> {gs.gold}</p>
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
                <span className="chip-ico"><Icon name="heal" size={16} /> Soigner toute l'équipe</span>
                <span className="de-a-price chip-ico">{HEAL_CENTER_COST} <Icon name="gold" size={14} /></span>
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
                  <button className="de-action" onClick={onReturn}><span className="chip-ico"><Icon name="return" size={16} /> Rendre le monstre</span></button>
                </>
              ) : (
                RANCH_OFFERS.map((o, i) => {
                  const sp = SPECIES[o.speciesId];
                  return (
                    <button key={o.speciesId} className="de-action" disabled={gs.gold < o.price} onClick={() => onRent(i)}>
                      <span>{sp.name} <span className="muted small">N.{o.level} · {o.fights} combats</span></span>
                      <span className="de-a-price chip-ico">{o.price} <Icon name="gold" size={14} /></span>
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
    <ModalShell title={<><Icon name="bestiary" size={18} /> Bestiaire — {known.size}/{all.length}</>} onClose={onClose} wide>
      <div className="bestiary">
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

function HealControls({ c, gold, potions, onToggleHeal, onPotion, onFull }: {
  c: Character; gold: number; potions: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
}) {
  const full = isFull(c);
  const healing = isHealing(c);
  const eta = healing ? Math.ceil(healEtaMs(c) / 1000) : 0;
  return (
    <div className="heal-row">
      <button className="chip-ico" disabled={full} onClick={() => onToggleHeal(c.id)} title={healing ? "Stopper le soin" : "Soin progressif gratuit"}>{healing ? <><Icon name="pause" size={14} /> {eta}s</> : <><Icon name="heal" size={14} /> Soin</>}</button>
      <button className="chip-ico" disabled={potions <= 0 || full} onClick={() => onPotion(c.id)} title="Utiliser une potion (+50% PV)"><Icon name="potion" size={14} /> {potions}</button>
      <button className="chip-ico" disabled={gold < FULL_HEAL_COST || full} onClick={() => onFull(c.id)} title={`Soin complet — ${FULL_HEAL_COST} or`}><Icon name="gold" size={14} /> {FULL_HEAL_COST}</button>
    </div>
  );
}

function TalentChips({ c }: { c: Character }) {
  const sp = SPECIES[c.speciesId];
  const ids = [sp.innate, ...activeTalents(c)].filter(Boolean) as string[];
  // dédoublonne (l'inné peut réapparaître dans une branche)
  return <TalentList ids={[...new Set(ids)]} />;
}

/** Bloc « Spécialisation » de la fiche : branche choisie, ou invitation à choisir. */
function BranchBlock({ c, onChoose }: { c: Character; onChoose: () => void }) {
  const branches = branchesOf(c.speciesId);
  if (branches.length === 0) return null;
  const chosen = branchDef(c.speciesId, c.branch);
  return (
    <div className="branch-block">
      <h4 className="block-title">Spécialisation</h4>
      {chosen ? (
        <div className="branch-current">
          <div className="branch-head"><span className="branch-ico">{chosen.icon}</span> <b>{chosen.name}</b></div>
          <p className="muted small">{chosen.desc}</p>
          <div className="branch-tiers">
            {chosen.tiers.map((t) => {
              const unlocked = c.level >= t.level;
              const td = TALENTS[t.talent];
              return (
                <span key={t.talent} className={`branch-tier ${unlocked ? "on" : "off"}`} title={talentTooltip(t.talent)}>
                  {unlocked ? "✓" : `N.${t.level}`} {td?.icon} {td?.name}
                </span>
              );
            })}
          </div>
        </div>
      ) : c.level >= BRANCH_CHOICE_LEVEL ? (
        <button className="primary sm" onClick={onChoose}>⚡ Choisir une spécialisation</button>
      ) : (
        <p className="muted small">Choix de spécialisation débloqué au niveau {BRANCH_CHOICE_LEVEL} (2 voies au choix).</p>
      )}
    </div>
  );
}

/** Modal de choix de branche : présente les 2 voies et leurs talents. */
function BranchModal({ c, onPick }: { c: Character; onPick: (branchId: string) => void }) {
  const branches = branchesOf(c.speciesId);
  return (
    <div className="overlay">
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>⚡ {c.name} se spécialise</h3>
        <p className="muted">Choisis sa voie — <b>irréversible</b>. Chaque voie débloque ses talents en montant de niveau.</p>
        <div className="branch-choices">
          {branches.map((b) => (
            <button key={b.id} className="branch-choice" onClick={() => onPick(b.id)}>
              <div className="branch-head"><span className="branch-ico">{b.icon}</span> <b>{b.name}</b></div>
              <p className="branch-desc">{b.desc}</p>
              <div className="branch-tiers">
                {b.tiers.map((t) => {
                  const td = TALENTS[t.talent];
                  return (
                    <span key={t.talent} className="branch-tier" title={talentTooltip(t.talent)}>
                      N.{t.level} · {td?.icon} {td?.name}
                    </span>
                  );
                })}
              </div>
            </button>
          ))}
        </div>
      </div>
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
      <button className="ghost sm heal-quick" onClick={(e) => { e.stopPropagation(); onToggleHeal(); }} disabled={isFull(c)} aria-label={isHealing(c) ? "Stopper le soin" : "Soigner"}>
        <Icon name={isHealing(c) ? "pause" : "heal"} size={15} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 className="chip-ico">{title}</h3><button className="ghost sm" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button></div>
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
    <ModalShell title={<><Icon name="team" size={18} /> Ton équipe</>} onClose={onClose} wide>
      <p className="muted small chip-ico">Ouvre une fiche pour entraîner. <span className="dot">·</span> <Icon name="gold" size={13} /> {gs.gold}</p>
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
      <h4 className="block-title">Interagir</h4>
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

function AmPage({ c, gold, potions, rentedFights, onToggleHeal, onPotion, onFull, onInteract, onClose, onChooseBranch }: {
  c: Character; gold: number; potions: number; rentedFights?: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onInteract: (id: string, k: InteractKind) => void; onClose: () => void; onChooseBranch: () => void;
}) {
  const sp = SPECIES[c.speciesId];
  const xpNext = xpForNext(c.level);
  const p = c.personality;
  return (
    <div className="am-page">
      <header className="am-page-top">
        <button className="ghost sm chip-ico" onClick={onClose}><Icon name="back" size={15} /> Retour</button>
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
            {p && <div className="am-trait">{p.emoji} {p.archetype}</div>}
            <div className="am-mood">Humeur : <strong>{moodLabel(c)}</strong></div>
            <HpBar c={c} />
            <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
            <div className="muted small">XP {c.xp}/{xpNext}</div>
          </div>
        </section>

        <div className="am-cols">
          <div className="am-col">
            <h4 className="block-title">Caractéristiques</h4>
            <div className="sheet-stats">
              {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
                <div key={k} className="sheet-stat"><span className="chip-ico"><Icon name={STAT_LABELS[k].icon} size={15} /> {STAT_LABELS[k].label}</span><strong>{c.stats[k]}</strong></div>
              ))}
            </div>
            <TalentChips c={c} />
            <BranchBlock c={c} onChoose={onChooseBranch} />
            <h4 className="block-title">Soins</h4>
            <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
            <InteractButtons c={c} onInteract={onInteract} />
          </div>

          <div className="am-col">
            <h4 className="block-title">Espèce</h4>
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
            <p className="loot-line">
              <span className="chip-ico"><Icon name="gold" size={15} /> +{firstClear ? loc.gold : Math.round((loc.gold ?? 0) / 2)}</span>
              {firstClear && !!loc.potions && <span className="chip-ico"><Icon name="potion" size={15} /> +{loc.potions}</span>}
              <span className="chip-ico"><Icon name="star" size={15} /> +{firstClear ? loc.xp : Math.round((loc.xp ?? 0) / 2)} XP</span>
            </p>
            {levelsGained > 0 && <p className="muted chip-ico"><Icon name="levelup" size={15} /> +{levelsGained} niveau(x) — stats augmentées.</p>}
            {!firstClear && <p className="muted small">Déjà nettoyé — gain réduit.</p>}
          </div>
        )}
        {outcome === "draw" && loc.isBoss && <p className="muted">Boss entamé, PV conservés. Retente.</p>}
        {outcome === "draw" && !loc.isBoss && <p className="muted">Match nul.</p>}
        {outcome === "lose" && <p className="muted">Vaincu. Petite pénalité d'or.</p>}
        <div className="stat-summary muted chip-ico" style={{ justifyContent: "center" }}><Icon name="atk" size={13} /> {pStat.damageDealt} <span className="dot">·</span> <Icon name="def" size={13} /> {pStat.damageTaken}</div>
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
          {sp.innate && <div className="talent-chip" title={talentTooltip(sp.innate)}>{TALENTS[sp.innate]?.icon ?? "✨"} {talentName(sp.innate)}<span className="talent-chip-desc">{TALENTS[sp.innate]?.desc}</span></div>}
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
        <div className="loot-box"><p className="chip-ico">Prolonger : +{RANCH_EXTEND.fights} combats — {RANCH_EXTEND.price} <Icon name="gold" size={15} /></p></div>
        <div className="heal-row">
          <button className="primary chip-ico" disabled={gold < RANCH_EXTEND.price} onClick={onExtend}>Prolonger ({RANCH_EXTEND.price} <Icon name="gold" size={14} />)</button>
          <button className="ghost" onClick={onReturn}>Rendre le monstre</button>
        </div>
      </div>
    </div>
  );
}
