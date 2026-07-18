// T012 — Tests du filet de sécurité pur (aucun DOM) partagé entre autoSim (live.ts) et le
// combat interactif réellement joué (renderer/liveEngine.ts). Exécuter : npx tsx passiveBonus.test.ts
import {
  NO_PASSIVE_BONUS,
  defOf,
  applyAtkMultPassive,
  applyCritPassive,
  rollDodgePassive,
  applyDmgTakenMultPassive,
  lifestealAmount,
  regenAmount,
  type PassiveBonus,
} from "./passiveBonus";
import { resolveCombatConfig, combatOptsFor } from "./traits";
import { makeCharacter } from "./progression";
import { kitFor } from "./live";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const bonus = (patch: Partial<PassiveBonus>): PassiveBonus => ({ ...NO_PASSIVE_BONUS, ...patch });

console.log("defOf — DEF mitigante selon traitMode");
{
  check("traitMode=false → DEF réelle renvoyée", defOf(37, false) === 37);
  check("traitMode=true → 0 (plus de principe de défense)", defOf(37, true) === 0);
}

console.log("applyAtkMultPassive — Braise (+ATK passif)");
{
  check("aucun bonus = dégâts inchangés", applyAtkMultPassive(100, NO_PASSIVE_BONUS) === 100);
  check("+20% ATK passif → dégâts amplifiés", applyAtkMultPassive(100, bonus({ atkMult: 0.2 })) === 120);
}

console.log("applyCritPassive — Frénésie (critique passif)");
{
  const pb = bonus({ critChance: 100, critMult: 1.6 });
  check("critChance déclenchée (chance()=true) → dégâts × critMult", applyCritPassive(100, pb, () => true) === 160);
  check("critChance ratée (chance()=false) → dégâts inchangés", applyCritPassive(100, pb, () => false) === 100);
  check("aucun bonus (critChance=0) → jamais de critique même si chance()=true", applyCritPassive(100, NO_PASSIVE_BONUS, () => true) === 100);
}

console.log("rollDodgePassive — Insaisissable (esquive totale)");
{
  check("dodgeBonus>0 + chance()=true → esquive", rollDodgePassive(bonus({ dodgeBonus: 20 }), () => true) === true);
  check("dodgeBonus>0 + chance()=false → pas d'esquive", rollDodgePassive(bonus({ dodgeBonus: 20 }), () => false) === false);
  check("dodgeBonus=0 → jamais d'esquive même si chance()=true", rollDodgePassive(NO_PASSIVE_BONUS, () => true) === false);
}

console.log("applyDmgTakenMultPassive — Peau de pierre (réduction dégâts reçus)");
{
  check("aucun bonus = dégâts inchangés", applyDmgTakenMultPassive(100, NO_PASSIVE_BONUS) === 100);
  check("-15% dégâts reçus", applyDmgTakenMultPassive(100, bonus({ dmgTakenMult: 0.85 })) === 85);
  check("plancher à 1 (jamais 0 dégâts par arrondi)", applyDmgTakenMultPassive(1, bonus({ dmgTakenMult: 0.1 })) === 1);
}

console.log("lifestealAmount — Ponction/Sangsue (vol de vie)");
{
  check("aucun bonus = 0 PV rendus", lifestealAmount(100, NO_PASSIVE_BONUS) === 0);
  check("55% vol de vie (Sangsue palier 3)", lifestealAmount(100, bonus({ lifesteal: 0.55 })) === 55);
}

console.log("regenAmount — Régénération passive");
{
  check("aucun bonus = 0", regenAmount(200, NO_PASSIVE_BONUS) === 0);
  check("4% PV max, plancher à 1", regenAmount(200, bonus({ regenPct: 0.04 })) === 8);
  check("plancher à 1 même avec un tout petit PV max", regenAmount(2, bonus({ regenPct: 0.01 })) === 1);
}

console.log("resolveCombatConfig — jamais undefined (contrat pour liveEngine.ts, T012)");
{
  const c0 = makeCharacter("poofowl"); // ensureTraits → 1 seul Trait actif de départ, <3
  const cfg0 = resolveCombatConfig(c0);
  check("Character avec <3 Traits actifs → fallback kit fixe de l'espèce", cfg0.kit === kitFor("poofowl"));
  check("fallback : traitMode=false", cfg0.traitMode === false);
  check("fallback : cohérent avec combatOptsFor (undefined)", combatOptsFor(c0) === undefined);

  const c3 = { ...c0, activeTraits: [{ id: "peck", level: 1 }, { id: "guard", level: 1 }, { id: "burst", level: 1 }] };
  const cfg3 = resolveCombatConfig(c3);
  check("Character avec 3 Traits actifs équipés → traitMode=true", cfg3.traitMode === true);
  check("kit résolu porte bien les 3 Traits équipés", cfg3.kit.actions.map((m) => m.id).sort().join(",") === "burst,guard,peck");
  check("cohérent avec combatOptsFor (défini)", combatOptsFor(c3) !== undefined);
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
