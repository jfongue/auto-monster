// T006 — Modèle de données Traits (actifs x3 + passif x1, niveaux 1-3).
//
// Un Trait = soit une action de kit LIVE (actif : peck/guard/burst, claw/ember/rush,
// spit/spores/bash, strike/dodge/riposte), soit un talent existant (passif : ember,
// frenzy, stoneskin, thorns, regen, ponction, elan…), paramétré par un PALIER 1→3
// qui fait scaler sa puissance/effet. Un AM porte 3 Traits actifs + 1 passif.
//
// Couche STRICTEMENT ADDITIVE : tant qu'un Character n'a pas de `activeTraits`/
// `passiveTrait` (T006), le combat LIVE utilise le kit fixe de son espèce (KITS)
// et aucun bonus passif — zéro régression sur le comportement existant / les
// tests déjà verts (live.test.ts, engine.test.ts).

import { KITS, kitFor, type AmKit, type LiveMove, type KitSpecial } from "./live";
import { TALENTS } from "./talents";
import type { EquippedTrait } from "./types";
import { type PassiveBonus, NO_PASSIVE_BONUS } from "./passiveBonus";

export type { PassiveBonus } from "./passiveBonus";

export type { EquippedTrait } from "./types";

export type TraitKind = "active" | "passive";

/** Un palier de puissance (index 0 = niveau 1). Champs pertinents selon le Trait. */
export type TraitLevel = {
  power?: number;
  burn?: number;
  poison?: number;
  reflect?: number;
  /** magnitude générique pour les Traits passifs (fraction/points selon le trait). */
  value?: number;
};

export type ActiveTraitDef = {
  id: string;
  name: string;
  icon: string;
  kind: "active";
  maxLevel: 3;
  /** mécanique spéciale héritée du kit d'origine (garde/combo/poison/esquive). */
  special: KitSpecial;
  moveKind: "atk" | "def";
  cost: number;
  hold?: number;
  combo?: boolean;
  spendCombo?: boolean;
  burst?: boolean;
  dodge?: boolean;
  levels: [TraitLevel, TraitLevel, TraitLevel];
};

export type PassiveTraitDef = {
  id: string;
  name: string;
  icon: string;
  kind: "passive";
  maxLevel: 3;
  levels: [TraitLevel, TraitLevel, TraitLevel];
};

export type TraitDef = ActiveTraitDef | PassiveTraitDef;

// ================= TRAITS ACTIFS (conversion des 12 actions des 4 kits) =================
/** Scaling standard d'un Trait actif par palier (1 = puissance de référence, cf FLAT_REFERENCE). */
const ACTIVE_LV_MULT = [1, 1.3, 1.6] as const;

/**
 * T007 — Puissance FLAT (dégâts absolus, plus un multiplicateur d'ATK) : "le move offensif
 * détermine les dégâts, plus de principe de défense" (combat piloté par Traits). Valeurs
 * calibrées à partir de l'ancienne formule (power × ATK × mitigation DEF) à un point de
 * référence (Character niv.5 vs NME niv.4) pour préserver le ressenti de chaque kit sans
 * dépendre d'ATK/DEF. Palier 1 = cette référence ; paliers 2-3 scalent via ACTIVE_LV_MULT.
 */
const FLAT_REFERENCE: Record<string, { power?: number; burn?: number; poison?: number; reflect?: number }> = {
  peck: { power: 11 },
  guard: {},
  burst: { power: 9 },
  claw: { power: 9 },
  ember: { power: 7, burn: 6 },
  rush: { power: 16 },
  spit: { power: 5, poison: 7 },
  spores: { reflect: 7 },
  bash: { power: 11 },
  strike: { power: 20 },
  dodge: {},
  riposte: { power: 15 },
};

function scaleActiveLevels(move: LiveMove): [TraitLevel, TraitLevel, TraitLevel] {
  const ref = FLAT_REFERENCE[move.id] ?? {};
  return ACTIVE_LV_MULT.map((m) => ({
    power: ref.power != null ? +(ref.power * m).toFixed(2) : undefined,
    burn: ref.burn != null ? +(ref.burn * m).toFixed(2) : undefined,
    poison: ref.poison != null ? +(ref.poison * m).toFixed(2) : undefined,
    reflect: ref.reflect != null ? +(ref.reflect * m).toFixed(2) : undefined,
  })) as [TraitLevel, TraitLevel, TraitLevel];
}

function activeFrom(move: LiveMove, special: KitSpecial): ActiveTraitDef {
  return {
    id: move.id,
    name: move.k,
    icon: move.ic,
    kind: "active",
    maxLevel: 3,
    special,
    moveKind: move.kind === "def" ? "def" : "atk",
    cost: move.cost,
    hold: move.hold,
    combo: move.combo,
    spendCombo: move.spendCombo,
    burst: move.burst,
    dodge: move.dodge,
    levels: scaleActiveLevels(move),
  };
}

/** Catalogue des Traits actifs = les 12 actions des 4 kits LIVE (peck/guard/burst…). */
export const ACTIVE_TRAITS: Record<string, ActiveTraitDef> = {};
for (const kitId of Object.keys(KITS)) {
  const kit = KITS[kitId];
  for (const move of kit.actions) {
    ACTIVE_TRAITS[move.id] = activeFrom(move, kit.special);
  }
}

// ================= TRAITS PASSIFS (conversion des talents existants) =================
/** Scaling standard d'un Trait passif par palier (palier 2 ≈ magnitude actuelle du talent). */
const PASSIVE_LV_MULT = [0.65, 1, 1.4] as const;

/** Magnitude de référence (palier 2) extraite du talent d'origine (talents.ts). */
function passiveBaseValue(id: string): number {
  switch (id) {
    case "ember": return 0.2; // +20% ATK
    case "frenzy": return 0.25; // 25% de chance de critique
    case "fournaise": return 0.15; // +15% Force par critique
    case "embrasement": return 0.28; // brûlure ≈28% ATK
    case "pyromane": return 0.35; // +35% dégâts vs brûlé
    case "inoculation": return 0.25; // poison ≈25% ATK
    case "virulence": return 0.35; // +35% dégâts vs empoisonné
    case "stoneskin": return 0.15; // -15% dégâts reçus
    case "thorns": return 0.25; // 25% renvoyé
    case "spores": return 0.22; // poison sur les coups reçus ≈22% ATK
    case "secondwind": return 1; // ×2 régén sous 40% PV
    case "swift": return 0.15; // +15% vitesse d'action
    case "evasion": return 16; // +16 points d'esquive
    case "regen": return 0.04; // 4% PV max/tour
    case "ponction": return 0.3; // 30% vol de vie
    case "sangsue": return 0.55; // 55% vol de vie
    case "riposte": return 1; // contre-attaque à l'esquive (booléen)
    case "contreParfait": return 1; // ripostes critiques (booléen)
    case "elan": return 0.12; // +12% Force par esquive
    case "danse": return 1; // snowball esquive/vitesse (booléen)
    default: return 1;
  }
}

function passiveFrom(id: string): PassiveTraitDef {
  const t = TALENTS[id];
  const base = passiveBaseValue(id);
  const levels = PASSIVE_LV_MULT.map((m) => ({ value: +(base * m).toFixed(4) })) as [TraitLevel, TraitLevel, TraitLevel];
  return { id: t.id, name: t.name, icon: t.icon, kind: "passive", maxLevel: 3, levels };
}

/** Catalogue des Traits passifs = conversion 1:1 des talents existants (talents.ts). */
export const PASSIVE_TRAITS: Record<string, PassiveTraitDef> = {};
for (const id of Object.keys(TALENTS)) PASSIVE_TRAITS[id] = passiveFrom(id);

// ================= HELPERS =================
function levelIndex(level: number): number {
  return Math.max(1, Math.min(3, Math.round(level))) - 1;
}

export function activeLevelOf(id: string, level: number): TraitLevel | undefined {
  return ACTIVE_TRAITS[id]?.levels[levelIndex(level)];
}

export function passiveLevelOf(id: string, level: number): TraitLevel | undefined {
  return PASSIVE_TRAITS[id]?.levels[levelIndex(level)];
}

/** Construit un AmKit (format attendu par le moteur LIVE) depuis 3 Traits actifs équipés. */
export function kitFromActiveTraits(equipped: EquippedTrait[]): AmKit {
  if (equipped.length !== 3) throw new Error("kitFromActiveTraits attend exactement 3 Traits actifs");
  const moves: LiveMove[] = equipped.map((eq) => {
    const def = ACTIVE_TRAITS[eq.id];
    if (!def) throw new Error(`Trait actif inconnu: ${eq.id}`);
    const lv = def.levels[levelIndex(eq.level)];
    return {
      id: def.id,
      ic: def.icon,
      k: def.name,
      kind: def.moveKind,
      cost: def.cost,
      hold: def.hold,
      power: lv.power,
      burn: lv.burn,
      poison: lv.poison,
      reflect: lv.reflect,
      combo: def.combo,
      spendCombo: def.spendCombo,
      burst: def.burst,
      dodge: def.dodge,
    };
  });
  const guardMove = moves.find((m) => m.kind === "def");
  const special: KitSpecial = guardMove
    ? ACTIVE_TRAITS[guardMove.id].special
    : moves.some((m) => m.combo || m.spendCombo)
      ? "combo"
      : ACTIVE_TRAITS[equipped[0].id].special;
  return {
    special,
    playstyle: "Loadout personnalisé (Traits équipés).",
    guardHold: guardMove?.hold ?? 0,
    actions: [moves[0], moves[1], moves[2]] as [LiveMove, LiveMove, LiveMove],
    charge: KITS.poofowl.charge,
  };
}

/** Résout le kit effectif d'un Character : ses 3 Traits actifs s'ils sont équipés, sinon `undefined` (→ fallback caller sur kitFor(speciesId)). */
export function resolveActiveKit(activeTraits?: EquippedTrait[]): AmKit | undefined {
  if (activeTraits && activeTraits.length === 3) return kitFromActiveTraits(activeTraits);
  return undefined;
}

export function passiveBonusOf(passive?: EquippedTrait): PassiveBonus {
  const bonus: PassiveBonus = { ...NO_PASSIVE_BONUS };
  if (!passive) return bonus;
  const def = PASSIVE_TRAITS[passive.id];
  if (!def) return bonus;
  const v = def.levels[levelIndex(passive.level)].value ?? 0;
  switch (def.id) {
    case "ember": bonus.atkMult += v; break;
    case "frenzy": bonus.critChance += v * 100; bonus.critMult = 1.6; break;
    case "evasion": bonus.dodgeBonus += v; break;
    case "regen": bonus.regenPct += v; break;
    case "ponction": case "sangsue": bonus.lifesteal = Math.max(bonus.lifesteal, v); break;
    case "stoneskin": bonus.dmgTakenMult = Math.min(bonus.dmgTakenMult, 1 - v); break;
    default: break; // thorns/embrasement/etc. : branchés plus finement lors de T008.
  }
  return bonus;
}

// ================= T007 — point d'entrée combat réel =================
import type { Character } from "./types";
import type { AutoSimOpts } from "./live";

/**
 * Options `autoSim` pour un Character : s'il a 3 Traits actifs équipés, bascule le combat
 * réel en mode Traits (kit construit depuis les Traits, dégâts flat sans ATK/DEF, bonus
 * passif appliqué) ; sinon `undefined` → fallback `autoSim` legacy (kit fixe de l'espèce).
 */
export function combatOptsFor(c: Character): AutoSimOpts | undefined {
  const kit = resolveActiveKit(c.activeTraits);
  if (!kit) return undefined;
  return { kit, passiveBonus: passiveBonusOf(c.passiveTrait), traitMode: true };
}

/**
 * T012 — Config combat toujours résolue (jamais `undefined`), pour les consommateurs qui
 * veulent un kit/bonus/traitMode garantis sans répéter le `?? kitFor(...)` de repli à la
 * main (ex: renderer/liveEngine.ts, combat interactif réellement joué). Même règle de
 * fallback que `combatOptsFor` : <3 Traits actifs équipés → kit fixe de l'espèce, aucun
 * bonus passif, traitMode=false (comportement 100% legacy, zéro régression).
 */
export function resolveCombatConfig(c: Character): { kit: AmKit; passiveBonus: PassiveBonus; traitMode: boolean } {
  const opts = combatOptsFor(c);
  if (opts) return { kit: opts.kit!, passiveBonus: opts.passiveBonus!, traitMode: true };
  return { kit: kitFor(c.speciesId), passiveBonus: NO_PASSIVE_BONUS, traitMode: false };
}

// ================= T008 — bootstrap des Traits (nouveaux AM + migration des saves) =================
import type { SpeciesDef } from "./types";

/** Trait actif de départ d'une espèce (SpeciesDef.startTrait s'il est valide, sinon 1ère attaque de son kit LIVE). */
export function startTraitFor(sp: SpeciesDef): string {
  if (sp.startTrait && ACTIVE_TRAITS[sp.startTrait]) return sp.startTrait;
  const kit = KITS[sp.id] ?? KITS.poofowl;
  return kit.actions.find((m) => m.kind === "atk")?.id ?? kit.actions[0].id;
}

/**
 * T008 — garantit qu'un Character a au moins son Trait actif de départ équipé.
 * Idempotent : ne touche à rien si des Traits actifs sont déjà présents. Sert à la
 * fois à `makeCharacter` (nouveaux AM) et au bootstrap discret des saves antérieures
 * à T008 (dès qu'un tel Character entre en combat ou gagne de l'XP).
 */
export function ensureTraits(c: Character, sp: SpeciesDef): Character {
  if (c.activeTraits && c.activeTraits.length > 0) return c;
  return { ...c, activeTraits: [{ id: startTraitFor(sp), level: 1 }] };
}
