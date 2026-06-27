// F10 — Renderer "bête" : rejoue l'ActionLog action par action. Aucun calcul de
// combat ici. Visuels simplistes (sprites, barres de vie, lunge, dégâts flottants).

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
  lunge: number; // décalage horizontal en cours d'attaque
  flash: boolean;
};

type Pop = { id: number; fid: number; text: string; kind: "dmg" | "crit" | "heal" | "miss" };

const BASE_DELAY = 240;

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
            lunge: 0,
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
        const dir = log.find((x) => x.t === "add" && (x as any).fid === a.fid) as any;
        const side = dir?.side ?? 0;
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], lunge: side === 0 ? 46 : -46 } } : s));
        delay = 170;
        break;
      }
      case "return":
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], lunge: 0 } } : s));
        delay = 120;
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
        setSprites((s) => (s[a.fid] ? { ...s, [a.fid]: { ...s[a.fid], life: a.life } } : s));
        addPop(a.fid, "+soin", "heal");
        delay = 200;
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

  const side0 = Object.values(sprites).filter((s) => s.side === 0);
  const side1 = Object.values(sprites).filter((s) => s.side === 1);

  return (
    <div className="combat-arena">
      <div className="arena-side left">{side0.map((s) => renderFighter(s, pops))}</div>
      <div className="arena-vs">VS</div>
      <div className="arena-side right">{side1.map((s) => renderFighter(s, pops))}</div>
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
  return (
    <div key={s.fid} className={`fighter ${s.dead ? "dead" : ""}`}>
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
          transform: `translateX(${s.lunge}px) scale(${s.size / 100})`,
          filter: s.flash ? "brightness(2.2)" : "none",
        }}
      >
        <div className="fighter-aura" style={{ background: s.tint }} />
        <img src={`/sprites/${s.gfx}.png`} alt={s.name} draggable={false} />
      </div>
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
