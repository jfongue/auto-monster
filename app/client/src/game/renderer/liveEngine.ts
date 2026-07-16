// Moteur d'animation du combat LIVE — port fidèle de combat-live-proto.html,
// généralisé aux 4 kits d'AM (garde / combo / poison / esquive) et aux 3
// comportements de NME. Impératif et couplé au DOM (comme le proto), mais lié à
// un conteneur racine (pas de document.getElementById global) → montable dans React.
//
// Le composant renderer/LiveCombat.tsx rend le squelette DOM et instancie ce
// moteur. Toute la logique de ticks/fenêtres d'input/juice vit ici.

import type { Character } from "../engine/types";
import {
  MAX_NRJ, STORE_MAX, TICK_MS, hitDmg,
  kitFor, behaviorFor, mkFighter, newEnemyMem,
  type LiveFighter, type LiveMove, type AmKit, type EnemyBehaviorDef, type EnemyMem,
  type EnemyIntent, type LiveResult,
} from "../engine/live";

export type LiveOpts = {
  root: HTMLElement;
  player: Character;
  enemy: Character;
  seed: number;
  speed: () => number; // multiplicateur de vitesse (×1..×4), lu à chaud
  intro?: { title: string; sub: string; cta: string };
  onEnd: (r: LiveResult) => void;
};

type Side = "P" | "E";

const perfNow = () => performance.now();

export function createLiveCombat(opts: LiveOpts) {
  const { root } = opts;
  const q = (name: string) => root.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const rng = makeRngLocal(opts.seed);
  const kit: AmKit = kitFor(opts.player.speciesId);
  const beh: EnemyBehaviorDef = behaviorFor(opts.enemy.speciesId);
  const hasBurst = kit.actions.some((m) => m.burst);
  const burstMove = kit.actions.find((m) => m.burst);

  const S = () => Math.max(0.1, opts.speed());
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / S()));

  // ================= STATE =================
  let P: LiveFighter, E: LiveFighter;
  let mem: EnemyMem;
  let tick = 0;
  let phase: "ready" | "input" | "resolve" | "over" = "ready";
  let queued = "wait";
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let cueTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pDamageDealt = 0;
  let curIntent: EnemyIntent = { mode: "idle", type: "small" };

  // fenêtres d'input (comme le proto)
  let lateGuardOpen = false, lateGuard = false, lateGuardResolve: (() => void) | null = null;
  let counterOpen = false, counterFired = false, counterResolve: (() => void) | null = null;
  let lateGuardClosedAt = -9999, graceTimer: ReturnType<typeof setTimeout> | null = null;
  const TOO_LATE_GRACE = 380;

  const MOVES: Record<string, LiveMove> = {};
  for (const m of kit.actions) MOVES[m.id] = m;
  MOVES[kit.charge.id] = kit.charge;

  function reset(toReady: boolean) {
    if (tickTimer) clearTimeout(tickTimer);
    if (cueTimer) clearTimeout(cueTimer);
    running = false;
    lateGuardOpen = false; lateGuard = false; lateGuardResolve = null;
    counterOpen = false; counterFired = false; counterResolve = null;
    P = mkFighter(opts.player);
    E = mkFighter(opts.enemy);
    mem = newEnemyMem();
    pDamageDealt = 0;
    tick = 0; phase = "ready"; queued = kit.charge.id;
    (["sprP", "sprE"] as const).forEach((id) => {
      const s = q(id); s.className = "sprite idle"; s.style.cssText = "";
      const img = s.querySelector("img") as HTMLElement; if (img) img.style.cssText = "";
    });
    q("timer").style.transition = "none"; q("timer").style.transform = "scaleX(0)";
    render();
    if (toReady) {
      q("overlay").classList.remove("hide");
      q("ovT").textContent = opts.intro?.title ?? "Combat LIVE";
      (q("ovT") as HTMLElement).style.color = "";
      q("ovS").textContent = opts.intro?.sub ?? "La clock avance seule. Ne rien faire = charger.";
      q("cta").textContent = opts.intro?.cta ?? "Prêt ?";
      (q("cta") as HTMLElement).style.display = "";
    }
  }

  function start() {
    q("overlay").classList.add("hide");
    layout();
    running = true; phase = "input";
    startTick();
  }

  // ================= TICK LOOP =================
  function startTick() {
    if (!running) return;
    tick++; q("tickN").textContent = String(tick);
    queued = kit.charge.id;
    mem.tick = tick;
    enemyDecide();
    phase = "input";
    settle("P"); settle("E");
    render();
    const t = q("timer"); t.style.transition = "none"; t.style.transform = "scaleX(1)";
    requestAnimationFrame(() => {
      t.style.transition = `transform ${TICK_MS / S()}ms cubic-bezier(.2,.55,.35,1)`;
      t.style.transform = "scaleX(0)";
    });
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = setTimeout(onTickEnd, TICK_MS / S());
  }

  async function onTickEnd() {
    if (phase !== "input") return;
    phase = "resolve";
    await resolve(queued || kit.charge.id);
    if (!running) return;
    if (P.hp <= 0 || E.hp <= 0) return endGame(E.hp <= 0);
    startTick();
  }

  function enemyDecide() {
    curIntent = beh.next(mem, rng);
    q("sprE").className = "sprite idle";
    if (cueTimer) clearTimeout(cueTimer);
    const threat = curIntent.mode === "strike" || !!curIntent.feint;
    const prep = curIntent.mode === "prep";
    if (!threat && !prep) return; // guard/idle : rien à télégraphier
    let revealIn = TICK_MS - (100 + rng() * 900);
    if (curIntent.type === "big") revealIn -= 500;
    if (curIntent.exposed) revealIn = 60; // charge exposée : télégraphiée tôt
    cueTimer = setTimeout(showEnemyCue, Math.max(0, revealIn) / S());
  }
  function showEnemyCue() {
    if (phase !== "input") return;
    const spr = q("sprE"); spr.className = "sprite";
    spr.style.animation = ""; spr.style.transform = ""; spr.style.transition = "";
    const big = curIntent.type === "big";
    spr.classList.add(big ? "tg-big" : "tg-small");
    if (curIntent.exposed) spr.classList.add("exposed");
    if (curIntent.mode === "strike" || curIntent.feint) spr.classList.add(big ? "armed-big" : "armed-small");
  }

  function queue(id: string) {
    if (counterOpen && burstMove && id === burstMove.id) { triggerCounter(); return; }
    const defMove = kit.actions.find((m) => m.kind === "def");
    if (lateGuardOpen && defMove && id === defMove.id) { triggerLateGuard(); return; }
    if (defMove && id === defMove.id && (perfNow() - lateGuardClosedAt) < TOO_LATE_GRACE) { tooLateFeedback(); return; }
    if (phase !== "input") return;
    const mv = MOVES[id]; if (!mv || mv.cost > P.nrj) return;
    queued = id;
    if (mv.kind === "atk" && P.guard && P.guard.hold > 0) shieldJump();
    render();
  }

  // ---- fenêtre de garde tardive ----
  function openLateGuard() { lateGuard = false; lateGuardOpen = true; render(); }
  function closeLateGuard() {
    if (!lateGuardOpen) return;
    lateGuardOpen = false; lateGuardClosedAt = perfNow(); render();
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(render, TOO_LATE_GRACE + 20);
  }
  function triggerLateGuard() {
    const defMove = kit.actions.find((m) => m.kind === "def")!;
    if (!lateGuardOpen || P.nrj < defMove.cost) return;
    lateGuard = true; lateGuardOpen = false;
    if (lateGuardResolve) { const r = lateGuardResolve; lateGuardResolve = null; r(); }
    render();
  }
  function raceLate(ms: number) {
    return new Promise<void>((res) => {
      const t = setTimeout(() => { if (lateGuardResolve) lateGuardResolve = null; res(); }, ms / S());
      lateGuardResolve = () => { clearTimeout(t); res(); };
    });
  }
  function tooLateFeedback() {
    floater("fP", "TROP TARD", "toolate txt");
    const b = q("btns").querySelector<HTMLElement>(".act.def");
    if (b) { b.classList.remove("shakeLate"); void b.offsetWidth; b.classList.add("shakeLate"); setTimeout(() => b.classList.remove("shakeLate"), 380); }
  }

  // ---- fenêtre de contre-attaque ----
  function openCounterWindow() { counterFired = false; counterOpen = true; render(); }
  function closeCounterWindow() { if (!counterOpen) return; counterOpen = false; render(); }
  function triggerCounter() {
    if (!counterOpen || P.stored <= 0) return;
    counterFired = true; counterOpen = false;
    if (counterResolve) { const r = counterResolve; counterResolve = null; r(); }
    render();
  }
  function raceCounter(ms: number) {
    return new Promise<void>((res) => {
      const t = setTimeout(() => { if (counterResolve) counterResolve = null; res(); }, ms / S());
      counterResolve = () => { clearTimeout(t); res(); };
    });
  }

  // ================= RÉSOLUTION =================
  function eStrikeDmg(): number {
    return hitDmg(curIntent.type === "big" ? beh.bigPower : beh.smallPower, E.atk, P.def);
  }
  function playerAtkDmg(mv: LiveMove): number {
    let mult = 1;
    if (mv.combo) { P.combo = Math.min(4, P.combo + 1); mult = 1 + 0.5 * (P.combo - 1); }
    else if (mv.spendCombo) { mult = 1 + 0.6 * P.combo; P.combo = 0; }
    let dmg = Math.round(hitDmg(mv.power ?? 0.5, P.atk, E.def) * mult);
    if (mv.burst) { dmg += Math.min(P.stored, STORE_MAX); P.stored = 0; }
    if (curIntent.exposed) dmg = Math.round(dmg * 1.5); // frappe la charge → bonus
    return dmg;
  }

  async function resolve(pId: string) {
    const sp = q("sprP");
    sp.classList.remove("idle", "aim-peck", "aim-guard", "aim-burst", "aim-wait");
    sp.style.animation = ""; sp.style.transform = ""; sp.style.transition = "";
    const pMv = MOVES[pId] || kit.charge;
    const eStrike = curIntent.mode === "strike";
    const eFeint = !!curIntent.feint;
    const eType = curIntent.type;
    const eDmg = eStrike ? eStrikeDmg() : 0;
    let guardConsumed = false;

    P.nrj -= pMv.cost;
    if (eStrike) E.nrj = Math.max(0, E.nrj - (eType === "big" ? 2 : 1));

    const pAtk = pMv.kind === "atk";

    if (pMv.kind === "def") {
      P.guard = { hold: pMv.hold ?? 1, armedThisTick: true };
      fxGuard("P");
      if (eStrike) { await animShieldAbsorb(eType, eDmg, true, pMv); guardConsumed = true; }
      else if (eFeint) { await animEnemyFeint(); await animGuardHold(); }
      else await animGuardHold();
    } else if (pAtk) {
      P.guard = null;
      const pDmg = playerAtkDmg(pMv);
      if (eStrike) await animClash(pMv, pDmg, eType, eDmg);
      else { if (eFeint) animEnemyFeintQuick(); await animPlayerAttack(pMv, pDmg); }
    } else {
      // charge / attente
      if (eStrike) {
        if (P.guard && P.guard.hold > 0) { fxGuard("P"); await animShieldAbsorb(eType, eDmg, false, null); guardConsumed = true; }
        else await enemyStrikeVsPlayer(eType, eDmg);
      } else if (eFeint) { await animEnemyFeint(); fxCharge("P"); await wait(200); }
      else { fxCharge("P"); await animBothIdle(); }
    }

    if (eStrike || eFeint) { mem.pending = null; q("sprE").className = "sprite"; }

    // régen d'énergie : pas de régen si on a attaqué
    const pNrjB = P.nrj, eNrjB = E.nrj;
    if (!pAtk) P.nrj = Math.min(MAX_NRJ, P.nrj + 1);
    if (!eStrike) E.nrj = Math.min(MAX_NRJ, E.nrj + 1);

    // garde : décompte des boucliers
    if (P.guard) {
      P.guard.armedThisTick = false;
      if (guardConsumed) { shieldVanish("burst"); P.guard = null; }
      else { shieldVanish("tick"); P.guard.hold--; if (P.guard.hold <= 0) P.guard = null; }
    }

    // repos
    await checkRepos(P, "P", pAtk);
    await checkRepos(E, "E", eStrike);

    // altérations de fin de tick (poison / brûlure)
    await tickDots(E, "E");
    await tickDots(P, "P");

    render();
    energyGainFx("P", P.nrj - pNrjB);
    energyGainFx("E", E.nrj - eNrjB);
  }

  async function checkRepos(f: LiveFighter, side: Side, spent: boolean) {
    void spent;
    if (f.nrj >= MAX_NRJ) f.fullStreak++; else f.fullStreak = 0;
    if (f.fullStreak >= 2) {
      f.nrj = Math.max(0, f.nrj - 1); f.fullStreak = 0;
      const spr = q("spr" + side); spr.classList.add("repos");
      floater("f" + side, "💤", "rest");
      q("nrj" + side).querySelectorAll<HTMLElement>(".pip").forEach((p) => { p.classList.add("resting"); setTimeout(() => p.classList.remove("resting"), 1000); });
      await wait(700);
      spr.classList.remove("repos");
    }
  }

  async function tickDots(f: LiveFighter, side: Side) {
    if (!f.dots.length) return;
    let total = 0; const kinds = new Set<string>();
    for (const d of f.dots) { f.hp = Math.max(0, f.hp - d.dmg); total += d.dmg; d.turns--; kinds.add(d.kind); }
    f.dots = f.dots.filter((d) => d.turns > 0);
    if (side === "E") pDamageDealt += total;
    const icon = kinds.has("poison") ? "☠️" : "🔥";
    const spr = q("spr" + side); spr.classList.add("fx-hit"); setTimeout(() => spr.classList.remove("fx-hit"), 200);
    floater("f" + side, "-" + total + " " + icon, "dmg");
    render();
    await wait(320);
  }

  // ================= ANIMATIONS =================
  const FACE = (side: Side) => (side === "P" ? "scaleX(-1) " : "");
  function contact(side: Side): number {
    const me = (q("spr" + side).parentElement as HTMLElement).getBoundingClientRect();
    const opp = (q("spr" + (side === "P" ? "E" : "P")).parentElement as HTMLElement).getBoundingClientRect();
    const d = (opp.left + opp.width / 2) - (me.left + me.width / 2);
    const s = Math.sign(d) || (side === "P" ? 1 : -1);
    return Math.round(d - s * (opp.width / 2 + 30));
  }
  const EASE_SPRING = "cubic-bezier(.4,1.2,.5,1)";
  const EASE_STOP = "cubic-bezier(.15,.7,.25,1)";
  const EASE_HIT = "cubic-bezier(.75,0,.9,.35)";
  function moveXY(side: Side, x: number, y: number, ms: number, ease = EASE_SPRING) {
    const s = q("spr" + side); s.style.animation = "none"; s.classList.remove("idle");
    s.style.transition = `transform ${ms / S()}ms ${ease}`; s.style.transform = `translate(${x}px, ${y}px)`;
  }
  const moveSprite = (side: Side, x: number, ms: number, ease = EASE_SPRING) => moveXY(side, x, 0, ms, ease);
  async function arcTo(side: Side, x: number, ms: number, h: number) {
    moveXY(side, x * 0.5, -h, ms * 0.5, "cubic-bezier(.25,.7,.5,1)"); await wait(ms * 0.5);
    moveXY(side, x, 0, ms * 0.5, "cubic-bezier(.5,0,.75,.4)"); await wait(ms * 0.5);
  }
  function resetSprite(side: Side, ms: number) { const s = q("spr" + side); s.style.transition = `transform ${ms / S()}ms ease`; s.style.transform = "translate(0,0)"; }
  function settle(side: Side) { const s = q("spr" + side); s.style.animation = ""; s.style.transition = ""; s.style.transform = ""; }
  function strikePose(side: Side, ms: number) {
    const img = q("spr" + side).querySelector("img") as HTMLElement; const base = FACE(side);
    img.style.transition = `transform ${ms / S()}ms ${EASE_HIT}`; img.style.transform = base + `rotate(${side === "P" ? -22 : 22}deg) scale(1.14)`;
  }
  function strikeReset(side: Side, ms: number) {
    const img = q("spr" + side).querySelector("img") as HTMLElement; const base = FACE(side);
    img.style.transition = `transform ${ms / S()}ms ease`; img.style.transform = base;
  }
  async function strikeLand(side: Side, reach: number, big: boolean, onImpact: () => void) {
    if (big) {
      strikePose(side, 170); q("spr" + side).classList.add("dash" + side);
      await arcTo(side, reach, 300, 122); q("spr" + side).classList.remove("dash" + side);
      onImpact(); bigImpact(side); strikeReset(side, 280); await wait(400);
    } else {
      strikePose(side, 110); await arcTo(side, reach, 180, 28); onImpact(); strikeReset(side, 200); await wait(220);
    }
    resetSprite(side, big ? 500 : 380); await wait(big ? 500 : 380); settle(side);
  }
  async function attackSeq(side: Side, reach: number, big: boolean, onImpact: () => void) {
    const dir = reach < 0 ? -1 : 1; const brake = reach - dir * 56;
    if (big) { const s = q("spr" + side); s.classList.add("fx-charge"); flash("var(--burst)"); await wait(280); s.classList.remove("fx-charge"); }
    moveXY(side, -dir * (big ? 40 : 16), big ? -8 : 0, big ? 210 : 130, EASE_STOP); await wait(big ? 210 : 130);
    moveSprite(side, brake, big ? 340 : 260, EASE_STOP); await wait(big ? 340 : 260);
    await wait(big ? 250 : 160);
    await strikeLand(side, reach, big, onImpact);
  }
  function hurt(side: Side, big: boolean) {
    const img = q("spr" + side).querySelector("img") as HTMLElement; const base = FACE(side);
    img.style.transition = "transform .1s"; img.style.transform = base + `translateX(${side === "P" ? 8 : -8}px)`;
    setTimeout(() => { img.style.transform = base; }, 150);
    const s = q("spr" + side); s.classList.add("fx-hit"); setTimeout(() => s.classList.remove("fx-hit"), 200);
    q("arena").classList.add(big ? "shake-big" : "shake"); setTimeout(() => q("arena").classList.remove("shake", "shake-big"), 560);
  }
  function fxCharge(side: Side) { const s = q("spr" + side); s.classList.add("fx-charge"); setTimeout(() => s.classList.remove("fx-charge"), 520); floater("f" + side, "⚡", "absorb"); }
  function fxGuard(side: Side) {
    const s = q("spr" + side); s.classList.add("fx-guard"); setTimeout(() => s.classList.remove("fx-guard"), 700);
    const fx = q("shfx" + side); fx.classList.remove("go"); void fx.offsetWidth; fx.classList.add("go");
  }

  async function animPlayerAttack(mv: LiveMove, dmg: number) {
    const big = !!mv.burst || !!mv.spendCombo;
    await attackSeq("P", contact("P"), big, () => {
      applyDamage(E, "E", dmg, big); pDamageDealt += dmg; onPlayerHit(mv); hurt("E", big); render();
    });
  }
  function onPlayerHit(mv: LiveMove) {
    if (mv.burn) { addDot(E, "burn", Math.max(1, Math.round(mv.burn * P.atk)), 3); floater("fE", "🔥", "dmg"); }
    if (mv.poison) { addDot(E, "poison", Math.max(1, Math.round(mv.poison * P.atk)), 3); floater("fE", "☠️", "dmg"); }
  }

  async function enemyStrikeVsPlayer(eType: string, eDmg: number) {
    const big = eType === "big";
    const defMove = kit.actions.find((m) => m.kind === "def");
    const reach = contact("E"), dir = -1, brake = reach - dir * 56, appr = big ? 340 : 260;
    if (defMove) openLateGuard();
    moveXY("E", big ? 40 : 16, big ? -8 : 0, big ? 210 : 130, EASE_STOP);
    await raceLate(big ? 210 : 130);
    if (lateGuard) return lateAbsorb(eType, eDmg, reach, defMove!);
    moveSprite("E", brake, appr, EASE_STOP);
    await raceLate(appr);
    if (lateGuard) return lateAbsorb(eType, eDmg, reach, defMove!);
    closeLateGuard();
    await wait(big ? 250 : 160);
    await strikeLand("E", reach, big, () => { applyDamage(P, "P", eDmg, big); P.combo = 0; hurt("P", big); render(); });
  }

  async function lateAbsorb(eType: string, eDmg: number, reach: number, defMove: LiveMove) {
    closeLateGuard(); fxGuard("P"); render();
    strikePose("E", 90); moveSprite("E", reach, 150, EASE_HIT); await wait(150);
    onParry(eDmg, true, defMove);
    q("shfxP").classList.remove("go"); void q("shfxP").offsetWidth; q("shfxP").classList.add("go");
    floater("fP", kit.special === "dodge" ? "ESQUIVE !" : "PARADE !", "absorb txt"); flash("var(--shield)"); ring();
    strikeReset("E", 180); hurt("E", false); render();
    await wait(440);
    if (hasBurst && P.stored > 0) {
      openCounterWindow(); await raceCounter(500); closeCounterWindow();
      if (counterFired) await animCounterBurst();
    }
    resetSprite("E", 420); await wait(420); settle("E");
  }

  async function animCounterBurst() {
    const mv = burstMove!;
    const dmg = hitDmg(mv.power ?? 0.5, P.atk, E.def) + Math.min(P.stored, STORE_MAX);
    P.stored = 0;
    const R = clashReach();
    strikePose("P", 120); moveSprite("P", R + 30, 130, EASE_HIT); await wait(130);
    applyDamage(E, "E", dmg, true); pDamageDealt += dmg; hurt("E", true);
    flash("var(--burst)"); q("arena").classList.add("shake-big"); render();
    await wait(260); q("arena").classList.remove("shake-big");
    strikeReset("P", 220); moveSprite("P", 0, 260, EASE_SPRING); await wait(260); settle("P");
  }

  async function animGuardHold() { await wait(600); }
  async function animBothIdle() { await wait(520); }
  async function animEnemyFeint() {
    // fausse charge : l'ennemi amorce puis se rétracte (baite la garde/esquive)
    moveSprite("E", -30, 160, EASE_STOP); await wait(160);
    floater("fE", "FEINTE", "toolate txt");
    moveSprite("E", 0, 320, EASE_SPRING); await wait(320); settle("E");
  }
  function animEnemyFeintQuick() { moveSprite("E", -20, 140, EASE_STOP); setTimeout(() => { moveSprite("E", 0, 260, EASE_SPRING); }, 160 / S()); }

  // absorption d'un coup sur la garde (parade parfaite ou garde tenue)
  async function animShieldAbsorb(type: string, dmg: number, perfect: boolean, defMoveArg: LiveMove | null) {
    const big = type === "big";
    const reach = contact("E"), brake = reach + 56;
    moveSprite("E", 16, 130, EASE_STOP); await wait(130);
    moveSprite("E", brake, big ? 320 : 260, EASE_STOP); await wait(big ? 320 : 260);
    await wait(big ? 220 : 160);
    strikePose("E", 110); moveSprite("E", reach, 110, EASE_HIT); await wait(110);
    strikeReset("E", 220);
    onParry(dmg, perfect, defMoveArg);
    q("shfxP").classList.remove("go"); void q("shfxP").offsetWidth; q("shfxP").classList.add("go");
    if (perfect) flash("var(--shield)");
    hurt("E", false); render();
    await wait(520);
    resetSprite("E", 420); await wait(420); settle("E");
  }

  // effet d'une parade réussie : réserve (garde/esquive) ou poison (spores)
  function onParry(dmg: number, perfect: boolean, defMove: LiveMove | null) {
    const mult = perfect ? 1.5 : 1;
    const mv = defMove ?? kit.actions.find((m) => m.kind === "def") ?? null;
    if (mv?.reflect) {
      // Spores : empoisonne l'attaquant
      addDot(E, "poison", Math.max(1, Math.round(mv.reflect * P.atk)), 3);
      floater("fP", "SPORES ☠️", "absorb txt");
    } else if (hasBurst) {
      addStored("P", Math.round(dmg * mult));
    }
    if (perfect) { const defCost = mv?.cost ?? 0; P.nrj = Math.min(MAX_NRJ, P.nrj + defCost); } // remboursement parade parfaite
  }

  function clashReach(): number {
    const a = q("fP").getBoundingClientRect(), b = q("fE").getBoundingClientRect();
    const sep = (b.left + b.width / 2) - (a.left + a.width / 2);
    return Math.max(60, sep / 2 - 22);
  }

  async function animClash(pMv: LiveMove, pDmg: number, eType: string, eDmg: number) {
    const R = clashReach();
    const big = !!pMv.burst || !!pMv.spendCombo;
    if (big) { flash("var(--burst)"); q("sprP").classList.add("fx-charge"); await wait(240); q("sprP").classList.remove("fx-charge"); }
    moveSprite("P", -18, 120, EASE_STOP); moveSprite("E", 18, 120, EASE_STOP); await wait(120);
    moveSprite("P", R, 360, EASE_STOP); moveSprite("E", -R, 360, EASE_STOP); await wait(360);
    spark(); flash("#fff"); q("arena").classList.add("shake"); await wait(140);
    q("arena").classList.remove("shake");
    q("sprP").classList.add("fx-hit"); q("sprE").classList.add("fx-hit");
    await wait(520);
    q("sprP").classList.remove("fx-hit"); q("sprE").classList.remove("fx-hit");
    strikePose("P", 110); strikePose("E", 110);
    moveSprite("P", R + 24, 110, EASE_HIT); moveSprite("E", -(R + 24), 110, EASE_HIT); await wait(110);
    spark(); flash("#fff"); q("arena").classList.add("shake-big"); await wait(120);
    q("arena").classList.remove("shake-big");
    strikeReset("P", 180); strikeReset("E", 180);
    const ratio = Math.max(pDmg, eDmg) / Math.max(1, Math.min(pDmg, eDmg));
    if (ratio < 1.5) {
      ring(); flash("var(--gold)"); floater("fC", "CLASH", "absorb txt");
      onPlayerHit(pMv); // les DoT s'appliquent quand même sur un clash nul
      moveSprite("P", R - 70, 300, EASE_SPRING); moveSprite("E", -(R - 70), 300, EASE_SPRING); await wait(340);
    } else {
      const pWins = pDmg > eDmg, loser: Side = pWins ? "E" : "P", winner: Side = pWins ? "P" : "E";
      const dmg = pWins ? pDmg : eDmg;
      dirFlash(loser, pWins ? "var(--burst)" : "var(--big)"); ring();
      moveSprite(winner, winner === "P" ? R + 70 : -(R + 70), 200, EASE_HIT);
      moveSprite(loser, loser === "P" ? -120 : 120, 320, EASE_SPRING);
      applyDamage(loser === "P" ? P : E, loser, dmg, true);
      if (pWins) { pDamageDealt += dmg; onPlayerHit(pMv); } else { P.combo = 0; }
      hurt(loser, true);
      q("arena").classList.add("shake-big"); render(); await wait(380);
      q("arena").classList.remove("shake-big");
    }
    await wait(180);
    resetSprite("P", 440); resetSprite("E", 440); await wait(440); settle("P"); settle("E");
  }

  function applyDamage(f: LiveFighter, side: Side, dmg: number, big: boolean) {
    f.hp = Math.max(0, f.hp - dmg); floater("f" + side, "-" + dmg, big ? "big" : "dmg");
  }
  function addDot(f: LiveFighter, kind: "poison" | "burn", dmg: number, turns: number) { if (dmg > 0) f.dots.push({ kind, dmg, turns }); }

  // ================= FX =================
  function floater(hostId: string, txt: string, cls: string) {
    const h = q(hostId); const el = document.createElement("div"); el.className = "floater " + cls; el.textContent = txt;
    el.style.bottom = `calc(var(--float-y,22%) + ${Math.round(Math.random() * 16)}px)`; h.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  function flash(color: string) {
    const f = q("flash"); f.style.background = color ? `radial-gradient(circle at center, ${color}, transparent 70%)` : "rgba(255,255,255,.6)";
    f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
  }
  function dirFlash(loserSide: Side, color: string) {
    const f = q("flash"); const x = loserSide === "P" ? "26%" : "74%";
    f.style.background = `radial-gradient(circle at ${x} 50%, ${color}, transparent 56%)`;
    f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
  }
  function ring() { const r = q("clashring"); r.classList.remove("go"); void r.offsetWidth; r.classList.add("go"); }
  function shockwave(x: string, color: string) {
    const s = q("shock"); s.style.left = x; s.style.borderColor = color || "#fff"; s.style.boxShadow = `0 0 34px ${color || "#fff"}`;
    s.classList.remove("go"); void s.offsetWidth; s.classList.add("go");
  }
  function bigImpact(side: Side) {
    const loser: Side = side === "P" ? "E" : "P"; const x = loser === "P" ? "26%" : "74%"; const col = side === "P" ? "var(--burst)" : "var(--big)";
    flash("#fff"); spark(); ring(); setTimeout(() => dirFlash(loser, col), 70);
    shockwave(x, side === "P" ? "#ffb454" : "#ff3b52");
    q("arena").classList.add("shake-big"); setTimeout(() => q("arena").classList.remove("shake-big"), 580);
    floater("f" + loser, "💥", "big");
  }
  function spark() { const s = q("spark"); s.classList.remove("go"); void s.offsetWidth; s.classList.add("go"); }

  function layout() {
    const ar = q("arena"); if (!ar) return;
    const arR = ar.getBoundingClientRect(); if (!arR.height) return;
    const sw = (q("sprP").parentElement as HTMLElement).getBoundingClientRect();
    const spriteTop = sw.top - arR.top;
    ar.style.setProperty("--line-y", Math.round(spriteTop + sw.height * 0.52) + "px");
    ar.style.setProperty("--float-y", Math.round(arR.height - spriteTop) + "px");
  }

  // ================= RENDER =================
  function updatePlayerPose() {
    if (phase !== "input") return;
    const s = q("sprP");
    s.classList.remove("idle", "aim-peck", "aim-guard", "aim-burst", "aim-wait");
    s.style.animation = ""; s.style.transition = ""; s.style.transform = "";
    // classe d'anticipation générique selon le type de move sélectionné
    const mv = MOVES[queued];
    const cls = !mv || mv.kind === "wait" ? "aim-wait" : mv.kind === "def" ? "aim-guard" : mv.burst || mv.spendCombo ? "aim-burst" : "aim-peck";
    s.classList.add(cls);
  }

  function render() {
    renderFighter(P, "P"); renderFighter(E, "E");
    updatePlayerPose(); renderButtons();
    const lock = !(phase === "input" || lateGuardOpen || counterOpen);
    q("btns").classList.toggle("locked", lock);
    q("chargeWrap").classList.toggle("locked", lock);
    q("fieldP").classList.toggle("on", !!(P.guard && P.guard.hold > 0));
    // badge de combo (Emberpup)
    const cb = root.querySelector<HTMLElement>('[data-el="comboP"]');
    if (cb) { cb.classList.toggle("on", P.combo > 0); cb.textContent = P.combo > 0 ? "COMBO ×" + P.combo : ""; }
  }
  function renderFighter(f: LiveFighter, s: Side) {
    const pct = 100 * f.hp / f.maxHp;
    q("hp" + s).style.width = pct + "%"; q("trail" + s).style.width = pct + "%";
    const nrj = q("nrj" + s);
    if (nrj.children.length !== MAX_NRJ) { nrj.innerHTML = ""; for (let i = 0; i < MAX_NRJ; i++) { const p = document.createElement("div"); p.className = "pip"; nrj.appendChild(p); } }
    [...nrj.children].forEach((p, i) => (p as HTMLElement).classList.toggle("full", i < f.nrj));
  }
  function buildBtn(mv: LiveMove) {
    const b = document.createElement("button"); b.dataset.id = mv.id;
    const kindCls = mv.kind === "atk" ? (mv.burst ? "burst" : "atk") : mv.kind === "def" ? "def" : "wait";
    b.className = "act " + kindCls + (mv.kind === "wait" ? " chargebtn" : "");
    const shields = mv.kind === "def" ? `<span class="shields">${Array.from({ length: mv.hold ?? 1 }).map(() => "<i></i>").join("")}</span>` : "";
    b.innerHTML = `${mv.cost > 0 ? `<span class="cost">⚡${mv.cost}</span>` : ""}<span class="ic">${mv.ic}</span><span class="k">${mv.k}</span>${shields}`;
    b.onclick = () => queue(mv.id);
    return b;
  }
  function shieldOnEls() { const w = q("btns").querySelector(".act.def .shields"); return w ? [...w.querySelectorAll<HTMLElement>("i.on")] : []; }
  function shieldVanish(kind: "tick" | "burst") {
    const ons = shieldOnEls(); if (!ons.length) return;
    const cls = kind === "burst" ? "bvanish" : "vanish";
    const targets = kind === "burst" ? ons : ons.slice(-1);
    targets.forEach((el) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls, "on"), 560); });
  }
  function shieldJump() { shieldOnEls().forEach((el) => { el.classList.remove("jump"); void el.offsetWidth; el.classList.add("jump"); setTimeout(() => el.classList.remove("jump"), 460); }); }

  function renderButtons() {
    const box = q("btns"), cw = q("chargeWrap");
    if (box.children.length !== kit.actions.length) { box.innerHTML = ""; kit.actions.forEach((m) => box.appendChild(buildBtn(m))); }
    if (cw.children.length !== 1) { cw.innerHTML = ""; cw.appendChild(buildBtn(kit.charge)); }
    const defMove = kit.actions.find((m) => m.kind === "def");
    [...box.children, ...cw.children].forEach((bEl) => {
      const b = bEl as HTMLButtonElement; const id = b.dataset.id!; const mv = MOVES[id];
      let disabled: boolean;
      if (!running) disabled = true;
      else if (phase === "input") disabled = mv.cost > P.nrj;
      else if (lateGuardOpen) disabled = !(defMove && id === defMove.id && P.nrj >= defMove.cost);
      else if (counterOpen) disabled = !(burstMove && id === burstMove.id && P.stored > 0);
      else if (defMove && id === defMove.id && (perfNow() - lateGuardClosedAt) < TOO_LATE_GRACE) disabled = false;
      else disabled = true;
      b.disabled = disabled;
      b.classList.toggle("selected", (queued === id) || (lateGuardOpen && !!defMove && id === defMove.id && !disabled));
      if (defMove && id === defMove.id) {
        const active = !!(P.guard && P.guard.hold > 0);
        const preview = phase === "input" && queued === id;
        const n = preview ? (mv.hold ?? 1) : active ? P.guard!.hold : 0;
        b.classList.toggle("active", active || preview);
        b.classList.toggle("graceClick", (perfNow() - lateGuardClosedAt) < TOO_LATE_GRACE);
        const shields = b.querySelector(".shields");
        if (shields) [...shields.children].forEach((el, i) => { const e = el as HTMLElement; if (!e.classList.contains("vanish") && !e.classList.contains("bvanish")) e.classList.toggle("on", i < n); });
      }
      if (burstMove && id === burstMove.id) {
        if (!storeAnim) b.style.setProperty("--p", String(100 * Math.min(P.stored, STORE_MAX) / STORE_MAX));
        b.classList.toggle("full", P.stored >= STORE_MAX);
        b.classList.toggle("empty", P.stored <= 0);
        b.classList.toggle("glow", P.stored >= STORE_MAX && !disabled);
        b.classList.toggle("counterReady", counterOpen && !disabled);
      }
    });
  }

  let storeAnim: number | null = null;
  function addStored(side: Side, amount: number) {
    if (amount <= 0 || side !== "P") { if (amount > 0) { const f = side === "P" ? P : E; f.stored = Math.min(STORE_MAX, f.stored + amount); } return; }
    const from = 100 * Math.min(P.stored, STORE_MAX) / STORE_MAX;
    P.stored = Math.min(STORE_MAX, P.stored + amount);
    const to = 100 * Math.min(P.stored, STORE_MAX) / STORE_MAX;
    const b = q("btns").querySelector<HTMLElement>(".act.burst");
    if (b) {
      b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 850);
      if (storeAnim) cancelAnimationFrame(storeAnim);
      const t0 = performance.now(), dur = 550;
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        b.style.setProperty("--p", String(from + (to - from) * e));
        if (k < 1) storeAnim = requestAnimationFrame(step); else storeAnim = null;
      };
      step();
    }
  }
  function energyGainFx(side: Side, count: number) {
    if (count <= 0) return;
    const pips = [...q("nrj" + side).children] as HTMLElement[];
    const f = side === "P" ? P : E;
    for (let i = Math.max(0, f.nrj - count); i < f.nrj; i++) { const p = pips[i]; if (!p) continue; p.classList.add("gain"); setTimeout(() => p.classList.remove("gain"), 850); }
    floater("f" + side, "+" + count + " ⚡", "nrjgain");
  }

  // ================= FIN =================
  function endGame(win: boolean) {
    phase = "over"; running = false;
    if (tickTimer) clearTimeout(tickTimer); if (cueTimer) clearTimeout(cueTimer);
    const loser: Side = win ? "E" : "P";
    const spr = q("spr" + loser); spr.style.transition = "transform .6s, opacity .6s";
    spr.style.transform = `translateY(34px) rotate(${loser === "P" ? -78 : 78}deg)`; (spr.querySelector("img") as HTMLElement).style.opacity = ".35";
    flash(win ? "var(--green)" : "var(--red)");
    setTimeout(() => {
      q("overlay").classList.remove("hide");
      q("ovT").textContent = win ? "VICTOIRE" : "K.O.";
      (q("ovT") as HTMLElement).style.color = win ? "var(--green)" : "var(--red)";
      q("ovS").textContent = "";
      (q("cta") as HTMLElement).style.display = "none";
      const winner: 0 | 1 | null = win ? 0 : 1;
      opts.onEnd({ winner, pLifeLeft: Math.max(0, Math.round(P.hp)), eLifeLeft: Math.max(0, Math.round(E.hp)), pDamageDealt: Math.round(pDamageDealt) });
    }, 900 / S());
  }

  // ================= INPUT =================
  function onKey(e: KeyboardEvent) {
    const ids = [...kit.actions.map((m) => m.id), kit.charge.id];
    const idx = ({ "1": 0, "2": 1, "3": 2, "4": 3 } as Record<string, number>)[e.key];
    if (idx == null) return;
    const id = ids[idx]; if (!id) return;
    const defMove = kit.actions.find((m) => m.kind === "def");
    const tooLateGrace = defMove && id === defMove.id && (perfNow() - lateGuardClosedAt) < TOO_LATE_GRACE;
    if (phase === "input" || counterOpen || tooLateGrace) queue(id);
  }
  window.addEventListener("keydown", onKey);

  q("cta").addEventListener("click", start);
  const restartBtn = root.querySelector<HTMLElement>('[data-el="restart"]');
  if (restartBtn) restartBtn.addEventListener("click", () => reset(true));
  const onResize = () => layout();
  window.addEventListener("resize", onResize);

  reset(true);
  layout();
  setTimeout(layout, 60); // re-mesure après montage/transition

  return {
    start,
    destroy() {
      running = false;
      if (tickTimer) clearTimeout(tickTimer);
      if (cueTimer) clearTimeout(cueTimer);
      if (graceTimer) clearTimeout(graceTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    },
  };
}

// petit RNG local (mulberry32) → () => [0,1), avec .chance
function makeRngLocal(seed: number) {
  let a = seed >>> 0;
  const fn = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = fn as (() => number) & { chance: (p: number) => boolean; int: (n: number) => number; float: (m: number) => number; next: () => number; state: () => number };
  r.chance = (p: number) => fn() * 100 < p;
  r.int = (n: number) => Math.floor(fn() * n);
  r.float = (m: number) => fn() * m;
  r.next = fn;
  r.state = () => a >>> 0;
  return r;
}
