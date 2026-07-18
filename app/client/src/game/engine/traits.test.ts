// Tests headless du modèle de Traits (T006). Exécuter : npx tsx traits.test.ts
import { ACTIVE_TRAITS, PASSIVE_TRAITS, kitFromActiveTraits, resolveActiveKit, passiveBonusOf, combatOptsFor } from "./traits";
import { autoSim, KITS } from "./live";
import { makeLeveledCharacter, makeEnemy } from "./progression";
import { COMBAT_LOCATIONS } from "./data";
import type { EquippedTrait, Character } from "./types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

console.log("TRAITS — Catalogue actif (conversion des 12 actions de kit)");
{
  const expectedIds = ["peck", "guard", "burst", "claw", "ember", "rush", "spit", "spores", "bash", "strike", "dodge", "riposte"];
  check("12 Traits actifs présents", expectedIds.every((id) => !!ACTIVE_TRAITS[id]), Object.keys(ACTIVE_TRAITS).join(","));
  check("aucun Trait actif en trop", Object.keys(ACTIVE_TRAITS).length === expectedIds.length, Object.keys(ACTIVE_TRAITS).join(","));
  for (const id of expectedIds) {
    const def = ACTIVE_TRAITS[id];
    check(`${id} : 3 paliers`, def.levels.length === 3);
    const [l1, , l3] = def.levels;
    if (l1.power != null) check(`${id} : palier 3 > palier 1 (power)`, l3.power! > l1.power!);
    if (l1.burn != null) check(`${id} : palier 3 > palier 1 (burn)`, l3.burn! > l1.burn!);
    if (l1.poison != null) check(`${id} : palier 3 > palier 1 (poison)`, l3.poison! > l1.poison!);
    if (l1.reflect != null) check(`${id} : palier 3 > palier 1 (reflect)`, l3.reflect! > l1.reflect!);
  }
}

console.log("TRAITS — Catalogue passif (conversion des talents)");
{
  const talentIds = ["ember", "frenzy", "fournaise", "embrasement", "pyromane", "inoculation", "virulence", "stoneskin", "thorns", "spores", "secondwind", "swift", "evasion", "regen", "ponction", "sangsue", "riposte", "contreParfait", "elan", "danse"];
  check("20 Traits passifs présents", talentIds.every((id) => !!PASSIVE_TRAITS[id]));
  for (const id of talentIds) {
    const def = PASSIVE_TRAITS[id];
    check(`${id} : 3 paliers, value croissante`, def.levels[2].value! > def.levels[0].value!);
  }
}

console.log("TRAITS — Construction d'un kit depuis 3 Traits actifs équipés");
{
  const eq: EquippedTrait[] = [{ id: "claw", level: 3 }, { id: "ember", level: 3 }, { id: "rush", level: 3 }];
  const kit = kitFromActiveTraits(eq);
  check("3 actions + charger", kit.actions.length === 3 && kit.charge.id === "wait");
  check("au moins une attaque", kit.actions.some((m) => m.kind === "atk"));
  check("ids = Traits équipés", kit.actions.map((m) => m.id).join(",") === "claw,ember,rush");
  check("special = combo (claw/rush combo)", kit.special === "combo");

  // mélange incluant une défense (guard) → special hérité de la défense
  const eqDef: EquippedTrait[] = [{ id: "peck", level: 1 }, { id: "guard", level: 2 }, { id: "burst", level: 1 }];
  const kitDef = kitFromActiveTraits(eqDef);
  check("special = guard (Trait défensif équipé)", kitDef.special === "guard");

  check("resolveActiveKit(undefined) = fallback legacy", resolveActiveKit(undefined) === undefined);
  check("resolveActiveKit(<3 traits) = fallback legacy", resolveActiveKit([{ id: "peck", level: 1 }]) === undefined);
  check("resolveActiveKit(3 traits) = kit construit", !!resolveActiveKit(eq));
}

console.log("TRAITS — Niveaux 1-3 effectifs en combat (dégâts moyens palier 3 > palier 1)");
{
  const lvl1: EquippedTrait[] = [{ id: "strike", level: 1 }, { id: "dodge", level: 1 }, { id: "riposte", level: 1 }];
  const lvl3: EquippedTrait[] = [{ id: "strike", level: 3 }, { id: "dodge", level: 3 }, { id: "riposte", level: 3 }];
  const kit1 = kitFromActiveTraits(lvl1);
  const kit3 = kitFromActiveTraits(lvl3);
  let dmg1 = 0, dmg3 = 0;
  const N = 30;
  for (let s = 0; s < N; s++) {
    const p = makeLeveledCharacter("haloux", 5);
    const e = makeEnemy(COMBAT_LOCATIONS[0]);
    dmg1 += autoSim(p, e, 2000 + s, 200, { kit: kit1, traitMode: true }).pDamageDealt;
    dmg3 += autoSim(p, e, 2000 + s, 200, { kit: kit3, traitMode: true }).pDamageDealt;
  }
  check(`palier 3 inflige plus de dégâts en moyenne (${dmg3}/${N} vs ${dmg1}/${N})`, dmg3 > dmg1);
}

console.log("TRAITS — Bonus passif appliqué (vol de vie relève les PV restants)");
{
  const none = passiveBonusOf(undefined);
  check("aucun passif = bonus neutre", none.atkMult === 0 && none.lifesteal === 0 && none.dmgTakenMult === 1);
  const sangsue = passiveBonusOf({ id: "sangsue", level: 3 });
  check("sangsue palier 3 : vol de vie > 0.5", sangsue.lifesteal > 0.5, String(sangsue.lifesteal));

  let lifeNone = 0, lifeLifesteal = 0;
  const N = 20;
  for (let s = 0; s < N; s++) {
    const p = makeLeveledCharacter("poofowl", 5);
    const e = makeEnemy(COMBAT_LOCATIONS[0]);
    lifeNone += autoSim(p, e, 3000 + s).pLifeLeft;
    lifeLifesteal += autoSim(p, e, 3000 + s, 200, { passiveBonus: sangsue }).pLifeLeft;
  }
  check(`vol de vie augmente les PV restants moyens (${lifeLifesteal}/${N} vs ${lifeNone}/${N})`, lifeLifesteal >= lifeNone);
}

console.log("TRAITS — Zéro régression : autoSim sans opts = comportement legacy inchangé");
{
  const p = makeLeveledCharacter("poofowl", 4);
  const e = makeEnemy(COMBAT_LOCATIONS[0]);
  const legacyKit = KITS.poofowl;
  const r1 = autoSim(p, e, 555);
  const r2 = autoSim(p, e, 555, 200, { kit: legacyKit });
  check("kit legacy explicite = même résultat que sans opts", JSON.stringify(r1) === JSON.stringify(r2));
}

console.log("T007 — Character : Rang/Stamina (nouveau modèle de progression)");
{
  const p = makeLeveledCharacter("poofowl", 3);
  check("rank par défaut = 1", p.rank === 1);
  check("stamina par défaut posée", typeof p.stamina === "number" && p.stamina! > 0);
}

console.log("T007 — Mode Traits : plus de principe de défense (DEF de la cible sans effet)");
{
  const eq: EquippedTrait[] = [{ id: "strike", level: 2 }, { id: "dodge", level: 2 }, { id: "riposte", level: 2 }];
  const kit = kitFromActiveTraits(eq);
  const p = makeLeveledCharacter("haloux", 5);
  const eLowDef = makeEnemy(COMBAT_LOCATIONS[0]);
  const eHighDef = { ...eLowDef, stats: { ...eLowDef.stats, def: eLowDef.stats.def + 500 } };
  const r1 = autoSim(p, eLowDef, 4242, 200, { kit, traitMode: true });
  const r2 = autoSim(p, eHighDef, 4242, 200, { kit, traitMode: true });
  check("DEF de la cible (même énorme) ne change rien en mode Traits", JSON.stringify(r1) === JSON.stringify(r2), `${r1.pDamageDealt} vs ${r2.pDamageDealt}`);

  // même test SANS traitMode : la DEF doit alors réduire les dégâts (comportement legacy conservé)
  const r3 = autoSim(p, eLowDef, 4242, 200, { kit });
  const r4 = autoSim(p, eHighDef, 4242, 200, { kit });
  check("sans traitMode, la DEF de la cible réduit toujours les dégâts (legacy)", r4.pDamageDealt < r3.pDamageDealt, `${r4.pDamageDealt} vs ${r3.pDamageDealt}`);
}

console.log("T007 — combatOptsFor : point d'entrée combat réel depuis un Character");
{
  const noTraits = makeLeveledCharacter("poofowl", 3);
  check("Character sans Traits équipés → combatOptsFor = undefined (fallback legacy)", combatOptsFor(noTraits) === undefined);

  const withTraits: Character = {
    ...makeLeveledCharacter("haloux", 5),
    activeTraits: [{ id: "strike", level: 2 }, { id: "dodge", level: 2 }, { id: "riposte", level: 2 }],
    passiveTrait: { id: "ember", level: 2 },
  };
  const opts = combatOptsFor(withTraits);
  check("Character avec 3 Traits actifs → opts définis, traitMode=true", !!opts && opts.traitMode === true);
  check("le kit résolu porte bien les 3 Traits équipés", opts!.kit!.actions.map((m) => m.id).join(",") === "strike,dodge,riposte");
  const e = makeEnemy(COMBAT_LOCATIONS[0]);
  const r = autoSim(withTraits, e, 1, 200, opts);
  check("combatOptsFor est directement utilisable par autoSim (combat termine)", r.ticks <= 200 && (r.winner === 0 || r.winner === 1 || r.winner === null));
}

console.log("T012 — Vérification des 4 mécaniques spéciales (garde/combo/poison/esquive) pilotées par des Traits custom");
{
  // Reproduit exactement le kit "naturel" de chaque espèce via 3 Traits actifs équipés (au lieu
  // du kit fixe KITS[espèce]) — vérifie que resolveCombatConfig/kitFromActiveTraits/autoSim
  // restent cohérents pour les 4 mécaniques spéciales, en lieu d'une vérification manuelle en
  // navigateur (Playwright indisponible dans le bac à sable, cf T005/limites d'environnement).
  const LOADOUTS: { label: string; speciesId: string; special: string; ids: [string, string, string] }[] = [
    { label: "garde (Poofowl)", speciesId: "poofowl", special: "guard", ids: ["peck", "guard", "burst"] },
    { label: "combo (Emberpup)", speciesId: "emberpup", special: "combo", ids: ["claw", "ember", "rush"] },
    { label: "poison (Fungoot)", speciesId: "fungoot", special: "poison", ids: ["spit", "spores", "bash"] },
    { label: "esquive (Haloux)", speciesId: "haloux", special: "dodge", ids: ["strike", "dodge", "riposte"] },
  ];
  for (const lo of LOADOUTS) {
    const c: Character = {
      ...makeLeveledCharacter(lo.speciesId, 5),
      activeTraits: lo.ids.map((id) => ({ id, level: 2 })) as EquippedTrait[],
    };
    const opts = combatOptsFor(c);
    check(`${lo.label} : combatOptsFor défini (3 Traits équipés)`, !!opts);
    check(`${lo.label} : special résolu = ${lo.special}`, opts!.kit!.special === lo.special);
    let terminated = 0, decided = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const e = makeEnemy(COMBAT_LOCATIONS[seed % COMBAT_LOCATIONS.length]);
      const r = autoSim(c, e, seed, 200, opts);
      if (r.ticks <= 200) terminated++;
      if (r.winner === 0 || r.winner === 1) decided++;
    }
    check(`${lo.label} : tous les combats terminent (20/20)`, terminated === 20, `${terminated}/20`);
    check(`${lo.label} : majoritairement décisifs`, decided >= 15, `${decided}/20`);
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
