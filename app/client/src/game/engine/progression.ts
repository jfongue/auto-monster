// Progression (GDD 4.3) : XP, niveaux (jusqu'à 100). Les stats montent
// AUTOMATIQUEMENT à chaque niveau, en suivant les stats de base (pas de choix).
// Soin = régénération continue temps réel. Boost = stat payée en or (inventaire).

import type { Character, Stats, StatKey } from "./types";
import { SPECIES, MapLocation, HEAL_FULL_MS, BOOST_AMOUNT } from "./data";

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

/** Crée un Character jouable niveau 1. */
export function makeCharacter(speciesId: string, name?: string): Character {
  const sp = SPECIES[speciesId];
  const stats = cloneStats(sp.baseStats);
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

// ── Boost payant d'une stat (inventaire) ─────────────────────────────────────
export function boostStat(c: Character, stat: StatKey): Character {
  const amount = BOOST_AMOUNT[stat] ?? 1;
  const stats = applyStats(c.stats, { [stat]: amount });
  // un boost de PV soigne d'autant
  const life = stat === "hp" ? c.life + amount : c.life;
  return { ...c, stats, life };
}

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
