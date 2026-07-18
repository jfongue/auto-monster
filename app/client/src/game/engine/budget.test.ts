// Tests headless du budget de rang (T010). Exécuter : npx tsx budget.test.ts
import { teamRankSum, canAlignTeam, ENABLE_2V2, RANK_BUDGET } from "./data";
import { makeCharacter } from "./progression";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

console.log("BUDGET DE RANG — État actuel (2v2 désactivé)");
{
  check("ENABLE_2V2 = false (structure prête, non activée)", ENABLE_2V2 === false);
  check("RANK_BUDGET = 4", RANK_BUDGET === 4);
  const solo = [makeCharacter("poofowl")];
  check("un seul AM rang 1 : alignable", canAlignTeam(solo));
  const two = [makeCharacter("poofowl"), makeCharacter("emberpup")];
  check("2 AM refusés tant qu'ENABLE_2V2 est false, même sous le budget", !canAlignTeam(two));
}

console.log("BUDGET DE RANG — Règle générale (2+2 / 3+1 / rang 4 seul), prête pour l'activation du 2v2");
{
  check("équipe vide : toujours alignable", canAlignTeam([]));
  check("somme des rangs (2+2)", teamRankSum([{ rank: 2 }, { rank: 2 }]) === 4);
  check("somme des rangs (3+1)", teamRankSum([{ rank: 3 }, { rank: 1 }]) === 4);
  check("rang manquant => replié sur 1 (comme DEFAULT_RANK)", teamRankSum([{}, {}]) === 2);

  // Ces cas simulent l'état "2v2 activé" en composant directement les rangs (indépendant du flag).
  const under = [{ rank: 2 }, { rank: 2 }];
  const over = [{ rank: 3 }, { rank: 2 }];
  const soloRank4 = [{ rank: 4 }];
  const tooMany = [{ rank: 1 }, { rank: 1 }, { rank: 1 }];
  check("2+2 = budget exact (4) : dans la règle de somme", teamRankSum(under) <= RANK_BUDGET);
  check("3+2 = 5 > budget : hors règle de somme", teamRankSum(over) > RANK_BUDGET);
  check("un seul AM de rang 4 : dans la règle de somme", teamRankSum(soloRank4) <= RANK_BUDGET);
  check("3 AM refusés (max 2 alignés, même sous le flag 2v2)", !canAlignTeam(tooMany));
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
