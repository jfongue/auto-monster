// État de jeu persisté. Sérialisable en JSON.
// Monde à zones : le joueur voyage entre des zones (playerZone), explore,
// fait grimper un taux de complétion, débloque de nouvelles zones et un boss.

import type { Character } from "./engine/types";
import { COMBAT_LOCATIONS, START_LOC, makePersonality, MOOD_START, START_ZONE, zoneById } from "./engine/data";

export const GAME_VERSION = 6;

/** Monstre loué au ranch : un Character + nb de combats restants. */
export type Rental = { char: Character; fightsLeft: number };

/** Quête quotidienne : progression + réclamation. */
export type QuestState = { id: string; progress: number; claimed: boolean };
export type DailyQuests = { day: string; list: QuestState[] };

export type GameState = {
  version: number;
  started: boolean; // a adopté un premier AM
  team: Character[]; // auto monsters possédés
  gold: number;
  potions: number;
  cleared: string[]; // ids des lieux de combat déjà vaincus (récompense unique)
  bossLife: Record<string, number>; // PV persistants des boss entamés, par lieu
  capturedRare: boolean;
  playerLoc: string; // (compat) lieu de combat courant dans la zone
  playerZone: string; // zone où se trouve le joueur
  rental: Rental | null; // monstre loué au ranch
  // ── Refonte "monde à zones" ──
  bestiary: string[]; // ids d'espèces rencontrées (bestiaire / pokédex)
  zoneProgress: Record<string, number>; // victoires cumulées par zone
  zonesUnlocked: string[]; // zones accessibles sur la carte
  bossDefeated: string[]; // ids de zones dont le boss est vaincu (→ paisibles)
  // ── Boucle quotidienne (v6) ──
  lastSeen: number; // dernier passage (repos hors-ligne)
  dailyDay: string | null; // dernier jour où le bonus quotidien a été réclamé
  dailyStreak: number; // jours consécutifs
  quests: DailyQuests | null; // quêtes du jour
  duels: { day: string; wins: number }; // victoires d'arène du jour (récompensées)
};

export function freshState(): GameState {
  return {
    version: GAME_VERSION,
    started: false,
    team: [],
    gold: 0,
    potions: 0,
    cleared: [],
    bossLife: {},
    capturedRare: false,
    playerLoc: START_LOC,
    playerZone: START_ZONE,
    rental: null,
    bestiary: [],
    zoneProgress: {},
    zonesUnlocked: [START_ZONE, "vallee"],
    bossDefeated: [],
    lastSeen: Date.now(),
    dailyDay: null,
    dailyStreak: 0,
    quests: null,
    duels: { day: "", wins: 0 },
  };
}

/** Backfill des champs d'identité individuelle sur un Character chargé. */
function migrateChar(c: Character): Character {
  if (c.personality && c.capturedAt) return c;
  return {
    ...c,
    capturedAt: c.capturedAt ?? Date.now(),
    personality: c.personality ?? makePersonality(),
    mood: c.mood ?? MOOD_START,
    history: c.history ?? [{ t: Date.now(), kind: "capture", text: "Rejoint l'équipe." }],
    lastInteract: c.lastInteract ?? {},
  };
}

/** Normalise un état chargé (compat anciennes versions). */
export function migrate(s: Partial<GameState> | null | undefined): GameState {
  const base = freshState();
  if (!s) return base;
  return {
    ...base,
    ...s,
    team: (s.team ?? []).map(migrateChar),
    rental: s.rental ? { ...s.rental, char: migrateChar(s.rental.char) } : null,
    playerLoc: s.playerLoc ?? START_LOC,
    playerZone: s.playerZone ?? START_ZONE,
    bossLife: s.bossLife ?? {},
    cleared: s.cleared ?? [],
    bestiary: s.bestiary ?? [],
    zoneProgress: s.zoneProgress ?? {},
    zonesUnlocked: s.zonesUnlocked && s.zonesUnlocked.length ? s.zonesUnlocked : base.zonesUnlocked,
    bossDefeated: s.bossDefeated ?? [],
    lastSeen: s.lastSeen ?? Date.now(),
    dailyDay: s.dailyDay ?? null,
    dailyStreak: s.dailyStreak ?? 0,
    quests: s.quests ?? null,
    duels: s.duels ?? { day: "", wins: 0 },
    version: GAME_VERSION,
  };
}

export const isLocationCleared = (s: GameState, id: string) => s.cleared.includes(id);
export const allCleared = (s: GameState) => COMBAT_LOCATIONS.every((l) => s.cleared.includes(l.id));

// ── Complétion & état des zones ──────────────────────────────────────────────

const UNLOCK_THRESHOLD = 0.75; // 75% → débloque la zone suivante

/** Taux de complétion 0..1 d'une zone (victoires cumulées / objectif). */
export function zoneCompletion(s: GameState, zoneId: string): number {
  const z = zoneById(zoneId);
  const target = z.winsToComplete || 1;
  const wins = s.zoneProgress[zoneId] ?? 0;
  return Math.max(0, Math.min(1, wins / target));
}

/** Le boss de la zone est-il vaincu → zone pacifiée ? */
export const isZonePacified = (s: GameState, zoneId: string): boolean =>
  s.bossDefeated.includes(zoneId);

/** État courant d'une zone selon la progression. */
export function zoneMood(s: GameState, zoneId: string): "peaceful" | "exploration" | "threatened" {
  const z = zoneById(zoneId);
  if (z.baseMood === "peaceful") return "peaceful";
  if (z.baseMood === "threatened") return isZonePacified(s, zoneId) ? "peaceful" : "threatened";
  // exploration : reste exploration (elle se "termine" mais reste explorable)
  return "exploration";
}

/** Une zone est-elle accessible sur la carte ? */
export const isZoneUnlocked = (s: GameState, zoneId: string): boolean =>
  s.zonesUnlocked.includes(zoneId);

/**
 * Enregistre une victoire dans une zone : incrémente la complétion et
 * débloque la zone suivante au passage du seuil. Renvoie le nouvel état.
 */
export function registerZoneWin(s: GameState, zoneId: string): GameState {
  const z = zoneById(zoneId);
  const wins = (s.zoneProgress[zoneId] ?? 0) + 1;
  const next: GameState = { ...s, zoneProgress: { ...s.zoneProgress, [zoneId]: wins } };
  if (z.unlocks && wins / (z.winsToComplete || 1) >= UNLOCK_THRESHOLD && !next.zonesUnlocked.includes(z.unlocks)) {
    next.zonesUnlocked = [...next.zonesUnlocked, z.unlocks];
  }
  return next;
}

/** Ajoute une espèce au bestiaire (sans doublon). */
export function recordBestiary(s: GameState, speciesId: string): GameState {
  if (s.bestiary.includes(speciesId)) return s;
  return { ...s, bestiary: [...s.bestiary, speciesId] };
}

// ═══════════════════════════════════════════════════════════════════════════
// BOUCLE QUOTIDIENNE — bonus journalier, quêtes du jour, repos hors-ligne,
// duels d'arène. Tout est calculé côté client sur l'état persisté.
// ═══════════════════════════════════════════════════════════════════════════

/** Clé du jour local, ex. "2026-07-12". */
export function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const dayOffset = (key: string, days: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + days));
};

// ── Bonus quotidien + streak ────────────────────────────────────────────────

export type DailyReward = { gold: number; potions: number; streak: number };

/** Récompense du jour selon le streak (paliers doux, potion tous les 3 jours). */
export function dailyRewardFor(streak: number): DailyReward {
  const gold = 15 + Math.min(35, (streak - 1) * 5);
  const potions = streak % 3 === 0 ? 1 : 0;
  return { gold, potions, streak };
}

export const canClaimDaily = (s: GameState, day = todayKey()): boolean => s.dailyDay !== day;

/** Réclame le bonus du jour ; renvoie l'état + le détail de la récompense. */
export function claimDaily(s: GameState, day = todayKey()): { state: GameState; reward: DailyReward } {
  const streak = s.dailyDay === dayOffset(day, -1) ? s.dailyStreak + 1 : 1;
  const reward = dailyRewardFor(streak);
  return {
    state: { ...s, dailyDay: day, dailyStreak: streak, gold: s.gold + reward.gold, potions: s.potions + reward.potions },
    reward,
  };
}

// ── Quêtes du jour ──────────────────────────────────────────────────────────

export type QuestKind = "win" | "interact" | "duel";
export type QuestDef = {
  id: string; kind: QuestKind; target: number;
  label: string; icon: string;
  gold: number; potions: number;
};

export const QUEST_DEFS: QuestDef[] = [
  { id: "q_wins", kind: "win", target: 3, label: "Gagner 3 combats", icon: "⚔️", gold: 30, potions: 0 },
  { id: "q_care", kind: "interact", target: 3, label: "Interagir 3 fois avec tes AM", icon: "💞", gold: 20, potions: 0 },
  { id: "q_duel", kind: "duel", target: 1, label: "Gagner un duel d'arène", icon: "🏟️", gold: 25, potions: 1 },
];

export const questDef = (id: string): QuestDef => QUEST_DEFS.find((q) => q.id === id)!;

/** Garantit des quêtes fraîches pour aujourd'hui (reset au changement de jour). */
export function ensureDaily(s: GameState, day = todayKey()): GameState {
  if (s.quests?.day === day && s.duels.day === day) return s;
  const quests: DailyQuests =
    s.quests?.day === day
      ? s.quests
      : { day, list: QUEST_DEFS.map((q) => ({ id: q.id, progress: 0, claimed: false })) };
  const duels = s.duels.day === day ? s.duels : { day, wins: 0 };
  return { ...s, quests, duels };
}

/**
 * Avance les quêtes d'un type. Les quêtes qui se complètent sont
 * **auto-réclamées** : la récompense (or/potions) est créditée immédiatement,
 * sans étape de claim manuel dans le journal. Renvoie les quêtes complétées
 * pour que l'UI affiche le feedback (toast).
 */
export function bumpQuest(s: GameState, kind: QuestKind, amount = 1): { state: GameState; completed: QuestDef[] } {
  const st = ensureDaily(s);
  const completed: QuestDef[] = [];
  let gold = 0, potions = 0;
  const list = st.quests!.list.map((q) => {
    const def = questDef(q.id);
    if (def.kind !== kind || q.claimed) return q;
    const progress = Math.min(def.target, q.progress + amount);
    if (progress >= def.target) {
      completed.push(def);
      gold += def.gold;
      potions += def.potions;
      return { ...q, progress, claimed: true };
    }
    return { ...q, progress };
  });
  return {
    state: { ...st, gold: st.gold + gold, potions: st.potions + potions, quests: { ...st.quests!, list } },
    completed,
  };
}

/** Y a-t-il quelque chose à réclamer (bonus du jour ou quête finie) ? */
export function hasDailyClaimable(s: GameState, day = todayKey()): boolean {
  if (canClaimDaily(s, day)) return true;
  const list = s.quests?.day === day ? s.quests.list : [];
  return list.some((q) => !q.claimed && q.progress >= questDef(q.id).target);
}

// ── Repos hors-ligne ────────────────────────────────────────────────────────

export const REST_FULL_MS = 6 * 60 * 60 * 1000; // PV 0 → max en ~6h d'absence
const MOOD_REST_TARGET = 60;

export type RestReport = { healedHp: number; moodUp: boolean; elapsedMs: number };

/**
 * Applique le repos accumulé pendant l'absence : PV régénérés au prorata du
 * temps écoulé, humeur qui dérive doucement vers un niveau serein.
 */
export function applyOfflineRest(s: GameState, now = Date.now()): { state: GameState; report: RestReport } {
  const elapsed = Math.max(0, now - (s.lastSeen ?? now));
  if (elapsed < 10 * 60 * 1000) return { state: { ...s, lastSeen: now }, report: { healedHp: 0, moodUp: false, elapsedMs: elapsed } };
  let healedHp = 0;
  let moodUp = false;
  const moodDrift = Math.min(20, Math.floor(elapsed / (30 * 60 * 1000)) * 2); // +2 / 30 min, cap 20
  const rest = (c: Character): Character => {
    const gain = Math.round(c.stats.hp * Math.min(1, elapsed / REST_FULL_MS));
    const life = Math.min(c.stats.hp, Math.max(0, c.life) + gain);
    healedHp += Math.max(0, life - Math.max(0, c.life));
    let mood = c.mood ?? MOOD_REST_TARGET;
    if (mood < MOOD_REST_TARGET) {
      mood = Math.min(MOOD_REST_TARGET, mood + moodDrift);
      if (moodDrift > 0) moodUp = true;
    }
    return { ...c, life, mood, healStart: null };
  };
  return {
    state: {
      ...s,
      lastSeen: now,
      team: s.team.map(rest),
      rental: s.rental ? { ...s.rental, char: rest(s.rental.char) } : null,
    },
    report: { healedHp, moodUp, elapsedMs: elapsed },
  };
}

// ── Arène (duels asynchrones) ───────────────────────────────────────────────

export const ARENA_MAX_REWARDED_WINS = 3; // victoires récompensées / jour
export const ARENA_WIN_GOLD = 20;

export const arenaWinsToday = (s: GameState, day = todayKey()): number =>
  s.duels.day === day ? s.duels.wins : 0;
