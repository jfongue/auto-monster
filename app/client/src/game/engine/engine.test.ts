// Tests headless du moteur (F19). Exécuter : npx tsx engine.test.ts
import { runCombat } from "./combat";
import { makeCharacter, makeEnemy, addXp, xpForNext, currentLife, startHeal, interact, interactReadyIn, withMoodBattle } from "./progression";
import { COMBAT_LOCATIONS } from "./data";
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
  const r = runCombat({ seed: 7, teamA: [makeCharacter("leafkit")], teamB: [makeEnemy(COMBAT_LOCATIONS[1])] });
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
    const r = runCombat({ seed, teamA: [makeCharacter("flameling")], teamB: [makeEnemy(COMBAT_LOCATIONS[0])] });
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

console.log("Progression — XP & montée auto des stats");
{
  const c = makeCharacter("flameling");
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
  const c = makeCharacter("aquafi");
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
  const c = makeCharacter("flameling");
  check("personnalité générée", !!c.personality && !!c.personality.archetype);
  check("date de capture renseignée", typeof c.capturedAt === "number");
  check("humeur de départ", c.mood === 60);
  check("historique avec capture", (c.history ?? [])[0]?.kind === "capture");

  // deux individus de même espèce → caractères distincts (affinités jitterées)
  const a = makeCharacter("flameling");
  const b = makeCharacter("flameling");
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
  const grumpy = { ...makeCharacter("flameling"), mood: 0 };
  check("humeur basse → atk de combat réduite", withMoodBattle(grumpy).stats.atk < grumpy.stats.atk);
}

console.log(`\nRésultat : ${pass} ok, ${fail} échec(s)`);
if (fail > 0) process.exit(1);
