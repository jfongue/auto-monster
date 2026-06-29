// Progression (GDD 4.3) : XP, niveaux (jusqu'à 100). Les stats montent
// AUTOMATIQUEMENT à chaque niveau, en suivant les stats de base (pas de choix).
// Soin = régénération continue temps réel. Boost = stat payée en or (inventaire).

import type { Character, Stats, StatKey, InteractKind, HistoryEntry } from "./types";
import {
  SPECIES,
  MapLocation,
  HEAL_FULL_MS,
  makePersonality,
  MOOD_START,
  MOOD_MIN,
  MOOD_MAX,
  INTERACT_COOLDOWN_MS,
} from "./data";

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
    sta: Math.max(0, Math.round(base.sta * 0.08)),
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
    sta: base.sta + d.sta * k,
  };
}

/** Crée un Character jouable niveau 1, avec un caractère unique. */
export function makeCharacter(speciesId: string, name?: string): Character {
  const sp = SPECIES[speciesId];
  const stats = cloneStats(sp.baseStats);
  const now = Date.now();
  const personality = makePersonality();
  return {
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
  };
}

/** Stats d'un ennemi mises à l'échelle de son niveau. */
function scaleStats(base: Stats, level: number): Stats {
  const k = level - 1;
  return {
    hp: Math.round(base.hp * (1 + k * 0.22)),
    atk: Math.round(base.atk * (1 + k * 0.15)),
    def: Math.round(base.def * (1 + k * 0.12)),
    spd: Math.round(base.spd * (1 + k * 0.05)),
    sta: base.sta,
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

/** Ajoute une entrée d'historique (cap à 40 entrées). */
export function pushHistory(c: Character, kind: HistoryEntry["kind"], text: string, now = Date.now()): Character {
  const hist = [{ t: now, kind, text }, ...(c.history ?? [])].slice(0, 40);
  return { ...c, history: hist };
}

// ── Interactions sociales (gratuit, aléatoire selon le caractère) ─────────────
export const interactReadyIn = (c: Character, kind: InteractKind, now = Date.now()): number =>
  Math.max(0, (c.lastInteract?.[kind] ?? 0) + INTERACT_COOLDOWN_MS - now);

export type InteractResult = { character: Character; text: string; good: boolean; moodDelta: number };

/**
 * Résout une interaction. L'issue dépend de l'affinité de l'INDIVIDU pour
 * cette action + de l'aléatoire. Effets : humeur (toujours), et parfois un
 * petit gain/perte de stat permanent (coacher) ou un soin léger.
 */
export function interact(c: Character, kind: InteractKind, now = Date.now(), rand: () => number = Math.random): InteractResult {
  const aff = c.personality?.affinity[kind] ?? 0;
  const score = (rand() - 0.5) + aff * 0.6; // >0 ⇒ positif
  const good = score > 0;
  const mag = Math.min(1, Math.abs(score));
  let mood = moodOf(c);
  let stats = c.stats;
  let life = c.life;
  let text = "";
  const name = c.name;

  if (kind === "caresser") {
    if (good) { const d = 8 + Math.round(mag * 10); mood += d; text = `${name} se blottit et ronronne. (+${d} humeur)`; return finalize(d); }
    const d = -(6 + Math.round(mag * 8)); mood += d; text = `${name} se dérobe, agacé·e. (${d} humeur)`; return finalize(d);
  }
  if (kind === "coacher") {
    if (good) {
      const keys: StatKey[] = ["atk", "def", "spd", "sta"];
      const stat = keys[Math.floor(rand() * keys.length)];
      const gain = 1 + Math.round(mag * 2);
      stats = applyStats(c.stats, { [stat]: gain });
      const d = 4 + Math.round(mag * 5); mood += d;
      text = `Bon entraînement ! ${STAT_NAME[stat]} +${gain}. (+${d} humeur)`;
      return finalize(d);
    }
    const d = -(7 + Math.round(mag * 8)); mood += d; text = `${name} se braque et boude la séance. (${d} humeur)`; return finalize(d);
  }
  // observer
  if (good) {
    const d = 4 + Math.round(mag * 6); mood += d;
    const heal = Math.round(c.stats.hp * 0.05);
    life = Math.min(c.stats.hp, Math.round(currentLife(c, now)) + heal);
    text = `Tu cernes mieux ${name}. (+${d} humeur, repos +${heal} PV)`;
    return finalize(d);
  }
  const d = -(3 + Math.round(mag * 5)); mood += d; text = `${name} se sent épié·e et se ferme. (${d} humeur)`;
  return finalize(d);

  function finalize(moodDelta: number): InteractResult {
    const md = clampMood(mood) - moodOf(c);
    let next: Character = {
      ...c,
      stats,
      life: Math.min(stats.hp, life),
      mood: clampMood(mood),
      lastInteract: { ...(c.lastInteract ?? {}), [kind]: now },
      healStart: null,
    };
    next = pushHistory(next, "interact", text, now);
    return { character: next, text, good, moodDelta: md };
  }
}

const STAT_NAME: Record<StatKey, string> = { hp: "PV", atk: "ATK", def: "DEF", spd: "VIT", sta: "STA" };

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

export function addXp(c: Character, amount: number): XpResult {
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
    character: { ...c, level, xp, stats, life, healStart: null },
    gained: amount,
    levelsGained,
    hpGained,
  };
}
