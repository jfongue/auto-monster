// Progression (GDD 4.3) : XP, niveaux (jusqu'à 100). Les stats montent
// AUTOMATIQUEMENT à chaque niveau, en suivant les stats de base (pas de choix).
// Soin = régénération continue temps réel. Boost = stat payée en or (inventaire).

import type { Character, Stats, StatKey, InteractKind, SocialSource, HistoryEntry } from "./types";
import {
  SPECIES,
  MapLocation,
  HEAL_FULL_MS,
  makePersonality,
  MOOD_START,
  MOOD_MIN,
  MOOD_MAX,
  INTERACT_COOLDOWN_MS,
  branchDef,
  SOCIAL_MIN,
  SOCIAL_MAX,
  SOCIAL_START,
  COMBAT_SOCIAL_GAIN,
  COUPS_SOCIAL_SCALE,
} from "./data";
import { ensureTraits } from "./traits";

let uid = 0;
export function newId(prefix = "c"): string {
  return `${prefix}_${Date.now().toString(36)}_${(uid++).toString(36)}`;
}

const cloneStats = (s: Stats): Stats => ({ ...s });

/** XP nécessaire pour passer de `level` à `level+1`. */
export function xpForNext(level: number): number {
  return 30 + (level - 1) * 25;
}

/** Gain de stats appliqué à chaque montée de niveau (suit les stats de base). */
export function levelDelta(base: Stats): Stats {
  return {
    hp: Math.max(2, Math.round(base.hp * 0.18)),
    atk: Math.max(1, Math.round(base.atk * 0.12)),
    def: Math.max(1, Math.round(base.def * 0.1)),
    spd: Math.max(1, Math.round(base.spd * 0.05)),
  };
}

/** Stats théoriques d'une espèce à un niveau donné (base + deltas cumulés). */
export function statsForLevel(speciesId: string, level: number): Stats {
  const base = SPECIES[speciesId].baseStats;
  const d = levelDelta(base);
  const k = level - 1;
  return {
    hp: base.hp + d.hp * k,
    atk: base.atk + d.atk * k,
    def: base.def + d.def * k,
    spd: base.spd + d.spd * k,
  };
}

/** T007 — Stamina de base (placeholder uniforme ; par espèce via l'éditeur de bestiaire, T004). */
export const DEFAULT_STAMINA = 4;
/** T007 — Rang de base (toujours 1 tant que le 2v2/budget de rang, T010, n'est pas activé). */
export const DEFAULT_RANK = 1;

/** Crée un Character jouable niveau 1, avec un caractère unique. */
export function makeCharacter(speciesId: string, name?: string): Character {
  const sp = SPECIES[speciesId];
  const stats = cloneStats(sp.baseStats);
  const now = Date.now();
  const personality = makePersonality();
  const base: Character = {
    id: newId(),
    speciesId,
    name: name ?? sp.name,
    level: 1,
    xp: 0,
    life: stats.hp,
    stats,
    talents: [],
    healStart: null,
    capturedAt: now,
    personality,
    mood: MOOD_START,
    history: [{ t: now, kind: "capture", text: `Capturé·e — caractère ${personality.archetype} ${personality.emoji}` }],
    lastInteract: {},
    // T007 : nouveau modèle de progression (Rang/HP/Stamina) — HP reste stats.hp, atk/def/spd
    // restent présents pour compat engine/combat.ts (legacy) mais ne pilotent plus le combat réel.
    rank: DEFAULT_RANK,
    stamina: DEFAULT_STAMINA,
    traitPoints: 0,
  };
  // T008 : niveau 1 = un seul Trait actif (attaque simple, GDD 4.3).
  return ensureTraits(base, sp);
}

/** Stats d'un ennemi mises à l'échelle de son niveau. */
function scaleStats(base: Stats, level: number): Stats {
  const k = level - 1;
  return {
    hp: Math.round(base.hp * (1 + k * 0.22)),
    atk: Math.round(base.atk * (1 + k * 0.15)),
    def: Math.round(base.def * (1 + k * 0.12)),
    spd: Math.round(base.spd * (1 + k * 0.05)),
  };
}

/** Crée le Character ennemi d'un lieu de combat. */
export function makeEnemy(loc: MapLocation): Character {
  const speciesId = loc.enemySpecies!;
  const level = loc.enemyLevel ?? 1;
  const sp = SPECIES[speciesId];
  const stats = scaleStats(sp.baseStats, level);
  return {
    id: newId("e"),
    speciesId,
    name: sp.name,
    level,
    xp: 0,
    life: stats.hp,
    stats,
    talents: [],
    healStart: null,
    rank: DEFAULT_RANK,
    stamina: DEFAULT_STAMINA,
  };
}

/** Crée un Character jouable directement à un niveau donné (ranch, etc.). */
export function makeLeveledCharacter(speciesId: string, level: number, name?: string): Character {
  const c = makeCharacter(speciesId, name);
  if (level <= 1) return c;
  const stats = statsForLevel(speciesId, level);
  return { ...c, level, stats, life: stats.hp };
}

// ── Stats : application d'un delta ───────────────────────────────────────────
export function applyStats(stats: Stats, delta: Partial<Stats>): Stats {
  const out = cloneStats(stats);
  (Object.keys(delta) as StatKey[]).forEach((k) => {
    out[k] = Math.max(0, out[k] + (delta[k] ?? 0));
  });
  return out;
}

// ── Humeur (mood) ────────────────────────────────────────────────────────────
const clampMood = (m: number) => Math.max(MOOD_MIN, Math.min(MOOD_MAX, m));
export const moodOf = (c: Character) => clampMood(c.mood ?? MOOD_START);

// ── Barre sociale (T009, GDD 4.6) ───────────────────────────────────────────
const clampSocial = (v: number) => Math.max(SOCIAL_MIN, Math.min(SOCIAL_MAX, v));
export const socialOf = (c: Character) => clampSocial(c.social ?? SOCIAL_START);

/** Libellé de la barre sociale (lien AM ↔ joueur). */
export function socialLabel(c: Character): string {
  const s = socialOf(c);
  if (s >= 80) return "Complice 💞";
  if (s >= 60) return "Attaché·e 🙂";
  if (s >= 40) return "Neutre 😐";
  if (s >= 20) return "Distant·e 😕";
  return "Méfiant·e 💢";
}

/** Libellé d'humeur. */
export function moodLabel(c: Character): string {
  const m = moodOf(c);
  if (m >= 80) return "Radieux 😄";
  if (m >= 60) return "Content 🙂";
  if (m >= 40) return "Neutre 😐";
  if (m >= 20) return "Maussade 😕";
  return "Abattu 😣";
}

/**
 * Bonus/malus de combat lié à l'humeur (±10% atk/spd aux extrêmes).
 * Renvoie une copie du Character avec stats ajustées (pour le combat seulement).
 */
export function withMoodBattle(c: Character): Character {
  const k = (moodOf(c) - 50) / 50; // -1..+1
  const f = 1 + k * 0.1;
  return {
    ...c,
    stats: { ...c.stats, atk: Math.max(1, Math.round(c.stats.atk * f)), spd: Math.max(1, Math.round(c.stats.spd * f)) },
  };
}

/** Choisit (irréversiblement) une branche de spécialisation ; journalise. */
export function chooseBranch(c: Character, branchId: string, now = Date.now()): Character {
  const b = branchDef(c.speciesId, branchId);
  const next = { ...c, branch: branchId };
  return pushHistory(next, "levelup", `Spécialisation choisie : ${b?.icon ?? ""} ${b?.name ?? branchId}`, now);
}

/** Ajoute une entrée d'historique (cap à 40 entrées). */
export function pushHistory(c: Character, kind: HistoryEntry["kind"], text: string, now = Date.now()): Character {
  const hist = [{ t: now, kind, text }, ...(c.history ?? [])].slice(0, 40);
  return { ...c, history: hist };
}

// ── Interactions sociales (gratuit, aléatoire selon le caractère) ─────────────
export const interactReadyIn = (c: Character, kind: InteractKind, now = Date.now()): number =>
  Math.max(0, (c.lastInteract?.[kind] ?? 0) + INTERACT_COOLDOWN_MS - now);

export type InteractResult = { character: Character; text: string; good: boolean; moodDelta: number; socialDelta: number };

/** T009 — dimensions d'affinité que l'action "observer" peut révéler (hors observer lui-même). */
type HintDim = "caresser" | "coacher" | "jouets" | "coups";
const HINT_TEXT: Record<HintDim, { pos: string; mildPos: string; mildNeg: string; neg: string }> = {
  caresser: {
    pos: "adore les câlins",
    mildPos: "apprécie plutôt les câlins",
    mildNeg: "n'est pas spécialement fan des caresses",
    neg: "déteste qu'on le/la touche",
  },
  coacher: {
    pos: "adore qu'on le/la pousse à l'entraînement",
    mildPos: "apprécie plutôt l'entraînement",
    mildNeg: "n'est pas très motivé·e à l'entraînement",
    neg: "déteste qu'on le/la pousse à l'entraînement",
  },
  jouets: {
    pos: "raffole des jouets",
    mildPos: "aime bien recevoir des jouets",
    mildNeg: "se désintéresse un peu des jouets",
    neg: "ignore complètement les jouets",
  },
  coups: {
    pos: "semble tirer une certaine fierté à encaisser des coups",
    mildPos: "supporte plutôt bien les coups reçus au combat",
    mildNeg: "n'aime pas trop encaisser des coups",
    neg: "déteste par-dessus tout encaisser des coups",
  },
};

/** Choisit la dimension d'affinité la plus marquée (positive ou négative) et la phrase. */
function affinityHint(c: Character): string {
  const aff = c.personality?.affinity;
  const dims: HintDim[] = ["caresser", "coacher", "jouets", "coups"];
  let best: HintDim = dims[0];
  let bestMag = -1;
  for (const d of dims) {
    const m = Math.abs(aff?.[d] ?? 0);
    if (m > bestMag) { bestMag = m; best = d; }
  }
  const v = aff?.[best] ?? 0;
  const bank = HINT_TEXT[best];
  const phrase = v >= 0.5 ? bank.pos : v >= 0.15 ? bank.mildPos : v <= -0.5 ? bank.neg : bank.mildNeg;
  return `${c.name} ${phrase}.`;
}

/**
 * Résout une interaction. L'issue dépend de l'affinité de l'INDIVIDU pour
 * cette action + de l'aléatoire. Effets : humeur (toujours), parfois un petit
 * gain/perte de stat permanent (coacher) ou un soin léger, et la barre sociale
 * (T009, GDD 4.6) : caresser monte toujours (+ fort si aimé), coacher monte ou
 * baisse selon l'individu, observer ne la change pas mais révèle un indice.
 */
export function interact(c: Character, kind: InteractKind, now = Date.now(), rand: () => number = Math.random): InteractResult {
  const aff = c.personality?.affinity[kind] ?? 0;
  const score = (rand() - 0.5) + aff * 0.6; // >0 ⇒ positif
  const good = score > 0;
  const mag = Math.min(1, Math.abs(score));
  let mood = moodOf(c);
  let social = socialOf(c);
  let stats = c.stats;
  let life = c.life;
  let text = "";
  const name = c.name;

  if (kind === "caresser") {
    const sd = good ? 3 + Math.round(mag * 5) : 1 + Math.round(mag * 1);
    social += sd;
    if (good) { const d = 8 + Math.round(mag * 10); mood += d; text = `${name} se blottit et ronronne. (+${d} humeur)`; return finalize(d, sd); }
    const d = -(6 + Math.round(mag * 8)); mood += d; text = `${name} se dérobe, agacé·e. (${d} humeur)`; return finalize(d, sd);
  }
  if (kind === "coacher") {
    if (good) {
      const keys: StatKey[] = ["atk", "def", "spd"];
      const stat = keys[Math.floor(rand() * keys.length)];
      const gain = 1 + Math.round(mag * 2);
      stats = applyStats(c.stats, { [stat]: gain });
      const d = 4 + Math.round(mag * 5); mood += d;
      const sd = 2 + Math.round(mag * 4); social += sd;
      text = `Bon entraînement ! ${STAT_NAME[stat]} +${gain}. (+${d} humeur)`;
      return finalize(d, sd);
    }
    const d = -(7 + Math.round(mag * 8)); mood += d;
    const sd = -(2 + Math.round(mag * 4)); social += sd;
    text = `${name} se braque et boude la séance. (${d} humeur)`; return finalize(d, sd);
  }
  // observer : ne change pas la barre sociale, révèle un indice sur les préférences.
  if (good) {
    const d = 4 + Math.round(mag * 6); mood += d;
    const heal = Math.round(c.stats.hp * 0.05);
    life = Math.min(c.stats.hp, Math.round(currentLife(c, now)) + heal);
    text = `${affinityHint(c)} (+${d} humeur, repos +${heal} PV)`;
    return finalize(d, 0);
  }
  const d = -(3 + Math.round(mag * 5)); mood += d;
  text = `${affinityHint(c)} (${d} humeur)`;
  return finalize(d, 0);

  function finalize(moodDelta: number, socialDelta: number): InteractResult {
    const md = clampMood(mood) - moodOf(c);
    const sd = clampSocial(social) - socialOf(c);
    let next: Character = {
      ...c,
      stats,
      life: Math.min(stats.hp, life),
      mood: clampMood(mood),
      social: clampSocial(social),
      lastInteract: { ...(c.lastInteract ?? {}), [kind]: now },
      healStart: null,
    };
    next = pushHistory(next, "interact", text, now);
    return { character: next, text, good, moodDelta: md, socialDelta: sd };
  }
}

/**
 * T009 — donne un jouet à l'AM (item consommable, décompté par l'appelant).
 * "Monte" toujours la barre sociale (GDD 4.6), magnitude selon l'affinité "jouets".
 */
export function giveToy(c: Character, now = Date.now(), rand: () => number = Math.random): InteractResult {
  const aff = c.personality?.affinity.jouets ?? 0;
  const score = (rand() - 0.5) + aff * 0.6;
  const good = score > 0;
  const mag = Math.min(1, Math.abs(score));
  const sd = good ? 4 + Math.round(mag * 6) : 1 + Math.round(mag * 1);
  const social = clampSocial(socialOf(c) + sd);
  const d = good ? 3 + Math.round(mag * 4) : 0;
  const mood = clampMood(moodOf(c) + d);
  const text = good
    ? `${c.name} s'amuse à fond avec son nouveau jouet ! (+${sd} lien)`
    : `${c.name} regarde le jouet d'un œil distrait. (+${sd} lien)`;
  let next: Character = { ...c, mood, social, healStart: null };
  next = pushHistory(next, "interact", text, now);
  return { character: next, text, good, moodDelta: mood - moodOf(c), socialDelta: social - socialOf(c) };
}

/**
 * T009 — effets combat sur la barre sociale : "combattre" (participation, flat,
 * indépendant du résultat) + "coups encaissés" (signé selon affinité "coups" et
 * fraction de PV perdus). Appelé après chaque combat réel (hors duels d'arène —
 * scope volontairement limité, voir résultats de tâche).
 */
export function registerCombatSocial(c: Character, dmgTakenFrac: number): Character {
  const aff = c.personality?.affinity.coups ?? 0;
  const frac = Math.max(0, Math.min(1, dmgTakenFrac));
  const coupsDelta = Math.round(aff * COUPS_SOCIAL_SCALE * frac);
  const social = clampSocial(socialOf(c) + COMBAT_SOCIAL_GAIN + coupsDelta);
  return { ...c, social };
}

const STAT_NAME: Record<StatKey, string> = { hp: "PV", atk: "ATK", def: "DEF", spd: "VIT" };

// ── Soin continu (régénération temps réel) ──────────────────────────────────
/** PV/ms d'un AM (0 → max en HEAL_FULL_MS). */
function healRate(c: Character): number {
  return c.stats.hp / HEAL_FULL_MS;
}

/** PV effectifs maintenant (tient compte d'un soin en cours). */
export function currentLife(c: Character, now = Date.now()): number {
  if (c.healStart == null) return Math.min(c.stats.hp, Math.max(0, c.life));
  const gained = healRate(c) * (now - c.healStart);
  return Math.min(c.stats.hp, Math.max(0, c.life + gained));
}

export const isFull = (c: Character) => currentLife(c) >= c.stats.hp;
export const isHealing = (c: Character) => c.healStart != null && !isFull(c);

/** Lance un soin progressif (si pas déjà plein). */
export function startHeal(c: Character, now = Date.now()): Character {
  if (currentLife(c, now) >= c.stats.hp) return { ...c, life: c.stats.hp, healStart: null };
  return { ...c, life: Math.round(currentLife(c, now)), healStart: now };
}

/** Fige les PV courants et stoppe le soin (à appeler avant un combat). */
export function commitHeal(c: Character, now = Date.now()): Character {
  return { ...c, life: Math.round(currentLife(c, now)), healStart: null };
}

/** ms restantes avant PV pleins (0 si déjà plein ou pas en soin). */
export function healEtaMs(c: Character, now = Date.now()): number {
  if (c.healStart == null) return 0;
  const missing = c.stats.hp - currentLife(c, now);
  return Math.max(0, missing / healRate(c));
}

// ── Gain d'XP → montée de niveau AUTOMATIQUE (stats suivent la base) ──────────
export type XpResult = {
  character: Character; // xp/level ET stats déjà mis à jour
  gained: number;
  levelsGained: number;
  hpGained: number;
};

export function addXp(c0: Character, amount: number): XpResult {
  // T008 : bootstrap discret des Character antérieurs à T008 (sans Trait actif équipé).
  const c = ensureTraits(c0, SPECIES[c0.speciesId]);
  let { level, xp } = c;
  let stats = cloneStats(c.stats);
  let life = Math.round(currentLife(c));
  const base = SPECIES[c.speciesId].baseStats;
  const d = levelDelta(base);
  let levelsGained = 0;
  let hpGained = 0;

  xp += amount;
  while (level < 100 && xp >= xpForNext(level)) {
    xp -= xpForNext(level);
    level += 1;
    levelsGained += 1;
    stats = applyStats(stats, d);
    life += d.hp; // la montée de niveau soigne du gain de PV
    hpGained += d.hp;
  }
  life = Math.min(stats.hp, life);
  return {
    // T008 : chaque niveau gagné banque un crédit de draft de Traits (résolu via l'UI).
    character: { ...c, level, xp, stats, life, healStart: null, traitPoints: (c.traitPoints ?? 0) + levelsGained },
    gained: amount,
    levelsGained,
    hpGained,
  };
}
