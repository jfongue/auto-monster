// Combat LIVE — moteur data-driven (port du proto combat-live-proto.html, généralisé).
//
// Deux couches :
//   1. DATA pure et testable (ce fichier) : kits par AM jouable, comportements
//      par NME, formule de dégâts dérivée des stats, + un simulateur headless
//      (autoSim) qui rejoue la boucle de ticks sans DOM pour les tests.
//   2. Rendu/animations/fenêtres d'input : renderer/LiveCombat.tsx (pilote ce moteur).
//
// Chaque AM jouable a un FEEL distinct :
//   - Poofowl : garde à 2 boucliers → parade → réserve → décharge (le contre-puncheur).
//   - Emberpup : combo qui monte (×1→×4), aucune garde, tout en agression.
//   - Fungoot : poison empilable + spores qui empoisonnent l'attaquant (l'usure).
//   - Haloux : esquive parfaite → riposte immédiate (le duelliste au timing).
//
// Trois NME aux comportements radicalement différents :
//   - Sprigling : rythme lisible (petit, petit, GROS coup).
//   - Cobbleback : tortue qui charge un slam massif multi-tick, punit l'avidité.
//   - Murkwisp : feinte — télégraphie un gros coup puis l'annule parfois.

import type { Character } from "./types";
import { makeRng, type Rng } from "./rng";
import {
  type PassiveBonus,
  NO_PASSIVE_BONUS,
  defOf,
  applyAtkMultPassive,
  applyCritPassive,
  rollDodgePassive,
  applyDmgTakenMultPassive,
  lifestealAmount,
  regenAmount,
} from "./passiveBonus";

// ================= CONFIG =================
export const MAX_NRJ = 4;
export const STORE_MAX = 30;
export const TICK_MS = 2000;

// ================= DÉGÂTS =================
/** Dégâts d'un coup : puissance × ATK, atténués par la DEF de la cible. */
export function hitDmg(power: number, atk: number, targetDef: number): number {
  return Math.max(1, Math.round(power * atk * (1 - targetDef / (targetDef + 60))));
}

// ================= MOVES / KITS (joueur) =================
export type MoveKind = "atk" | "def" | "wait";
/** Mécanique spéciale d'un kit (pilote garde/réserve/combo/poison/esquive). */
export type KitSpecial = "guard" | "combo" | "poison" | "dodge";

export type LiveMove = {
  id: string;
  ic: string; // icône (emoji)
  k: string; // libellé
  kind: MoveKind;
  cost: number;
  power?: number; // multiplicateur d'ATK (attaques)
  hold?: number; // nb de boucliers/tours (défenses type garde)
  burst?: boolean; // consomme la réserve de décharge
  combo?: boolean; // incrémente le combo (Emberpup)
  spendCombo?: boolean; // finisher : consomme le combo pour un gros multiplicateur
  burn?: number; // applique une brûlure (dégâts/tick) fraction d'ATK
  poison?: number; // applique un poison (dégâts/tick) fraction d'ATK
  reflect?: number; // spores : empoisonne l'attaquant quand on pare (fraction d'ATK)
  dodge?: boolean; // esquive : parade parfaite → riposte (Haloux)
};

export type AmKit = {
  special: KitSpecial;
  /** intitulé du style de jeu (fiche / onboarding). */
  playstyle: string;
  /** boucliers de la défense (garde/spores/esquive) — 1 pour l'esquive, 2 pour la garde. */
  guardHold: number;
  /** les 3 boutons d'action + le bouton Charger. */
  actions: [LiveMove, LiveMove, LiveMove];
  charge: LiveMove;
};

const CHARGE: LiveMove = { id: "wait", ic: "🔋", k: "Charger", kind: "wait", cost: 0 };

/** Kits par espèce jouable. Les puissances sont des multiplicateurs d'ATK. */
export const KITS: Record<string, AmKit> = {
  // ── Poofowl : le mur / contre-puncheur (kit de référence du proto) ─────────
  poofowl: {
    special: "guard",
    playstyle: "Garde & parade : encaisse, stocke la parade, puis décharge.",
    guardHold: 2,
    actions: [
      { id: "peck", ic: "🐾", k: "Coup", kind: "atk", cost: 1, power: 0.62 },
      { id: "guard", ic: "🛡️", k: "Garde", kind: "def", cost: 2, hold: 2 },
      { id: "burst", ic: "💥", k: "Décharge", kind: "atk", cost: 2, power: 0.5, burst: true },
    ],
    charge: CHARGE,
  },

  // ── Emberpup : combo ramp, tout en agression, aucune garde ─────────────────
  emberpup: {
    special: "combo",
    playstyle: "Combo : enchaîne les coups (×1→×4), termine par la Curée. Fragile.",
    guardHold: 0,
    actions: [
      { id: "claw", ic: "🐾", k: "Griffe", kind: "atk", cost: 1, power: 0.42, combo: true },
      { id: "ember", ic: "🔥", k: "Brasier", kind: "atk", cost: 1, power: 0.3, burn: 0.22, combo: true },
      { id: "rush", ic: "💥", k: "Curée", kind: "atk", cost: 2, power: 0.7, spendCombo: true },
    ],
    charge: CHARGE,
  },

  // ── Fungoot : poison empilable + spores défensives ─────────────────────────
  fungoot: {
    special: "poison",
    playstyle: "Poison : empile les toxines, punit qui te frappe, survis à l'usure.",
    guardHold: 2,
    actions: [
      { id: "spit", ic: "☠️", k: "Crachat", kind: "atk", cost: 1, power: 0.28, poison: 0.3 },
      { id: "spores", ic: "🛡️", k: "Spores", kind: "def", cost: 2, hold: 2, reflect: 0.3 },
      { id: "bash", ic: "🐾", k: "Frappe", kind: "atk", cost: 1, power: 0.6 },
    ],
    charge: CHARGE,
  },

  // ── Haloux : esquive parfaite → riposte (glass cannon au timing) ───────────
  haloux: {
    special: "dodge",
    playstyle: "Esquive & riposte : évite au bon tick, contre immédiatement. Peu de PV.",
    guardHold: 1,
    actions: [
      { id: "strike", ic: "🐾", k: "Frappe", kind: "atk", cost: 1, power: 0.72 },
      { id: "dodge", ic: "💨", k: "Esquive", kind: "def", cost: 1, hold: 1, dodge: true },
      { id: "riposte", ic: "⚔️", k: "Riposte", kind: "atk", cost: 2, power: 0.55, burst: true },
    ],
    charge: CHARGE,
  },
};

/** Kit d'une espèce (repli sur Poofowl si inconnue → toute créature reste jouable). */
export function kitFor(speciesId: string): AmKit {
  return KITS[speciesId] ?? KITS.poofowl;
}

// ================= COMPORTEMENTS (NME) =================
export type StrikeType = "small" | "big";
/** Intention d'un NME pour un tick. */
export type EnemyIntent = {
  mode: "prep" | "strike" | "idle" | "guard";
  type: StrikeType;
  /** vrai coup annulé ce tick (feinte) — résolu comme idle mais télégraphié big. */
  feint?: boolean;
  /** exposé pendant une longue charge (subit plus de dégâts). */
  exposed?: boolean;
};

/** Puissances de frappe d'un NME (multiplicateurs d'ATK), par comportement. */
export type EnemyBehaviorDef = {
  id: string;
  name: string;
  /** description du pattern (fiche / bestiaire). */
  tell: string;
  smallPower: number;
  bigPower: number;
  /** décide l'intention du tick courant (mute son état interne). */
  next(mem: EnemyMem, rng: Rng): EnemyIntent;
};

/** Mémoire interne d'un NME entre ticks. */
export type EnemyMem = {
  tick: number;
  plan: StrikeType[];
  pending: { type: StrikeType } | null;
  charge: number; // ticks de charge accumulés (Cobbleback)
};

export function newEnemyMem(): EnemyMem {
  return { tick: 0, plan: [], pending: null, charge: 0 };
}

export const BEHAVIORS: Record<string, EnemyBehaviorDef> = {
  // ── Sprigling : rythme lisible — petit, petit, GROS coup ───────────────────
  sprigling: {
    id: "sprigling",
    name: "Sprigling",
    tell: "Rythme régulier : petit, petit, GROS coup. Apprends la cadence.",
    smallPower: 0.45,
    bigPower: 1.5,
    next(mem) {
      if (mem.pending) {
        const t = mem.pending.type;
        return { mode: "strike", type: t };
      }
      if (mem.plan.length === 0) mem.plan = ["small", "small", "big"];
      const type = mem.plan.shift()!;
      mem.pending = { type };
      return { mode: "prep", type };
    },
  },

  // ── Cobbleback : tortue — charge un slam massif, punit l'avidité ───────────
  cobbleback: {
    id: "cobbleback",
    name: "Cobbleback",
    tell: "Tortue : se protège, puis charge un slam dévastateur. Frappe-la pendant sa charge.",
    smallPower: 0.4,
    bigPower: 2.4,
    next(mem) {
      // Cycle : garde, garde, CHARGE (exposé), SLAM.
      if (mem.pending) {
        return { mode: "strike", type: "big" };
      }
      mem.charge = (mem.charge + 1) % 4;
      if (mem.charge === 3) {
        // début de la charge du slam : exposé ce tick, frappe au suivant
        mem.pending = { type: "big" };
        return { mode: "prep", type: "big", exposed: true };
      }
      // sinon : occasionnel petit coup, sinon garde
      return { mode: "guard", type: "small" };
    },
  },

  // ── Murkwisp : feinte — télégraphie un gros coup puis l'annule parfois ─────
  murkwisp: {
    id: "murkwisp",
    name: "Murkwisp",
    tell: "Feinte : télégraphie un gros coup… mais l'annule parfois. Ne panique pas.",
    smallPower: 0.5,
    bigPower: 1.4,
    next(mem, rng) {
      if (mem.pending) {
        const t = mem.pending.type;
        // 40% : la grosse frappe télégraphiée est une feinte → annulée
        if (t === "big" && rng.chance(40)) {
          return { mode: "idle", type: "big", feint: true };
        }
        return { mode: "strike", type: t };
      }
      // alterne petits coups rapides et grosses charges (souvent feintées)
      const type: StrikeType = rng.chance(45) ? "big" : "small";
      mem.pending = { type };
      return { mode: "prep", type };
    },
  },
};

/** Espèces non-jouables mappées sur l'un des 3 comportements (ex : boss). */
const BEHAVIOR_ALIAS: Record<string, string> = {
  gravelmaw: "cobbleback", // le boss = tortue massive → slam qui punit l'avidité
};

/** Comportement d'un NME (alias boss, repli sur Sprigling). */
export function behaviorFor(speciesId: string): EnemyBehaviorDef {
  return BEHAVIORS[speciesId] ?? BEHAVIORS[BEHAVIOR_ALIAS[speciesId]] ?? BEHAVIORS.sprigling;
}

/** Seules ces 3 espèces sont des adversaires possibles (v0.42). */
export const LIVE_ENEMIES = ["sprigling", "cobbleback", "murkwisp"] as const;

// ================= ÉTAT DE COMBAT (runtime) =================
export type StatusDot = { kind: "poison" | "burn"; dmg: number; turns: number };

export type LiveFighter = {
  name: string;
  gfx: string;
  size: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  nrj: number;
  stored: number;
  guard: { hold: number; armedThisTick: boolean } | null;
  fullStreak: number;
  combo: number; // Emberpup
  dots: StatusDot[]; // poison / brûlure actives sur CE combattant
};

export function mkFighter(c: Character): LiveFighter {
  // T007 : stamina (Character.stamina) pilote l'énergie de départ si présente,
  // sinon repli legacy sur la vitesse (spd/12) pour les Character sans stamina.
  const startNrj = Math.max(1, Math.min(MAX_NRJ, Math.round(c.stamina ?? c.stats.spd / 12)));
  return {
    name: c.name,
    gfx: c.speciesId,
    size: 100,
    hp: Math.max(1, Math.round(c.life > 0 ? c.life : c.stats.hp)),
    maxHp: c.stats.hp,
    atk: c.stats.atk,
    def: c.stats.def,
    nrj: startNrj,
    stored: 0,
    guard: null,
    fullStreak: 0,
    combo: 0,
    dots: [],
  };
}

// ================= SIMULATEUR HEADLESS (tests) =================
// Rejoue la boucle de ticks SANS DOM ni fenêtres d'input : le joueur suit une
// politique automatique simple. Sert à valider que les combats terminent, que
// les PV/énergie/poison restent cohérents et qu'un gagnant est désigné.
export type AutoResult = {
  winner: 0 | 1 | null;
  ticks: number;
  pLifeLeft: number;
  eLifeLeft: number;
  pDamageDealt: number;
};

/** T006 — options d'override pour piloter le combat depuis des Traits équipés (traits.ts).
 * Non fournies (undefined) = comportement legacy inchangé (kit fixe de l'espèce, aucun bonus). */
export type AutoSimOpts = {
  /** kit joueur pré-résolu (ex: kitFromActiveTraits) ; sinon kitFor(playerC.speciesId). */
  kit?: AmKit;
  /** bonus passif joueur pré-résolu (ex: passiveBonusOf) ; sinon aucun bonus. */
  passiveBonus?: PassiveBonus;
  /** T007 — mode Traits : dégâts flat (puissance du Trait), sans multiplicateur d'ATK ni mitigation par DEF
   * (« le move offensif détermine les dégâts, plus de principe de défense »). false/undefined = formule
   * legacy inchangée (power × ATK × mitigation DEF), nécessaire à kitFor(speciesId)/live.test.ts. */
  traitMode?: boolean;
};

/** Applique les DoT en fin de tick (poison/brûlure), renvoie les dégâts subis. */
function tickDots(f: LiveFighter): number {
  let total = 0;
  for (const d of f.dots) {
    f.hp = Math.max(0, f.hp - d.dmg);
    total += d.dmg;
    d.turns--;
  }
  f.dots = f.dots.filter((d) => d.turns > 0);
  return total;
}

function addDot(f: LiveFighter, kind: "poison" | "burn", dmg: number, turns: number) {
  if (dmg <= 0) return;
  f.dots.push({ kind, dmg, turns });
}

/**
 * Simulation automatique déterministe. Politique joueur : décharge si réserve
 * pleine, sinon garde/esquive si l'ennemi frappe fort ce tick, sinon attaque
 * si énergie dispo, sinon charge.
 */
export function autoSim(playerC: Character, enemyC: Character, seed: number, maxTicks = 200, opts?: AutoSimOpts): AutoResult {
  const rng = makeRng(seed);
  const P = mkFighter(playerC);
  const E = mkFighter(enemyC);
  const kit = opts?.kit ?? kitFor(playerC.speciesId);
  const beh = behaviorFor(enemyC.speciesId);
  const mem = newEnemyMem();
  const pb = opts?.passiveBonus ?? NO_PASSIVE_BONUS;
  const traitMode = !!opts?.traitMode;
  // T007 — mode Traits : ATK du joueur neutralisée (1 = identité), la puissance du Trait
  // porte directement les dégâts ; la mitigation par DEF (des deux côtés) est retirée plus
  // bas via defOf() (engine/passiveBonus.ts, partagé avec renderer/liveEngine.ts — T012).
  if (traitMode) P.atk = 1;
  let pDamageDealt = 0;
  let tick = 0;

  /** T006 — applique une frappe subie par le joueur (esquive passive + réduction Peau de pierre). */
  function playerTakeDmg(raw: number): number {
    if (rollDodgePassive(pb, rng.chance)) return 0;
    const d = applyDmgTakenMultPassive(raw, pb);
    P.hp = Math.max(0, P.hp - d);
    return d;
  }

  const atkMove = kit.actions.find((m) => m.kind === "atk")!;
  const defMove = kit.actions.find((m) => m.kind === "def");
  const burstMove = kit.actions.find((m) => m.burst);

  while (tick < maxTicks && P.hp > 0 && E.hp > 0) {
    tick++;
    mem.tick = tick;
    const intent = beh.next(mem, rng);
    const eStrikes = intent.mode === "strike";
    const eType = intent.type;

    // ── choix du joueur (politique auto) ──
    let move: LiveMove = kit.charge;
    if (burstMove && P.stored >= STORE_MAX && P.nrj >= burstMove.cost) move = burstMove;
    else if (eStrikes && defMove && P.nrj >= defMove.cost && rng.chance(60)) move = defMove;
    else if (P.nrj >= atkMove.cost && rng.chance(70)) move = atkMove;

    // ── coûts ──
    P.nrj -= move.cost;
    if (eStrikes) E.nrj = Math.max(0, E.nrj - (eType === "big" ? 2 : 1));

    const pAtk = move.kind === "atk";
    let guardConsumed = false;

    // ── résolution défense joueur ──
    if (move.kind === "def") {
      P.guard = { hold: move.hold ?? 1, armedThisTick: true };
      if (eStrikes) {
        guardConsumed = true;
        const raw = hitDmg(eType === "big" ? beh.bigPower : beh.smallPower, E.atk, defOf(P.def, traitMode));
        // parade parfaite : dégâts annulés
        if (kit.special === "guard" || kit.special === "dodge") P.stored = Math.min(STORE_MAX, P.stored + Math.round(raw * 1.5));
        if (kit.special === "poison" && move.reflect) addDot(E, "poison", Math.max(1, Math.round(move.reflect * P.atk)), 3);
        if (move.dodge && burstMove && P.nrj >= burstMove.cost) {
          // riposte immédiate (esquive parfaite Haloux)
          const rip = hitDmg(burstMove.power ?? 0.5, P.atk, defOf(E.def, traitMode)) + Math.min(P.stored, STORE_MAX);
          E.hp = Math.max(0, E.hp - rip);
          pDamageDealt += rip;
          P.stored = 0;
        }
        if (P.nrj < MAX_NRJ) P.nrj = Math.min(MAX_NRJ, P.nrj + (move.cost || 0)); // remboursement parade parfaite
      }
    } else if (pAtk) {
      P.guard = null;
      // combo ramp (Emberpup)
      let mult = 1;
      if (move.combo) {
        P.combo = Math.min(4, P.combo + 1);
        mult = 1 + 0.5 * (P.combo - 1);
      } else if (move.spendCombo) {
        mult = 1 + 0.6 * P.combo;
        P.combo = 0;
      }
      let dmg = Math.round(hitDmg(move.power ?? 0.5, P.atk, defOf(E.def, traitMode)) * mult);
      if (move.burst) {
        dmg += Math.min(P.stored, STORE_MAX);
        P.stored = 0;
      }
      // T006 — critique passif (Frénésie)
      dmg = applyCritPassive(dmg, pb, rng.chance);
      // T007 — Braise (+ATK passif) appliquée directement aux dégâts (indépendante d'ATK/DEF)
      dmg = applyAtkMultPassive(dmg, pb);
      // clash : si l'ennemi frappe aussi, le plus fort touche (ratio ≥ 1.5), sinon annulé
      if (eStrikes) {
        const eDmg = hitDmg(eType === "big" ? beh.bigPower : beh.smallPower, E.atk, defOf(P.def, traitMode));
        const ratio = Math.max(dmg, eDmg) / Math.max(1, Math.min(dmg, eDmg));
        if (ratio >= 1.5) {
          if (dmg >= eDmg) {
            E.hp = Math.max(0, E.hp - dmg);
            pDamageDealt += dmg;
            P.hp = Math.min(P.maxHp, P.hp + lifestealAmount(dmg, pb));
          } else {
            playerTakeDmg(eDmg);
            P.combo = 0;
          }
        }
        // sinon dégâts annulés (clash nul)
      } else {
        E.hp = Math.max(0, E.hp - dmg);
        pDamageDealt += dmg;
        P.hp = Math.min(P.maxHp, P.hp + lifestealAmount(dmg, pb));
        if (move.burn) addDot(E, "burn", Math.max(1, Math.round(move.burn * P.atk)), 3);
        if (move.poison) addDot(E, "poison", Math.max(1, Math.round(move.poison * P.atk)), 3);
      }
    } else {
      // charge/attente : subit la frappe ennemie si non paré
      if (eStrikes) {
        if (P.guard && P.guard.hold > 0) {
          guardConsumed = true;
        } else {
          const eDmg = hitDmg(eType === "big" ? beh.bigPower : beh.smallPower, E.atk, defOf(P.def, traitMode));
          playerTakeDmg(eDmg);
          P.combo = 0;
        }
      }
    }

    // ── régen d'énergie : pas de régen si on a attaqué ──
    if (!pAtk) P.nrj = Math.min(MAX_NRJ, P.nrj + 1);
    if (!eStrikes) E.nrj = Math.min(MAX_NRJ, E.nrj + 1);

    // ── garde : décompte des boucliers ──
    if (P.guard) {
      P.guard.armedThisTick = false;
      if (guardConsumed) P.guard = null;
      else { P.guard.hold--; if (P.guard.hold <= 0) P.guard = null; }
    }

    // ── repos : plein 2 ticks d'affilée → -1 énergie ──
    if (P.nrj >= MAX_NRJ) P.fullStreak++; else P.fullStreak = 0;
    if (P.fullStreak >= 2) { P.nrj = Math.max(0, P.nrj - 1); P.fullStreak = 0; }
    if (E.nrj >= MAX_NRJ) E.fullStreak++; else E.fullStreak = 0;
    if (E.fullStreak >= 2) { E.nrj = Math.max(0, E.nrj - 1); E.fullStreak = 0; }

    // ── DoT de fin de tick ──
    pDamageDealt += tickDots(E);
    tickDots(P);

    // ── T006 — régénération passive (Régénération) ──
    if (P.hp > 0 && P.hp < P.maxHp) {
      P.hp = Math.min(P.maxHp, P.hp + regenAmount(P.maxHp, pb));
    }

    if (eStrikes) mem.pending = null;
    if (intent.feint) mem.pending = null;
  }

  const winner: 0 | 1 | null = E.hp <= 0 && P.hp > 0 ? 0 : P.hp <= 0 && E.hp > 0 ? 1 : P.hp <= 0 && E.hp <= 0 ? null : null;
  return { winner, ticks: tick, pLifeLeft: Math.round(P.hp), eLifeLeft: Math.round(E.hp), pDamageDealt: Math.round(pDamageDealt) };
}

/** Résultat live remonté au jeu (rewards, PV persistés, boss). */
export type LiveResult = {
  winner: 0 | 1 | null;
  pLifeLeft: number;
  eLifeLeft: number;
  pDamageDealt: number;
};
