// Simulation de masse (F19) : distribution des issues, équilibrage.
import { runCombat } from "./combat";
import { makeCharacter, makeEnemy, addXp } from "./progression";
import { MAP_LOCATIONS as MAP_STEPS } from "./data";
import type { Character } from "./types";

function dist(label: string, build: () => { a: Character; step: number }, n = 400, maxTurns = 120) {
  let w = 0, l = 0, d = 0, sumTurns = 0;
  for (let s = 0; s < n; s++) {
    const { a, step } = build();
    const r = runCombat({ seed: s * 31 + 1, teamA: [a], teamB: [makeEnemy(MAP_STEPS[step])], rules: { maxTurns } });
    if (r.winner === 0) w++;
    else if (r.winner === 1) l++;
    else d++;
    sumTurns += r.log.filter((x) => x.t === "damage" || x.t === "dodge").length;
  }
  console.log(`${label.padEnd(34)} V:${((w / n) * 100).toFixed(0)}% D:${((l / n) * 100).toFixed(0)}% =:${((d / n) * 100).toFixed(0)}%  ~${(sumTurns / n).toFixed(0)} échanges`);
}

console.log("Distribution des issues (V victoire / D défaite / = égalité)\n");

// Starters niveau 1 sur les 4 premières étapes
for (const sp of ["flameling", "aquafi", "leafkit"]) {
  for (let step = 0; step < 4; step++) {
    dist(`${sp} L1 vs étape ${step + 1}`, () => ({ a: makeCharacter(sp), step }));
  }
  console.log("");
}

// Boss en plusieurs parties : PV du boss persistent, joueur soigné entre parties.
function bossRun(buildAM: () => Character, n = 200) {
  let totalParties = 0, draws = 0, deaths = 0, fails = 0;
  for (let s = 0; s < n; s++) {
    const am = buildAM();
    const boss = makeEnemy(MAP_STEPS[4]);
    let bossLife = boss.stats.hp;
    let parties = 0;
    while (bossLife > 0 && parties < 30) {
      parties++;
      const a = { ...am, life: am.stats.hp }; // soin complet entre parties
      const b = { ...boss, life: bossLife };
      const r = runCombat({ seed: s * 97 + parties * 7, teamA: [a], teamB: [b], rules: { maxTurns: 40 } });
      const bStat = r.stats.find((x) => x.side === 1)!;
      bossLife = bStat.lifeLeft;
      if (r.winner === null) draws++;
      if (r.winner === 1) deaths++;
    }
    if (bossLife > 0) fails++;
    totalParties += parties;
  }
  console.log(`  boss vaincu en ~${(totalParties / n).toFixed(1)} parties (égalités/run dominantes, ${fails} échecs sur ${n})`);
}

console.log("\nBOSS (PV persistants, plusieurs parties) :");
console.log("flameling L1 brut :");
bossRun(() => makeCharacter("flameling"));
console.log("aquafi niveau ~4 (XP, stats auto) :");
bossRun(() => addXp(makeCharacter("aquafi"), 400).character);
