// F10 — Renderer "bête" : rejoue l'ActionLog action par action. Aucun calcul de
// combat ici. Salle façon Home élargie : les deux camps se font face, l'attaquant
// traverse la salle vers l'adversaire, frappe (bulle de dégâts/esquive), puis revient.

import { useEffect, useRef, useState } from "react";
import type { Action } from "../engine/types";

type Sprite = {
  fid: number;
  name: string;
  gfx: string;
  side: 0 | 1;
  level: number;
  size: number;
  tint: string;
  life: number;
  maxLife: number;
  dead: boolean;
  x: number; // position horizontale courante, en % de la largeur de la salle
  flash: boolean;
  hurt: boolean; // recul/tremblement à l'encaissement
  lunge: boolean; // coup porté (squash & stretch de l'attaquant)
};

type Pop = { id: number; fid: number; text: string; kind: "dmg" | "crit" | "heal" | "miss" | "talent" };

const BASE_DELAY = 240;

// Position "au repos" de chaque camp dans la salle (façon Home élargie), et
// distance d'approche lors d'un assaut : l'attaquant traverse la salle vers
// l'adversaire, frappe, puis revient chez lui.
const HOME_X: Record<0 | 1, number> = { 0: 24, 1: 76 };
const APPROACH_GAP = 15;

export default function CombatView({
  log,
  onFinish,
  speed,
  tutorial = false,
}: {
  log: Action[];
  onFinish: (winner: 0 | 1 | null) => void;
  speed: number;
  /** Mode guidé : le combat se met en pause aux moments-clés avec une bulle explicative. */
  tutorial?: boolean;
}) {
  const [sprites, setSprites] = useState<Record<number, Sprite>>({});
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState<"" | "sk" | "sk-big">("");
  const [caption, setCaption] = useState<string>("");
  // Dernier attaquant connu (émis par `goto`) : sert à jouer son coup au moment du `damage`.
  const attackerRef = useRef<number | null>(null);
  const [bubble, setBubble] = useState<{ title: string; text: string } | null>(null);
  const idxRef = useRef(0);
  const popSeq = useRef(0);
  const timer = useRef<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const finishedRef = useRef(false);
  // Jalons tutorial déjà déclenchés (ordre de tour, 1er talent).
  const shownStops = useRef<{ turn: boolean; talent: boolean }>({ turn: false, talent: false });

  useEffect(() => {
    idxRef.current = 0;
    finishedRef.current = false;
    shownStops.current = { turn: false, talent: false };
    setSprites({});
    setPops([]);
    setShake("");
    setCaption("");
    setBubble(null);
    attackerRef.current = null;
    play();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  function schedule(fn: () => void, ms: number) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, Math.max(16, ms / speedRef.current));
  }

  // Met le playback en pause et affiche une bulle ; reprend au clic « Compris ».
  function stopWith(title: string, text: string, resume: () => void) {
    if (timer.current) window.clearTimeout(timer.current);
    setBubble({ title, text });
    pendingResume.current = () => {
      setBubble(null);
      resume();
    };
  }
  const pendingResume = useRef<(() => void) | null>(null);

  const shakeTimer = useRef<number | null>(null);
  function triggerShake(kind: "sk" | "sk-big") {
    setShake(kind);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(""), kind === "sk-big" ? 380 : 260);
  }

  function addPop(fid: number, text: string, kind: Pop["kind"]) {
    const id = popSeq.current++;
    setPops((p) => [...p, { id, fid, text, kind }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  }

  function play() {
    const i = idxRef.current;
    if (i >= log.length) return;
    const a = log[i];
    idxRef.current = i + 1;
    let delay = BASE_DELAY;

    switch (a.t) {
      case "add":
        setSprites((s) => ({
          ...s,
          [a.fid]: {
            fid: a.fid,
            name: a.name,
            gfx: a.gfx,
            side: a.side,
            level: a.level,
            size: a.size,
            tint: a.tint,
            life: a.life,
            maxLife: a.maxLife,
            dead: false,
            x: HOME_X[a.side],
            flash: false,
            hurt: false,
            lunge: false,
          },
        }));
        delay = 90;
        break;
      case "display":
        delay = 300;
        break;
      case "text":
      case "announce":
        setCaption(a.t === "text" ? a.text : a.text);
        delay = 360;
        break;
      case "goto": {
        // L'attaquant traverse la salle jusqu'à proximité de l'adversaire.
        attackerRef.current = a.fid;
        setSprites((s) => {
          const cur = s[a.fid];
          if (!cur) return s;
          const dest = cur.side === 0 ? HOME_X[1] - APPROACH_GAP : HOME_X[0] + APPROACH_GAP;
          return { ...s, [a.fid]: { ...cur, x: dest } };
        });
        delay = 320;
        break;
      }
      case "return":
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], x: HOME_X[s[a.fid].side] } } : s));
        delay = 260;
        break;
      case "damage": {
        const atk = attackerRef.current;
        setSprites((s) => {
          const t = s[a.tid];
          if (!t) return s;
          const next = { ...s, [a.tid]: { ...t, life: a.life, flash: true, hurt: true } };
          if (atk != null && s[atk] && atk !== a.tid) next[atk] = { ...s[atk], lunge: true };
          return next;
        });
        triggerShake(a.crit ? "sk-big" : "sk");
        addPop(a.tid, `-${pickDmg(log, i)}${a.crit ? " ✦" : ""}`, a.crit ? "crit" : "dmg");
        if (a.crit) setCaption("Coup critique !");
        window.setTimeout(() => {
          setSprites((s) => {
            const next = { ...s };
            if (next[a.tid]) next[a.tid] = { ...next[a.tid], flash: false, hurt: false };
            if (atk != null && next[atk]) next[atk] = { ...next[atk], lunge: false };
            return next;
          });
        }, 260);
        delay = a.crit ? 380 : 240;
        break;
      }
      case "dodge":
        addPop(a.tid, "esquive", "miss");
        delay = 240;
        break;
      case "regen":
        // Le label lisible ("+X 💚") est émis par l'action talentProc qui suit.
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], life: a.life } } : s));
        delay = 60;
        break;
      case "talentProc":
        // Label flottant expliquant l'effet du talent (crit, épines, poison, riposte…).
        addPop(a.fid, a.label, a.talent === "regen" || a.talent === "ponction" ? "heal" : "talent");
        delay = 220;
        break;
      case "status":
        // Une altération vient d'être posée (Poison ☠️ / Brûlure 🔥).
        addPop(a.fid, a.label, "talent");
        delay = 240;
        break;
      case "statusTick": {
        // Dégâts périodiques d'une altération : mise à jour PV + pop rouge.
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], life: a.life, flash: true, hurt: true } } : s));
        triggerShake("sk");
        addPop(a.fid, `-${a.dmg} ${a.kind === "poison" ? "☠️" : "🔥"}`, "dmg");
        window.setTimeout(
          () => setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], flash: false, hurt: false } } : s)),
          260
        );
        delay = 260;
        break;
      }
      case "lost":
        delay = 10;
        break;
      case "dead":
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], dead: true } } : s));
        setCaption(`${sprites[a.fid]?.name ?? "Le combattant"} est K.O. !`);
        delay = 600;
        break;
      case "pause":
        delay = a.time;
        break;
      case "timeLimit":
        setCaption("⏳ Temps écoulé — égalité !");
        delay = 700;
        break;
      case "finish":
        if (!finishedRef.current) {
          finishedRef.current = true;
          if (tutorial) {
            stopWith(
              "Combat terminé",
              a.winner === 0
                ? "Victoire — sans rien piloter. Tout s'est joué avant, dans ta préparation."
                : "Le combat se joue seul : la stratégie est dans la préparation.",
              () => onFinish(a.winner)
            );
          } else {
            schedule(() => onFinish(a.winner), 500);
          }
        }
        return;
    }

    // Jalons pédagogiques (mode guidé uniquement) : on met en pause après avoir
    // joué l'action, puis on reprend au clic.
    if (tutorial) {
      if (a.t === "goto" && !shownStops.current.turn) {
        shownStops.current.turn = true;
        stopWith(
          "À qui le tour ?",
          "Le plus rapide agit en premier, et plus souvent. Tout dépend des stats.",
          () => schedule(play, delay)
        );
        return;
      }
      if (a.t === "talentProc" && !shownStops.current.talent) {
        shownStops.current.talent = true;
        stopWith(
          "Un talent s'est déclenché !",
          "Ce label violet, c'est son talent inné qui s'active tout seul.",
          () => schedule(play, delay)
        );
        return;
      }
    }

    schedule(play, delay);
  }

  return (
    <div className="combat-arena">
      <div className={`combat-room ${shake}`}>
        <div className="combat-floor-line" />
        <div className="combat-window" />
        {Object.values(sprites).map((s) => renderFighter(s, pops))}
      </div>
      {caption && <div className="arena-caption">{caption}</div>}
      {bubble && (
        <div className="tuto-bubble-overlay">
          <div className="tuto-bubble">
            <div className="tuto-bubble-title">{bubble.title}</div>
            <div className="tuto-bubble-text">{bubble.text}</div>
            <button className="tuto-bubble-btn" onClick={() => pendingResume.current?.()}>
              Compris →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pickDmg(log: Action[], i: number): number {
  // récupère la valeur de PV perdus via le 'lost' qui suit, sinon delta
  const dmgAction = log[i] as Extract<Action, { t: "damage" }>;
  const prevLife = findPrevLife(log, i, dmgAction.tid);
  return Math.max(0, prevLife - dmgAction.life);
}

function findPrevLife(log: Action[], i: number, tid: number): number {
  for (let k = i - 1; k >= 0; k--) {
    const a = log[k];
    if (a.t === "damage" && a.tid === tid) return a.life;
    if (a.t === "regen" && a.fid === tid) return a.life;
    if (a.t === "statusTick" && a.fid === tid) return a.life;
    if (a.t === "add" && a.fid === tid) return a.life;
  }
  return 0;
}

function renderFighter(s: Sprite, pops: Pop[]) {
  const pct = Math.max(0, Math.round((s.life / s.maxLife) * 100));
  const mine = pops.filter((p) => p.fid === s.fid);
  // Les deux camps se font face : côté droit (les ennemis) regarde vers la
  // gauche, on retourne donc son sprite (l'art est dessiné tourné à droite).
  const flip = s.side === 1;
  return (
    <div
      key={s.fid}
      className={`fighter ${s.dead ? "dead" : ""} ${s.hurt ? "hurt" : ""} ${s.lunge ? "lunge" : ""}`}
      style={{ left: `${s.x}%` }}
    >
      <div className="fighter-pops">
        {mine.map((p) => (
          <span key={p.id} className={`pop ${p.kind}`}>
            {p.text}
          </span>
        ))}
      </div>
      <div
        className="fighter-sprite"
        style={{
          transform: `scale(${(s.size / 100) * (flip ? -1 : 1)}, ${s.size / 100})`,
          filter: s.flash ? "brightness(2.2)" : "none",
        }}
      >
        <div className="fighter-aura" style={{ background: s.tint }} />
        <img src={`/sprites/${s.gfx}.png`} alt={s.name} draggable={false} />
      </div>
      <span className="fighter-shadow" />
      <div className="fighter-info">
        <div className="fighter-name">
          {s.name} <span className="lvl">N.{s.level}</span>
        </div>
        <div className="hpbar">
          <div className="hpbar-trail" style={{ width: `${pct}%` }} />
          <div className="hpbar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="hp-num">
          {Math.max(0, s.life)}/{s.maxLife}
        </div>
      </div>
    </div>
  );
}
