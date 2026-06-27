// F2 — buildFighter : Character (plat) → Fighter (runtime), sans effet de bord.

import type { Character, Fighter } from "./types";
import { SPECIES } from "./data";
import { TALENTS } from "./talents";
import type { Rng } from "./rng";

const TIMEBASE = 10;
const TIMECOEF = 10;

/**
 * Dérive un Fighter à partir d'un Character.
 * La vitesse pilote `timeMultiplier` (F4) : plus rapide → agit plus souvent.
 */
export function buildFighter(c: Character, side: 0 | 1, fid: number, rng: Rng): Fighter {
  const sp = SPECIES[c.speciesId];
  const s = c.stats;
  // vitesse de référence ~50. timeMultiplier = 50/spd (borné).
  const timeMultiplier = Math.min(2.5, Math.max(0.4, 50 / Math.max(1, s.spd)));

  const f: Fighter = {
    fid,
    side,
    name: c.name,
    gfx: sp?.gfx ?? "flameling",
    size: sp?.size ?? 100,
    tint: sp?.tint ?? "#888",
    level: c.level,
    maxLife: s.hp,
    life: Math.min(c.life > 0 ? c.life : s.hp, s.hp),
    startLife: Math.min(c.life > 0 ? c.life : s.hp, s.hp),
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    maxSta: s.sta,
    sta: s.sta,
    atkBonus: 0,
    atkMult: 1,
    dodge: 4 + Math.round(s.spd / 12), // un peu d'esquive issue de la vitesse
    // léger décalage initial seedé pour départager (F4)
    time: rng.float(TIMEBASE) * TIMECOEF,
    timeMultiplier,
    talents: [],
    hooks: { defenses: [], afterAttack: [], onTurn: [] },
  };

  // Talent inné (toujours présent) puis talents acquis.
  const all = [sp?.innate, ...c.talents].filter(Boolean) as string[];
  for (const tid of all) {
    if (f.talents.includes(tid)) continue;
    f.talents.push(tid);
    TALENTS[tid]?.apply(f);
  }
  return f;
}

export const TIMING = { TIMEBASE, TIMECOEF };
