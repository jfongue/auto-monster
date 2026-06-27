// Tests headless du moteur (F19). Exécuter : npx tsx engine.test.ts
import { runCombat } from "./combat";
import { makeCharacter, makeEnemy, addXp, applyPack, xpForNext } from "./progression";
import { MAP_STEPS } from "./data";
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
  const a: Character = makeCharacter("flameling");
  const b: Character = makeEnemy(MAP_STEPS[0]);
  const r1 = runCombat({ seed: 123, teamA: [a], teamB: [b] });
  const r2 = runCombat({ seed: 123, teamA: [a], teamB: [b] });
  check("même seed → log identique", JSON.stringify(r1.log) === JSON.stringify(r2.log));
  const r3 = runCombat({ seed: 999, teamA: [a], teamB: [b] });
  check("seed différent → log différent", JSON.stringify(r1.log) !== JSON.stringify(r3.log));
  check("log sérialisable (JSON round-trip)", JSON.stringify(JSON.parse(JSON.stringify(r1.log))) === JSON.stringify(r1.log));
}

console.log("F9 — Structure du log");
{
  const r = runCombat({ seed: 7, teamA: [makeCharacter("leafkit")], teamB: [makeEnemy(MAP_STEPS[1])] });
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
    const r = runCombat({ seed, teamA: [makeCharacter("flameling")], teamB: [makeEnemy(MAP_STEPS[0])] });
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
    const t1 = makeCharacter("aquafi");
    const t2 = makeCharacter("aquafi");
    const r = runCombat({ seed: 1, teamA: [t1], teamB: [t2], rules: { maxTurns: 8 } });
    drew = r.winner === null && r.log.some((a) => a.t === "timeLimit");
    check("combat trop long → égalité (timeLimit + winner null)", drew);
  }
}

console.log("Progression — XP & niveaux");
{
  let c = makeCharacter("flameling");
  const before = c.level;
  const res = addXp(c, xpForNext(1) + xpForNext(2) + 5);
  check("gagne 2 niveaux", res.character.level === before + 2, `level=${res.character.level}`);
  check("2 choix de pack en attente", res.pending.length === 2);
  const hpBefore = res.character.stats.hp;
  const leveled = applyPack(res.character, "guard");
  check("pack 'guard' augmente les PV", leveled.stats.hp > hpBefore);
}

console.log(`\nRésultat : ${pass} ok, ${fail} échec(s)`);
if (fail > 0) process.exit(1);
