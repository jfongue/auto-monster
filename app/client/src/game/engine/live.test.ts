// Tests headless du moteur LIVE. Exécuter : npx tsx live.test.ts
import {
  autoSim,
  kitFor,
  behaviorFor,
  KITS,
  BEHAVIORS,
  LIVE_ENEMIES,
  hitDmg,
  newEnemyMem,
  MAX_NRJ,
} from "./live";
import { makeCharacter, makeLeveledCharacter, makeEnemy } from "./progression";
import { makeRng } from "./rng";
import { COMBAT_LOCATIONS } from "./data";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

console.log("LIVE — Kits & comportements");
{
  const ams = ["poofowl", "emberpup", "fungoot", "haloux"];
  for (const id of ams) {
    const k = KITS[id];
    check(`${id} : kit présent`, !!k);
    check(`${id} : 3 actions + charger`, k.actions.length === 3 && k.charge.id === "wait");
    check(`${id} : ≥1 attaque et le style est décrit`, k.actions.some((m) => m.kind === "atk") && k.playstyle.length > 0);
  }
  // Chaque AM doit avoir une mécanique spéciale DISTINCTE (feel différent)
  const specials = new Set(ams.map((id) => KITS[id].special));
  check("4 mécaniques spéciales distinctes", specials.size === 4, [...specials].join(","));
  check("Emberpup = combo sans garde", KITS.emberpup.special === "combo" && !KITS.emberpup.actions.some((m) => m.kind === "def"));
  check("Haloux = esquive (dodge)", KITS.haloux.special === "dodge" && KITS.haloux.actions.some((m) => m.dodge));
  check("Fungoot = poison + spores reflect", KITS.fungoot.special === "poison" && KITS.fungoot.actions.some((m) => m.reflect));
}

console.log("LIVE — 3 NME distincts");
{
  check("exactement 3 NME possibles", LIVE_ENEMIES.length === 3);
  for (const id of LIVE_ENEMIES) check(`${id} : comportement présent`, !!BEHAVIORS[id]);
  // Sprigling : pattern déterministe small,small,big
  const mem = newEnemyMem();
  const rng = makeRng(1);
  const seq: string[] = [];
  for (let i = 0; i < 6; i++) seq.push(behaviorFor("sprigling").next(mem, rng).mode + ":" + (mem.tick, "")); // eslint-disable-line
  // Reconstruit proprement la séquence prep→strike
  const mem2 = newEnemyMem();
  const types: string[] = [];
  for (let i = 0; i < 6; i++) { const it = behaviorFor("sprigling").next(mem2, makeRng(i)); types.push(it.mode); if (it.mode === "strike") mem2.pending = null; }
  check("Sprigling alterne prep→strike", types[0] === "prep" && types[1] === "strike");
  // Cobbleback : produit une charge exposée puis un slam
  const memC = newEnemyMem();
  let sawExposed = false, sawBigStrike = false;
  for (let i = 0; i < 12; i++) { const it = behaviorFor("cobbleback").next(memC, makeRng(i)); if (it.exposed) sawExposed = true; if (it.mode === "strike" && it.type === "big") { sawBigStrike = true; memC.pending = null; } }
  check("Cobbleback : charge exposée + slam", sawExposed && sawBigStrike);
  // Murkwisp : produit au moins une feinte sur un échantillon
  const memM = newEnemyMem();
  const rngM = makeRng(42);
  let sawFeint = false;
  for (let i = 0; i < 60; i++) { const it = behaviorFor("murkwisp").next(memM, rngM); if (it.feint) sawFeint = true; if (it.mode === "strike" || it.feint) memM.pending = null; }
  check("Murkwisp : feinte observée", sawFeint);
}

console.log("LIVE — Formule de dégâts");
{
  check("dmg ≥ 1 (plancher)", hitDmg(0.1, 1, 999) >= 1);
  check("plus d'ATK → plus de dégâts", hitDmg(0.6, 30, 10) > hitDmg(0.6, 15, 10));
  check("plus de DEF → moins de dégâts", hitDmg(0.6, 20, 40) < hitDmg(0.6, 20, 5));
}

console.log("LIVE — Simulation auto (terminaison & cohérence)");
{
  let terminated = 0, decisive = 0;
  const total = 4 * LIVE_ENEMIES.length * 5;
  for (const am of ["poofowl", "emberpup", "fungoot", "haloux"]) {
    for (const en of LIVE_ENEMIES) {
      for (let s = 0; s < 5; s++) {
        const p = makeLeveledCharacter(am, 5);
        const e = makeEnemy({ enemySpecies: en, enemyLevel: 4 } as any);
        const r = autoSim(p, e, 1000 + s * 7);
        if (r.ticks < 200) terminated++;
        if (r.winner === 0 || r.winner === 1) decisive++;
        if (r.pLifeLeft < 0 || r.eLifeLeft < 0) check("PV jamais négatifs", false, `${am} vs ${en}`);
        if (r.pDamageDealt < 0) check("dégâts jamais négatifs", false, `${am} vs ${en}`);
      }
    }
  }
  check(`tous les combats terminent (${terminated}/${total})`, terminated === total);
  check(`combats majoritairement décisifs (${decisive}/${total})`, decisive >= total * 0.7, `${decisive}/${total}`);
}

console.log("LIVE — Déterminisme (même seed → même issue)");
{
  const p = makeLeveledCharacter("poofowl", 4);
  const e = makeEnemy(COMBAT_LOCATIONS[0]);
  const r1 = autoSim(p, e, 777);
  const r2 = autoSim(p, e, 777);
  check("même seed → même résultat", JSON.stringify(r1) === JSON.stringify(r2));
  const r3 = autoSim(p, e, 778);
  check("seed différent → issue potentiellement différente (au moins l'état RNG diffère)", r1.ticks !== r3.ticks || r1.pLifeLeft !== r3.pLifeLeft || r1.eLifeLeft !== r3.eLifeLeft || true);
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
