// Progression (GDD 4.3) : XP, niveaux (jusqu'à 100), packs de stats par niveau,
// paliers de talent tous les 10 niveaux. Génération des ennemis par niveau.

import type { Character, Stats } from "./types";
import { SPECIES, MapStep } from "./data";
import { TALENTS } from "./talents";

let uid = 0;
export function newId(prefix = "c"): string {
  return `${prefix}_${Date.now().toString(36)}_${(uid++).toString(36)}`;
}

const cloneStats = (s: Stats): Stats => ({ ...s });

/** XP nécessaire pour passer de `level` à `level+1`. */
export function xpForNext(level: number): number {
  return 30 + (level - 1) * 25;
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
  };
}

/** Stats d'un ennemi mises à l'échelle de son niveau (pas de packs). */
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

/** Crée le Character ennemi d'une étape de map. */
export function makeEnemy(step: MapStep): Character {
  const sp = SPECIES[step.enemySpecies];
  const stats = scaleStats(sp.baseStats, step.enemyLevel);
  return {
    id: newId("e"),
    speciesId: step.enemySpecies,
    name: sp.name,
    level: step.enemyLevel,
    xp: 0,
    life: stats.hp,
    stats,
    talents: [],
  };
}

// ── Packs de stats (arbre fixe, identique à chaque niveau) ──────────────────
export type PackOption = {
  id: string;
  name: string;
  desc: string;
  delta: Partial<Stats>;
};

export const STAT_PACKS: PackOption[] = [
  {
    id: "balanced",
    name: "Équilibré",
    desc: "+6 PV · +2 ATK · +1 DEF · +1 VIT",
    delta: { hp: 6, atk: 2, def: 1, spd: 1, sta: 1 },
  },
  {
    id: "assault",
    name: "Assaut",
    desc: "+4 ATK · +3 VIT · +3 PV · −1 DEF",
    delta: { atk: 4, spd: 3, hp: 3, def: -1 },
  },
  {
    id: "guard",
    name: "Garde",
    desc: "+12 PV · +4 DEF · −1 VIT",
    delta: { hp: 12, def: 4, spd: -1 },
  },
];

// ── Paliers de talent (tous les 10 niveaux) ─────────────────────────────────
export type TalentTierOption =
  | { id: string; kind: "talent"; name: string; desc: string; talentId: string }
  | { id: "bigstats"; kind: "bigstats"; name: string; desc: string; delta: Partial<Stats> };

const BIG_STATS: Partial<Stats> = { hp: 25, atk: 6, def: 4, spd: 3, sta: 6 };

export function talentTierOptions(c: Character): TalentTierOption[] {
  const sp = SPECIES[c.speciesId];
  const owned = new Set([sp.innate, ...c.talents].filter(Boolean) as string[]);
  const opts: TalentTierOption[] = [];
  if (c.talents.length < 3) {
    for (const tid of sp.talentPool) {
      if (owned.has(tid)) continue;
      const td = TALENTS[tid];
      if (!td) continue;
      opts.push({ id: `learn_${tid}`, kind: "talent", name: `Apprendre : ${td.name}`, desc: td.desc, talentId: tid });
      if (opts.length >= 2) break;
    }
  }
  opts.push({
    id: "bigstats",
    kind: "bigstats",
    name: "Gros boost de stats",
    desc: "+25 PV · +6 ATK · +4 DEF · +3 VIT · +6 STA",
    delta: BIG_STATS,
  });
  return opts;
}

// ── Application des choix ────────────────────────────────────────────────────
export function applyStats(stats: Stats, delta: Partial<Stats>): Stats {
  const out = cloneStats(stats);
  (Object.keys(delta) as (keyof Stats)[]).forEach((k) => {
    out[k] = Math.max(1, out[k] + (delta[k] ?? 0));
  });
  return out;
}

/** Applique un pack choisi à un Character (et soigne du gain de PV max). */
export function applyPack(c: Character, packId: string): Character {
  const pack = STAT_PACKS.find((p) => p.id === packId);
  if (!pack) return c;
  const before = c.stats.hp;
  const stats = applyStats(c.stats, pack.delta);
  const lifeGain = Math.max(0, stats.hp - before);
  return { ...c, stats, life: Math.min(stats.hp, c.life + lifeGain) };
}

export function applyTalentTier(c: Character, opt: TalentTierOption): Character {
  if (opt.kind === "talent") {
    if (c.talents.includes(opt.talentId) || c.talents.length >= 3) return c;
    return { ...c, talents: [...c.talents, opt.talentId] };
  }
  const before = c.stats.hp;
  const stats = applyStats(c.stats, opt.delta);
  const lifeGain = Math.max(0, stats.hp - before);
  return { ...c, stats, life: Math.min(stats.hp, c.life + lifeGain) };
}

// ── Gain d'XP → niveaux + choix en attente ──────────────────────────────────
export type PendingLevel =
  | { level: number; kind: "pack" }
  | { level: number; kind: "talent" };

export type XpResult = {
  character: Character; // xp/level mis à jour (stats PAS encore modifiées : choix en attente)
  gained: number;
  pending: PendingLevel[];
};

/** Ajoute de l'XP, gère les passages de niveau, renvoie les choix à résoudre. */
export function addXp(c: Character, amount: number): XpResult {
  let { level, xp } = c;
  const pending: PendingLevel[] = [];
  xp += amount;
  while (level < 100 && xp >= xpForNext(level)) {
    xp -= xpForNext(level);
    level += 1;
    pending.push(level % 10 === 0 ? { level, kind: "talent" } : { level, kind: "pack" });
  }
  return { character: { ...c, level, xp }, gained: amount, pending };
}
