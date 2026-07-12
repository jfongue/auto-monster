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
}: {
  log: Action[];
  onFinish: (winner: 0 | 1 | null) => void;
  speed: number;
}) {
  const [sprites, setSprites] = useState<Record<number, Sprite>>({});
  const [pops, setPops] = useState<Pop[]>([]);
  const [caption, setCaption] = useState<string>("");
  const idxRef = useRef(0);
  const popSeq = useRef(0);
  const timer = useRef<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const finishedRef = useRef(false);

  useEffect(() => {
    idxRef.current = 0;
    finishedRef.current = false;
    setSprites({});
    setPops([]);
    setCaption("");
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
        setSprites((s) => {
          const t = s[a.tid];
          if (!t) return s;
          return { ...s, [a.tid]: { ...t, life: a.life, flash: true } };
        });
        addPop(a.tid, `-${pickDmg(log, i)}${a.crit ? "!" : ""}`, a.crit ? "crit" : "dmg");
        window.setTimeout(
          () => setSprites((s) => (s[a.tid] ? { ...s, [a.tid]: { ...s[a.tid], flash: false } } : s)),
          160
        );
        delay = a.crit ? 360 : 230;
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
        // Label flottant expliquant l'effet du talent (crit, épines, peau de pierre, régén…).
        addPop(a.fid, a.label, a.talent === "regen" ? "heal" : "talent");
        delay = 220;
        break;
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
          schedule(() => onFinish(a.winner), 500);
        }
        return;
    }
    schedule(play, delay);
  }

  return (
    <div className="combat-arena">
      <div className="combat-room">
        <div className="combat-floor-line" />
        <div className="combat-window" />
        {Object.values(sprites).map((s) => renderFighter(s, pops))}
      </div>
      {caption && <div className="arena-caption">{caption}</div>}
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
    <div key={s.fid} className={`fighter ${s.dead ? "dead" : ""}`} style={{ left: `${s.x}%` }}>
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
          <div className="hpbar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="hp-num">
          {Math.max(0, s.life)}/{s.maxLife}
        </div>
      </div>
    </div>
  );
}
