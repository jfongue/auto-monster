// F1 + F4 + F5 + F7 — Moteur de combat déterministe, headless, zéro DOM.
// Produit un ActionLog (F9) rejouable par le renderer (F10).

import type {
  Action,
  AttackInfo,
  CombatInput,
  CombatResult,
  Fighter,
  FightStat,
  StatusEntry,
} from "./types";
import { makeRng } from "./rng";
import { buildFighter, TIMING } from "./fighter";

const GORE = 1.0;
const MIN_DAMAGE = 1;
const DEFAULT_MAX_TURNS = 120;

type Resolved = { damage: number; dodged: boolean; crit: boolean; amped: boolean };

/** Applique/rafraîchit une altération sur un Fighter. Renvoie true si (re)posée. */
function applyStatus(f: Fighter, entry: StatusEntry): boolean {
  const existing = f.statuses.find((s) => s.kind === entry.kind);
  if (existing) {
    existing.turns = Math.max(existing.turns, entry.turns);
    existing.dmg = Math.max(existing.dmg, entry.dmg);
    return true;
  }
  f.statuses.push({ ...entry });
  return true;
}

/**
 * F5 — Résolution des dégâts. Fonction pure (hors mutation des hooks défensifs
 * qui peuvent renvoyer des dégâts à l'attaquant).
 * `forceCrit` : utilisé par les ripostes garanties critiques (Contre parfait).
 */
export function resolveAttack(
  attacker: Fighter,
  target: Fighter,
  rng: { next: () => number; chance: (p: number) => boolean },
  forceCrit = false
): Resolved {
  // 1-2. score d'attaque + critique (généralisé : critChance/critMult)
  let scoreAtt = attacker.atk + attacker.atkBonus;
  let crit = false;
  if (forceCrit || (attacker.critChance > 0 && rng.chance(attacker.critChance))) {
    crit = true;
    scoreAtt *= attacker.critMult;
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
    return { damage: 0, dodged: true, crit: false, amped: false };
  }

  // 10. callbacks défensifs (bouclier, réduction, épines…)
  const info: AttackInfo = { attacker, target, damage };
  for (const hook of target.hooks.defenses) hook(info);
  damage = Math.max(0, Math.round(info.damage));

  // amplification vs cibles affligées (Pyromane / Virulence)
  let amped = false;
  for (const s of target.statuses) {
    const mult = attacker.ampVsStatus[s.kind];
    if (mult && mult > 1) {
      damage = Math.round(damage * mult);
      amped = true;
    }
  }

  return { damage, dodged: false, crit, amped };
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
  const addDealt = (fid: number, n: number) => dealt.set(fid, (dealt.get(fid) ?? 0) + n);
  const addTaken = (fid: number, n: number) => taken.set(fid, (taken.get(fid) ?? 0) + n);

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

    // F7 — altérations (poison/brûlure) : dégâts au début du tour de la victime.
    if (actor.statuses.length > 0) {
      for (const s of actor.statuses) {
        const dmg = Math.min(actor.life, s.dmg);
        actor.life = Math.max(0, actor.life - dmg);
        addTaken(actor.fid, dmg);
        s.turns -= 1;
        emit({ t: "statusTick", fid: actor.fid, kind: s.kind, life: actor.life, dmg });
      }
      actor.statuses = actor.statuses.filter((s) => s.turns > 0);
      if (actor.life <= 0) {
        emit({ t: "dead", fid: actor.fid });
        actor.time += step * actor.timeMultiplier;
        continue; // mort avant d'avoir pu agir
      }
    }

    // procs de début de tour (régén, buffs…)
    for (const h of actor.hooks.onTurn) h(actor, mgr);

    const target = firstTarget(actor.side);
    if (!target) break;

    // assaut par défaut
    const res = resolveAttack(actor, target, rng);
    emit({ t: "goto", fid: actor.fid, tid: target.fid });

    if (res.dodged) {
      emit({ t: "dodge", fid: actor.fid, tid: target.fid });
      onDodge(target, actor);
    } else {
      // Coup critique (Frénésie) : label au-dessus de l'attaquant.
      if (res.crit) emit({ t: "talentProc", fid: actor.fid, talent: "frenzy", label: "FRÉNÉSIE !" });
      if (res.amped) emit({ t: "talentProc", fid: actor.fid, talent: "amp", label: "💥 +35%" });

      target.life = Math.max(0, target.life - res.damage);
      addDealt(actor.fid, res.damage);
      addTaken(target.fid, res.damage);
      emit({ t: "damage", fid: actor.fid, tid: target.fid, life: target.life, crit: res.crit });
      emit({ t: "lost", fid: target.fid, life: target.life });

      // Talents défensifs de la cible : labels lisibles au-dessus d'elle.
      if (target.talents.includes("stoneskin")) {
        emit({ t: "talentProc", fid: target.fid, talent: "stoneskin", label: "🪨 −15%" });
      }
      if (target.talents.includes("thorns")) {
        const reflect = Math.max(1, Math.round(res.damage * 0.25));
        emit({ t: "talentProc", fid: target.fid, talent: "thorns", label: `🌵 −${reflect}` });
      }

      // Fournaise : chaque critique augmente durablement la Force de l'attaquant.
      if (res.crit && actor.rageOnCrit > 0) {
        const g = Math.max(1, Math.round(actor.atk * actor.rageOnCrit));
        actor.atkBonus += g;
        emit({ t: "talentProc", fid: actor.fid, talent: "fournaise", label: `🌋 +${g} ⚔️` });
      }

      // Vol de vie (Ponction / Sangsue).
      if (actor.lifesteal > 0 && res.damage > 0 && actor.life > 0 && actor.life < actor.maxLife) {
        const h = Math.max(1, Math.round(res.damage * actor.lifesteal));
        actor.life = Math.min(actor.maxLife, actor.life + h);
        emit({ t: "regen", fid: actor.fid, life: actor.life });
        emit({ t: "talentProc", fid: actor.fid, talent: "ponction", label: `🩸 +${h}` });
      }

      // Altération infligée à la cible (Embrasement / Inoculation).
      if (actor.onHitStatus && target.life > 0) {
        applyStatus(target, actor.onHitStatus);
        emit({ t: "status", fid: target.fid, kind: actor.onHitStatus.kind, label: `${actor.onHitStatus.icon} ${statusLabel(actor.onHitStatus.kind)}` });
      }
      // Spores : l'attaquant est empoisonné en frappant une cible à spores.
      if (target.poisonOnHurt && actor.life > 0) {
        applyStatus(actor, target.poisonOnHurt);
        emit({ t: "status", fid: actor.fid, kind: target.poisonOnHurt.kind, label: `${target.poisonOnHurt.icon} ${statusLabel(target.poisonOnHurt.kind)}` });
      }

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

  // ── Réaction à l'esquive (Élan / Danse du vent / Riposte) ─────────────────
  // `dodger` vient d'esquiver l'attaque de `attacker`.
  function onDodge(dodger: Fighter, attacker: Fighter) {
    // Élan : chaque esquive augmente durablement la Force.
    if (dodger.dodgeAtkGain > 0) {
      const g = Math.max(1, Math.round(dodger.atk * dodger.dodgeAtkGain));
      dodger.atkBonus += g;
      emit({ t: "talentProc", fid: dodger.fid, talent: "elan", label: `🌀 +${g} ⚔️` });
    }
    // Danse du vent : chaque esquive augmente aussi esquive + vitesse.
    if (dodger.dodgeSnowball) {
      dodger.dodge = Math.min(75, dodger.dodge + 3);
      dodger.timeMultiplier *= 0.97;
      emit({ t: "talentProc", fid: dodger.fid, talent: "danse", label: "🌀 +💨" });
    }
    // Riposte : contre-attaque immédiate.
    if (dodger.riposte && dodger.life > 0 && attacker.life > 0) {
      emit({ t: "talentProc", fid: dodger.fid, talent: "riposte", label: dodger.riposteCrit ? "⚔️ Contre !" : "⚔️ Riposte !" });
      const rep = resolveAttack(dodger, attacker, rng, dodger.riposteCrit);
      emit({ t: "goto", fid: dodger.fid, tid: attacker.fid });
      if (rep.dodged) {
        emit({ t: "dodge", fid: dodger.fid, tid: attacker.fid });
      } else {
        attacker.life = Math.max(0, attacker.life - rep.damage);
        addDealt(dodger.fid, rep.damage);
        addTaken(attacker.fid, rep.damage);
        emit({ t: "damage", fid: dodger.fid, tid: attacker.fid, life: attacker.life, crit: rep.crit });
        emit({ t: "lost", fid: attacker.fid, life: attacker.life });
      }
      emit({ t: "return", fid: dodger.fid });
      if (attacker.life <= 0) emit({ t: "dead", fid: attacker.fid });
    }
  }
}

function statusLabel(kind: StatusEntry["kind"]): string {
  return kind === "poison" ? "Poison" : "Brûlure";
}
