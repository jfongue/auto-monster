// Tests headless de la barre sociale (T009). Exécuter : npx tsx social.test.ts
import { makeCharacter, socialOf, socialLabel, interact, giveToy, registerCombatSocial } from "./progression";
import { SOCIAL_START, SOCIAL_MIN, SOCIAL_MAX } from "./data";
import type { Character } from "./types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

function withAffinity(c: Character, patch: Partial<Record<"caresser" | "coacher" | "observer" | "jouets" | "coups", number>>): Character {
  return { ...c, personality: { ...c.personality!, affinity: { ...c.personality!.affinity, ...patch } } };
}

console.log("BARRE SOCIALE — Valeur par défaut & bornes");
{
  const c = makeCharacter("poofowl");
  check("social par défaut = SOCIAL_START", socialOf(c) === SOCIAL_START);
  check("socialLabel ne plante pas", typeof socialLabel(c) === "string" && socialLabel(c).length > 0);
}

console.log("BARRE SOCIALE — Caresser : toujours monte (jamais de baisse), plus fort si aimé");
{
  const c0 = makeCharacter("poofowl");
  const lover = withAffinity(c0, { caresser: 0.9 });
  const hater = withAffinity(c0, { caresser: -0.9 });
  const rGood = (i: number) => [0.9, 0.9, 0.9][i % 3]; // force score > 0
  let calls = 0;
  const randHigh = () => { calls++; return 0.9; };
  const resLove = interact(lover, "caresser", Date.now(), randHigh);
  const resHate = interact(hater, "caresser", Date.now(), randHigh);
  check("caresser (aimé) : socialDelta > 0", resLove.socialDelta > 0, `got ${resLove.socialDelta}`);
  check("caresser (détesté, mais score forcé positif par le rand) : socialDelta > 0 aussi (toujours monte)", resHate.socialDelta > 0, `got ${resHate.socialDelta}`);
  check("caresser (aimé) monte plus que (détesté)", resLove.socialDelta >= resHate.socialDelta);
}

console.log("BARRE SOCIALE — Coacher : peut monter OU baisser selon l'individu");
{
  const c0 = makeCharacter("poofowl");
  const lover = withAffinity(c0, { coacher: 0.9 });
  const hater = withAffinity(c0, { coacher: -0.9 });
  const resGood = interact(lover, "coacher", Date.now(), () => 0.9);
  const resBad = interact(hater, "coacher", Date.now(), () => 0.1);
  check("coacher apprécié : socialDelta > 0", resGood.socialDelta > 0, `got ${resGood.socialDelta}`);
  check("coacher détesté : socialDelta < 0", resBad.socialDelta < 0, `got ${resBad.socialDelta}`);
}

console.log("BARRE SOCIALE — Observer : ne change jamais la barre, révèle un indice");
{
  const c = makeCharacter("poofowl");
  const res = interact(c, "observer", Date.now(), () => 0.9);
  check("observer : socialDelta === 0", res.socialDelta === 0, `got ${res.socialDelta}`);
  check("observer : texte non vide (indice)", res.text.length > 0);
  check("observer : le texte mentionne le nom de l'individu", res.text.includes(c.name));
}

console.log("BARRE SOCIALE — Jouets : toujours monte (objet consommable)");
{
  const c0 = makeCharacter("poofowl");
  const lover = withAffinity(c0, { jouets: 0.9 });
  const meh = withAffinity(c0, { jouets: -0.9 });
  const resLove = giveToy(lover, Date.now(), () => 0.9);
  const resMeh = giveToy(meh, Date.now(), () => 0.9);
  check("jouet (aimé) : socialDelta > 0", resLove.socialDelta > 0, `got ${resLove.socialDelta}`);
  check("jouet (indifférent, score forcé positif) : socialDelta > 0 aussi", resMeh.socialDelta > 0, `got ${resMeh.socialDelta}`);
}

console.log("BARRE SOCIALE — Combat : participation (flat) + coups encaissés (signé selon affinité)");
{
  const c0 = makeCharacter("poofowl");
  const before = socialOf(c0);
  const untouched = registerCombatSocial(c0, 0);
  check("combat sans dégâts reçus : la barre monte quand même (participation)", socialOf(untouched) > before);

  const brave = withAffinity(c0, { coups: 0.9 }); // aime prendre des coups
  const fragile = withAffinity(c0, { coups: -0.9 }); // déteste ça
  const braveHit = registerCombatSocial(brave, 1); // 100% des PV perdus
  const fragileHit = registerCombatSocial(fragile, 1);
  check("coups encaissés + affinité positive : gain net plus élevé", socialOf(braveHit) > socialOf(untouched));
  check("coups encaissés + affinité négative : peut faire baisser la barre malgré le flat de combat", socialOf(fragileHit) < socialOf(brave));
}

console.log("BARRE SOCIALE — Bornes 0..100 respectées");
{
  const c = { ...makeCharacter("poofowl"), social: SOCIAL_MAX };
  const stillMax = registerCombatSocial(withAffinity(c, { coups: 0.99 }), 0);
  check("plafonne à SOCIAL_MAX", socialOf(stillMax) <= SOCIAL_MAX);
  const cLow = { ...makeCharacter("poofowl"), social: SOCIAL_MIN };
  const stillMin = registerCombatSocial(withAffinity(cLow, { coups: -0.99 }), 1);
  check("plancher à SOCIAL_MIN", socialOf(stillMin) >= SOCIAL_MIN);
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
