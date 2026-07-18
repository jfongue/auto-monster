// T012 — Bonus passif & formule "mode Traits" : module PUR (aucun DOM, aucun état),
// partagé par le simulateur headless (engine/live.ts, autoSim) ET le moteur de combat
// interactif réellement joué (renderer/liveEngine.ts). Une seule formule pour les deux,
// testable indépendamment du DOM — c'est le filet de sécurité demandé par T012 pour un
// fichier (liveEngine.ts) qui n'a par ailleurs aucun test automatisé.

/** Bonus passif approximé, exprimé dans le vocabulaire du moteur LIVE (T006, affiné T007/T008). */
export type PassiveBonus = {
  atkMult: number; // multiplicateur additif sur l'ATK (Braise)
  critChance: number; // % (Frénésie)
  critMult: number; // multiplicateur du critique (Frénésie)
  dodgeBonus: number; // % de chance d'esquiver totalement une frappe subie (Insaisissable)
  lifesteal: number; // fraction des dégâts infligés récupérée en PV (Ponction/Sangsue)
  regenPct: number; // % PV max régénéré/tick (Régénération)
  dmgTakenMult: number; // multiplicateur des dégâts reçus (Peau de pierre)
};

/** Bonus neutre (aucun passif équipé / Character sans Traits). */
export const NO_PASSIVE_BONUS: PassiveBonus = {
  atkMult: 0, critChance: 0, critMult: 1, dodgeBonus: 0, lifesteal: 0, regenPct: 0, dmgTakenMult: 1,
};

/**
 * DEF mitigante d'une cible. `traitMode` (T007) : le move offensif détermine les dégâts,
 * plus de principe de défense → 0 des deux côtés. Sinon : DEF réelle (formule legacy).
 */
export function defOf(targetDef: number, traitMode: boolean): number {
  return traitMode ? 0 : targetDef;
}

/** Bonus d'ATK passif (Braise) appliqué à des dégâts déjà calculés. */
export function applyAtkMultPassive(dmg: number, pb: PassiveBonus): number {
  return pb.atkMult ? Math.round(dmg * (1 + pb.atkMult)) : dmg;
}

/** Coup critique passif (Frénésie) : `chance(p)` doit renvoyer vrai avec probabilité p (0-100). */
export function applyCritPassive(dmg: number, pb: PassiveBonus, chance: (p: number) => boolean): number {
  return pb.critChance && chance(pb.critChance) ? Math.round(dmg * pb.critMult) : dmg;
}

/** Esquive passive totale (Insaisissable) : true = la frappe subie est entièrement évitée. */
export function rollDodgePassive(pb: PassiveBonus, chance: (p: number) => boolean): boolean {
  return !!pb.dodgeBonus && chance(pb.dodgeBonus);
}

/** Réduction des dégâts subis (Peau de pierre), appliquée à une frappe brute déjà mitigée par la DEF. */
export function applyDmgTakenMultPassive(raw: number, pb: PassiveBonus): number {
  return pb.dmgTakenMult !== 1 ? Math.max(1, Math.round(raw * pb.dmgTakenMult)) : raw;
}

/** Vol de vie (Ponction/Sangsue) : PV récupérés sur des dégâts infligés. */
export function lifestealAmount(dmgDealt: number, pb: PassiveBonus): number {
  return pb.lifesteal ? Math.round(dmgDealt * pb.lifesteal) : 0;
}

/** Régénération passive (Régénération), à appliquer une fois par tick si 0 < PV < PV max. */
export function regenAmount(maxHp: number, pb: PassiveBonus): number {
  return pb.regenPct ? Math.max(1, Math.round(maxHp * pb.regenPct)) : 0;
}
