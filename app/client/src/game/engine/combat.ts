// F1 + F4 + F5 — Moteur de combat déterministe, headless, zéro DOM.
// Produit un ActionLog (F9) rejouable par le renderer (F10).

import type {
  Action,
  AttackInfo,
  CombatInput,
  CombatResult,
  Fighter,
  FightStat,
} from "./types";
import { makeRng } from "./rng";
import { buildFighter, TIMING } from "./fighter";

const GORE = 1.0;
const MIN_DAMAGE = 1;
const DEFAULT_MAX_TURNS = 120;

type Resolved = { damage: number; dodged: boolean; crit: boolean };

/**
 * F5 — Résolution des dégâts. Fonction pure (hors mutation des hooks défensifs
 * qui peuvent renvoyer des dégâts à l'attaquant).
 */
export function resolveAttack(
  attacker: Fighter,
  target: Fighter,
  rng: { next: () => number; chance: (p: number) => boolean }
): Resolved {
  // 1-2. score d'attaque + multiplicateurs
  let scoreAtt = attacker.atk + attacker.atkBonus;
  let crit = false;
  if (attacker.talents.includes("frenzy") && rng.chance(25)) {
    crit = true;
    scoreAtt *= 1.6;
  }
  scoreAtt *= attacker.atkMult;

  // 3. score de défense
  const scoreDef = target.def;

  // 4. aléa borné (~±33%)
  const bonus = (rng.next() - 0.5) * (2 * scoreAtt) / 3;

  // 5-7. dégâts + plancher
  let damage = Math.ceil((scoreAtt + bonus) * GORE - scoreDef);
  damage = Math.max(MIN_DAMAGE, damage);

  // 8. esquive
  if (rng.next() * 100 < target.dodge) {
    return { damage: 0, dodged: true, crit: false };
  }

  // 10. callbacks défensifs (bouclier, réduction, épines…)
  const info: AttackInfo = { attacker, target, damage };
  for (const hook of target.hooks.defenses) hook(info);
  damage = Math.max(0, Math.round(info.damage));

  return { damage, dodged: false, crit };
}

/**
 * F1/F4 — Boucle complète. Calcule tout d'un coup, sans rendu.
 * 1v1 aujourd'hui, mais gère déjà des équipes (teamA/teamB de N combattants).
 */
export function runCombat(input: CombatInput): CombatResult {
  const rng = makeRng(input.seed);
  const maxTurns = input.rules?.maxTurns ?? DEFAULT_MAX_TURNS;
  const log: Action[] = [];
  const emit = (a: Action) => log.push(a);
  const mgr = { emit, rng };

  // Construction des combattants (side 0 = joueur, side 1 = ennemis)
  let fidSeq = 0;
  const fighters: Fighter[] = [];
  for (const c of input.teamA) fighters.push(buildFighter(c, 0, fidSeq++, rng));
  for (const c of input.teamB) fighters.push(buildFighter(c, 1, fidSeq++, rng));

  // suivi pour FightStat (F16)
  const dealt = new Map<number, number>();
  const taken = new Map<number, number>();

  // Mise en scène initiale
  for (const f of fighters) {
    emit({
      t: "add",
      fid: f.fid,
      name: f.name,
      gfx: f.gfx,
      side: f.side,
      life: f.life,
      maxLife: f.maxLife,
      size: f.size,
      tint: f.tint,
      level: f.level,
    });
  }
  emit({ t: "display" });

  const alive = (side: 0 | 1) => fighters.filter((f) => f.side === side && f.life > 0);
  const firstTarget = (side: 0 | 1) => alive(side === 0 ? 1 : 0)[0];

  let winner: 0 | 1 | null = null;
  let turns = 0;
  const step = TIMING.TIMEBASE * TIMING.TIMECOEF;

  while (turns < maxTurns) {
    if (alive(0).length === 0) {
      winner = 1;
      break;
    }
    if (alive(1).length === 0) {
      winner = 0;
      break;
    }

    // file chronométrique : agit le combattant au `time` minimum
    const ready = fighters.filter((f) => f.life > 0).sort((a, b) => a.time - b.time);
    const actor = ready[0];
    turns++;

    // procs de début de tour (régén, buffs…)
    for (const h of actor.hooks.onTurn) h(actor, mgr);

    const target = firstTarget(actor.side);
    if (!target) break;

    // assaut par défaut
    const res = resolveAttack(actor, target, rng);
    emit({ t: "goto", fid: actor.fid, tid: target.fid });

    if (res.dodged) {
      emit({ t: "dodge", fid: actor.fid, tid: target.fid });
    } else {
      target.life = Math.max(0, target.life - res.damage);
      dealt.set(actor.fid, (dealt.get(actor.fid) ?? 0) + res.damage);
      taken.set(target.fid, (taken.get(target.fid) ?? 0) + res.damage);
      emit({ t: "damage", fid: actor.fid, tid: target.fid, life: target.life, crit: res.crit });
      emit({ t: "lost", fid: target.fid, life: target.life });

      // épines & co peuvent avoir blessé l'attaquant
      const after: AttackInfo = { attacker: actor, target, damage: res.damage };
      for (const h of actor.hooks.afterAttack) h(after);
    }
    emit({ t: "return", fid: actor.fid });

    if (target.life <= 0) emit({ t: "dead", fid: target.fid });
    if (actor.life <= 0) emit({ t: "dead", fid: actor.fid });

    // avance le compteur de temps (vitesse → fréquence)
    actor.time += step * actor.timeMultiplier;
  }

  if (turns >= maxTurns && winner === null) {
    emit({ t: "timeLimit" });
  }
  emit({ t: "finish", winner });

  // F16 — FightStat cohérent avec le log
  const stats: FightStat[] = fighters.map((f) => ({
    fid: f.fid,
    name: f.name,
    side: f.side,
    damageDealt: dealt.get(f.fid) ?? 0,
    damageTaken: taken.get(f.fid) ?? 0,
    survived: f.life > 0,
    lifeLeft: f.life,
    maxLife: f.maxLife,
  }));

  return { log, winner, stats };
}
