// Tests headless du draft de level-up (T008). Exécuter : npx tsx draft.test.ts
import { generateDraft, applyDraftChoice, draftLabel, type DraftOption } from "./draft";
import { makeCharacter } from "./progression";
import { SPECIES } from "./data";
import { makeRng } from "./rng";
import type { Character, SpeciesDef } from "./types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const sp: SpeciesDef = SPECIES.poofowl;

console.log("DRAFT — Niveau 1 (un seul Trait actif) : draft propose surtout des nouveautés");
{
  const c = makeCharacter("poofowl");
  check("Character niv.1 a exactement 1 Trait actif équipé", c.activeTraits?.length === 1);
  check("aucun Trait passif au départ", !c.passiveTrait);
  const rng = makeRng(1);
  const draft = generateDraft(c, sp, rng);
  check("draft non vide", draft.length > 0);
  check("pas de doublon d'id dans le tirage", new Set(draft.map((o) => o.id)).size === draft.length, JSON.stringify(draft));
  // avec 1 seul Trait non-maxé, la règle des 3 interdit une 2e amélioration
  const upgradeCount = draft.filter((o) => o.kind === "upgradeActive" || o.kind === "upgradePassive").length;
  check("règle des 3 : au plus 1 amélioration proposée (1 seul Trait non-maxé)", upgradeCount <= 1, JSON.stringify(draft));
}

console.log("DRAFT — Règle des 3 : 2e amélioration seulement si ≥3 Traits non-maxés");
{
  let c: Character = makeCharacter("poofowl");
  // équipe 3 actifs + 1 passif, tous niveau 1 (non-maxés) → ≥3 non-maxés
  c = { ...c, activeTraits: [{ id: "peck", level: 1 }, { id: "guard", level: 1 }, { id: "burst", level: 1 }], passiveTrait: { id: "regen", level: 1 } };
  let sawDoubleUpgrade = false;
  for (let seed = 0; seed < 50; seed++) {
    const draft = generateDraft(c, sp, makeRng(seed));
    const upgradeCount = draft.filter((o) => o.kind === "upgradeActive" || o.kind === "upgradePassive").length;
    if (upgradeCount >= 2) sawDoubleUpgrade = true;
  }
  check("avec ≥3 Traits non-maxés, une 2e amélioration apparaît sur un échantillon de seeds", sawDoubleUpgrade);

  // tous maxés sauf un seul → à nouveau bridé à 1 amélioration max
  const cAlmostMaxed: Character = {
    ...c,
    activeTraits: [{ id: "peck", level: 3 }, { id: "guard", level: 3 }, { id: "burst", level: 1 }],
    passiveTrait: { id: "regen", level: 3 },
  };
  let sawDoubleUpgrade2 = false;
  for (let seed = 0; seed < 50; seed++) {
    const draft = generateDraft(cAlmostMaxed, sp, makeRng(seed));
    const upgradeCount = draft.filter((o) => o.kind === "upgradeActive" || o.kind === "upgradePassive").length;
    if (upgradeCount >= 2) sawDoubleUpgrade2 = true;
  }
  check("avec 1 seul Trait non-maxé, jamais 2 améliorations dans le même tirage", !sawDoubleUpgrade2);
}

console.log("DRAFT — Pondération par rareté (palier 3 = plus rare que palier 2)");
{
  let c: Character = makeCharacter("poofowl");
  c = { ...c, activeTraits: [{ id: "peck", level: 1 }, { id: "guard", level: 2 }, { id: "burst", level: 1 }] };
  let toLevel2 = 0, toLevel3 = 0;
  const N = 400;
  for (let seed = 0; seed < N; seed++) {
    const draft = generateDraft(c, sp, makeRng(seed), 1);
    for (const o of draft) {
      if ((o.kind === "upgradeActive" || o.kind === "upgradePassive")) {
        if (o.toLevel === 2) toLevel2++;
        if (o.toLevel === 3) toLevel3++;
      }
    }
  }
  check(`palier 2 tiré plus souvent que palier 3 (${toLevel2} vs ${toLevel3})`, toLevel2 > toLevel3, `${toLevel2}/${toLevel3}`);
}

console.log("DRAFT — Respecte le pool de l'espèce (aucun Trait hors pool proposé)");
{
  const customSp: SpeciesDef = { ...sp, traitPool: ["peck", "guard", "regen"] };
  const c = makeCharacter("poofowl"); // départ : 1 seul actif (peck ou équivalent), voir startTrait
  for (let seed = 0; seed < 20; seed++) {
    const draft = generateDraft(c, customSp, makeRng(seed));
    for (const o of draft) {
      if (o.kind === "newActive" || o.kind === "newPassive") {
        check(`option "${o.id}" appartient au pool restreint`, customSp.traitPool!.includes(o.id));
      }
    }
  }
}

console.log("DRAFT — Application d'un choix (upgrade / nouveau actif / nouveau passif)");
{
  let c: Character = makeCharacter("poofowl");
  c = { ...c, traitPoints: 3 };
  const upgradeChoice: DraftOption = { kind: "upgradeActive", id: c.activeTraits![0].id, fromLevel: 1, toLevel: 2 };
  const afterUpgrade = applyDraftChoice(c, upgradeChoice);
  check("upgrade : le Trait passe bien au palier visé", afterUpgrade.activeTraits!.find((t) => t.id === upgradeChoice.id)!.level === 2);
  check("traitPoints décrémenté après un choix", afterUpgrade.traitPoints === 2);

  const newActiveChoice: DraftOption = { kind: "newActive", id: "guard" };
  const afterNewActive = applyDraftChoice(afterUpgrade, newActiveChoice);
  check("nouveau Trait actif ajouté (2 actifs équipés)", afterNewActive.activeTraits!.length === 2 && afterNewActive.activeTraits!.some((t) => t.id === "guard" && t.level === 1));

  const newPassiveChoice: DraftOption = { kind: "newPassive", id: "regen" };
  const afterNewPassive = applyDraftChoice(afterNewActive, newPassiveChoice);
  check("nouveau Trait passif équipé", afterNewPassive.passiveTrait?.id === "regen" && afterNewPassive.passiveTrait?.level === 1);
  check("traitPoints jamais négatif même après 3 choix", afterNewPassive.traitPoints === 0);

  const extra = applyDraftChoice(afterNewPassive, { kind: "upgradePassive", id: "regen", fromLevel: 1, toLevel: 2 });
  check("traitPoints plafonne à 0 (pas de choix en trop)", extra.traitPoints === 0);
}

console.log("DRAFT — draftLabel produit un libellé lisible pour chaque type d'option");
{
  const opts: DraftOption[] = [
    { kind: "upgradeActive", id: "peck", fromLevel: 1, toLevel: 2 },
    { kind: "upgradePassive", id: "regen", fromLevel: 1, toLevel: 2 },
    { kind: "newActive", id: "guard" },
    { kind: "newPassive", id: "stoneskin" },
  ];
  for (const o of opts) {
    const label = draftLabel(o);
    check(`libellé non vide pour ${o.kind}`, label.name.length > 0 && label.icon.length > 0 && label.desc.length > 0);
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
