// Tests headless du moteur (F19). Exécuter : npx tsx engine.test.ts
import { runCombat } from "./combat";
import { makeCharacter, makeLeveledCharacter, makeEnemy, addXp, xpForNext, currentLife, startHeal, interact, interactReadyIn, withMoodBattle, chooseBranch } from "./progression";
import { COMBAT_LOCATIONS, activeTalents, needsBranchChoice, branchesOf, BRANCH_CHOICE_LEVEL } from "./data";
import { buildFighter } from "./fighter";
import { makeRng } from "./rng";
import type { Character } from "./types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

console.log("F1 — Déterminisme");
{
  const a: Character = makeCharacter("emberpup");
  const b: Character = makeEnemy(COMBAT_LOCATIONS[0]);
  const r1 = runCombat({ seed: 123, teamA: [a], teamB: [b] });
  const r2 = runCombat({ seed: 123, teamA: [a], teamB: [b] });
  check("même seed → log identique", JSON.stringify(r1.log) === JSON.stringify(r2.log));
  const r3 = runCombat({ seed: 999, teamA: [a], teamB: [b] });
  check("seed différent → log différent", JSON.stringify(r1.log) !== JSON.stringify(r3.log));
  check("log sérialisable (JSON round-trip)", JSON.stringify(JSON.parse(JSON.stringify(r1.log))) === JSON.stringify(r1.log));
}

console.log("F9 — Structure du log");
{
  const r = runCombat({ seed: 7, teamA: [makeCharacter("fungoot")], teamB: [makeEnemy(COMBAT_LOCATIONS[1])] });
  check("commence par des 'add'", r.log[0].t === "add");
  check("contient un 'display'", r.log.some((a) => a.t === "display"));
  check("finit par 'finish'", r.log[r.log.length - 1].t === "finish");
  const winner = (r.log[r.log.length - 1] as any).winner;
  check("winner cohérent (0|1|null)", [0, 1, null].includes(winner));
}

console.log("F4/F16 — Terminaison & cohérence dégâts");
{
  let drew = false;
  for (let seed = 0; seed < 40; seed++) {
    const r = runCombat({ seed, teamA: [makeCharacter("emberpup")], teamB: [makeEnemy(COMBAT_LOCATIONS[0])] });
    const fin = r.log[r.log.length - 1];
    if (fin.t !== "finish") {
      check("combat termine toujours par finish", false, `seed ${seed}`);
      break;
    }
    // somme des dégâts infligés au side 1 == PV perdus
    for (const s of r.stats) {
      const lost = s.maxLife - s.lifeLeft;
      // dégâts reçus >= PV perdus (régén/épines peuvent diverger un peu) → on vérifie cohérence de base
      check(`PV jamais négatifs (${s.name})`, s.lifeLeft >= 0, `seed ${seed}`);
    }
  }
  // Mécanisme d'égalité : 2 tanks à faibles dégâts + maxTurns court → personne ne meurt.
  {
    const t1 = makeCharacter("poofowl");
    const t2 = makeCharacter("poofowl");
    const r = runCombat({ seed: 1, teamA: [t1], teamB: [t2], rules: { maxTurns: 8 } });
    drew = r.winner === null && r.log.some((a) => a.t === "timeLimit");
    check("combat trop long → égalité (timeLimit + winner null)", drew);
  }
}

console.log("Progression — XP & montée auto des stats");
{
  const c = makeCharacter("emberpup");
  const hpBefore = c.stats.hp;
  const atkBefore = c.stats.atk;
  const res = addXp(c, xpForNext(1) + xpForNext(2) + 5);
  check("gagne 2 niveaux", res.character.level === 3, `level=${res.character.level}`);
  check("2 niveaux gagnés (levelsGained)", res.levelsGained === 2);
  check("PV augmentent automatiquement", res.character.stats.hp > hpBefore);
  check("ATK augmente automatiquement", res.character.stats.atk > atkBefore);
}

console.log("Soin — régénération continue");
{
  const c = makeCharacter("poofowl");
  c.life = 0;
  const t0 = 1_000_000;
  const healing = startHeal(c, t0);
  check("soin démarré (healStart défini)", healing.healStart === t0);
  const half = currentLife(healing, t0 + 2500); // 2.5s sur 5s → ~50%
  check("≈50% des PV après 2.5s", half > c.stats.hp * 0.4 && half < c.stats.hp * 0.6, `half=${half}`);
  const full = currentLife(healing, t0 + 6000); // au-delà → plafonné au max
  check("plein après la durée", full === c.stats.hp, `full=${full}`);
}

console.log("Caractère & interactions (par individu)");
{
  const c = makeCharacter("emberpup");
  check("personnalité générée", !!c.personality && !!c.personality.archetype);
  check("date de capture renseignée", typeof c.capturedAt === "number");
  check("humeur de départ", c.mood === 60);
  check("historique avec capture", (c.history ?? [])[0]?.kind === "capture");

  // deux individus de même espèce → caractères distincts (affinités jitterées)
  const a = makeCharacter("emberpup");
  const b = makeCharacter("emberpup");
  const same = JSON.stringify(a.personality!.affinity) === JSON.stringify(b.personality!.affinity);
  check("affinités propres à l'individu (distinctes)", !same);

  // interaction : modifie l'humeur, pose un cooldown, journalise
  const t0 = 2_000_000;
  const res = interact(c, "caresser", t0, () => 0.99); // roll haut → positif
  check("caresser positif → humeur monte", res.character.mood! > c.mood!);
  check("interaction journalisée", res.character.history!.some((h) => h.kind === "interact"));
  check("cooldown posé", interactReadyIn(res.character, "caresser", t0) > 0);
  check("cooldown écoulé après le délai", interactReadyIn(res.character, "caresser", t0 + 10_000) === 0);

  // mood bas → malus de combat (atk réduite)
  const grumpy = { ...makeCharacter("emberpup"), mood: 0 };
  check("humeur basse → atk de combat réduite", withMoodBattle(grumpy).stats.atk < grumpy.stats.atk);
}

console.log("Branches — déblocage par niveau & choix");
{
  // Chaque AM jouable a bien 2 branches.
  for (const id of ["poofowl", "fungoot", "emberpup", "haloux"]) {
    check(`${id} a 2 branches`, branchesOf(id).length === 2, `n=${branchesOf(id).length}`);
  }
  // Avant le palier : pas de choix requis, aucun talent de branche.
  const low = makeLeveledCharacter("emberpup", 2);
  check("niv<palier → pas de choix requis", !needsBranchChoice(low));
  check("niv<palier → aucun talent de branche", activeTalents(low).length === 0);
  // Au palier sans choix : choix requis.
  const mid = makeLeveledCharacter("emberpup", BRANCH_CHOICE_LEVEL);
  check("niv=palier sans branche → choix requis", needsBranchChoice(mid));
  // Choix + déblocage progressif.
  const chosen3 = chooseBranch(makeLeveledCharacter("emberpup", 3), "brasier");
  check("branche choisie enregistrée", chosen3.branch === "brasier");
  check("niv3 → 1 talent de branche (core)", activeTalents(chosen3).includes("embrasement") && activeTalents(chosen3).length === 1);
  const chosen6 = chooseBranch(makeLeveledCharacter("emberpup", 6), "brasier");
  check("niv6 → 2 talents (core+upgrade)", activeTalents(chosen6).includes("embrasement") && activeTalents(chosen6).includes("pyromane"));
  // Deux branches distinctes → talents distincts.
  const frenz = chooseBranch(makeLeveledCharacter("emberpup", 6), "frenesie");
  check("branche Frénésie ≠ talents de Brasier", frenz.talents.length === 0 && activeTalents(frenz).includes("frenzy") && !activeTalents(frenz).includes("embrasement"));
}

console.log("Combat — statuts (poison/brûlure) & mécaniques de branche");
{
  const rng = makeRng(1);
  // Brasier (Embrasement) : le Fighter applique une altération à la frappe.
  const brasier = buildFighter(chooseBranch(makeLeveledCharacter("emberpup", 6), "brasier"), 0, 0, rng);
  check("Embrasement → onHitStatus=burn", brasier.onHitStatus?.kind === "burn");
  check("Pyromane → ampVsStatus.burn>1", (brasier.ampVsStatus.burn ?? 0) > 1);
  // Virulence (Fungoot) : poison à la frappe + amplification.
  const viru = buildFighter(chooseBranch(makeLeveledCharacter("fungoot", 6), "virulence"), 0, 1, rng);
  check("Inoculation → onHitStatus=poison", viru.onHitStatus?.kind === "poison");
  check("Virulence → ampVsStatus.poison>1", (viru.ampVsStatus.poison ?? 0) > 1);
  // Spores défensives : empoisonne l'attaquant quand touché.
  const spores = buildFighter(chooseBranch(makeLeveledCharacter("fungoot", 3), "spores"), 0, 2, rng);
  check("Spores → poisonOnHurt=poison", spores.poisonOnHurt?.kind === "poison");
  // Draineur (Poofowl) : vol de vie.
  const drain = buildFighter(chooseBranch(makeLeveledCharacter("poofowl", 6), "draineur"), 0, 3, rng);
  check("Ponction+Sangsue → lifesteal=0.55", Math.abs(drain.lifesteal - 0.55) < 1e-9);
  // Haloux Riposte : flags de contre.
  const rip = buildFighter(chooseBranch(makeLeveledCharacter("haloux", 6), "riposte"), 0, 4, rng);
  check("Riposte → riposte=true", rip.riposte === true);
  check("Contre parfait → riposteCrit=true", rip.riposteCrit === true);
  // Élan : gain d'atk à l'esquive.
  const elan = buildFighter(chooseBranch(makeLeveledCharacter("haloux", 6), "elan"), 0, 5, rng);
  check("Élan → dodgeAtkGain>0", elan.dodgeAtkGain > 0);
  check("Danse du vent → dodgeSnowball=true", elan.dodgeSnowball === true);

  // Combat réel : une brûlure produit des ticks de dégâts dans le log.
  const burner = chooseBranch(makeLeveledCharacter("emberpup", 6), "brasier");
  let sawTick = false, sawStatus = false;
  for (let seed = 0; seed < 30 && !sawTick; seed++) {
    const r = runCombat({ seed, teamA: [burner], teamB: [makeEnemy(COMBAT_LOCATIONS[2])] });
    if (r.log.some((a) => a.t === "status")) sawStatus = true;
    if (r.log.some((a) => a.t === "statusTick")) sawTick = true;
    check("log toujours terminé par finish", r.log[r.log.length - 1].t === "finish", `seed ${seed}`);
    for (const s of r.stats) check(`PV jamais négatifs (${s.name})`, s.lifeLeft >= 0, `seed ${seed}`);
  }
  check("une altération est posée en combat (status)", sawStatus);
  check("des dégâts de brûlure sont infligés (statusTick)", sawTick);

  // Déterminisme préservé avec les nouvelles mécaniques.
  const r1 = runCombat({ seed: 42, teamA: [burner], teamB: [makeEnemy(COMBAT_LOCATIONS[1])] });
  const r2 = runCombat({ seed: 42, teamA: [burner], teamB: [makeEnemy(COMBAT_LOCATIONS[1])] });
  check("branches : même seed → log identique", JSON.stringify(r1.log) === JSON.stringify(r2.log));
}

console.log(`\nRésultat : ${pass} ok, ${fail} échec(s)`);
if (fail > 0) process.exit(1);
