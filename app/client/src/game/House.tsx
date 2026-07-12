// House — cœur de la home. Vue de côté d'une petite pièce où le compagnon actif
// erre tranquillement (marche aléatoire, pauses, profondeur, émotes spontanées).
// Un clic sur le compagnon ouvre directement sa fiche (plus de zoom en place ni
// de volet coulissant — c'était source de bugs de layout).

import { useEffect, useState } from "react";
import { SPECIES } from "./engine/data";
import { HpBar } from "./shared";
import { Icon } from "./icons";
import type { Character } from "./engine/types";

// Bornes de déplacement dans la pièce.
const X_MIN = 18;
const X_MAX = 78;
const DEPTH_MIN = 6; // bottom %, proche (avant-plan)
const DEPTH_MAX = 30; // bottom %, loin

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Résumé d'une quête du jour, affiché en rappel sur la House. */
export type QuestGlance = { id: string; icon: string; label: string; progress: number; target: number; done: boolean };

export default function House({
  team,
  quests,
  onOpenSheet,
  onOpenDaily,
  onGoForest,
  onGoShop,
  onGoArena,
}: {
  team: Character[];
  quests: QuestGlance[];
  onOpenSheet: (id: string) => void;
  onOpenDaily: () => void;
  onGoForest: () => void;
  onGoShop: () => void;
  onGoArena: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState({ x: 46, y: 14 });
  const [walking, setWalking] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [reacting, setReacting] = useState(false);
  const [emote, setEmote] = useState<string | null>(null);

  const EMOTES = ["❤️", "✨", "😊", "🎵", "💜", "🌟"];
  function react(emo?: string) {
    setReacting(true);
    setEmote(emo ?? EMOTES[Math.floor(Math.random() * EMOTES.length)]);
    window.setTimeout(() => setReacting(false), 520);
    window.setTimeout(() => setEmote(null), 950);
  }

  const idx = Math.min(activeIdx, Math.max(0, team.length - 1));
  const c = team[idx];
  const sp = c ? SPECIES[c.speciesId] : null;

  // Errance aléatoire.
  useEffect(() => {
    if (!c) return;
    let cancelled = false;
    let timer: number;
    const step = () => {
      setPos((p) => {
        const nx = randBetween(X_MIN, X_MAX);
        const ny = randBetween(DEPTH_MIN, DEPTH_MAX);
        setDir(nx >= p.x ? 1 : -1);
        return { x: nx, y: ny };
      });
      setWalking(true);
      const walkMs = randBetween(900, 1700);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setWalking(false);
        timer = window.setTimeout(() => { if (!cancelled) step(); }, randBetween(600, 3200));
      }, walkMs);
    };
    timer = window.setTimeout(() => { if (!cancelled) step(); }, randBetween(400, 1200));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [c]);

  // Émotes spontanées.
  useEffect(() => {
    if (!c) return;
    let cancelled = false;
    let timer: number;
    const loop = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        react();
        loop();
      }, randBetween(11000, 22000));
    };
    loop();
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  if (!c || !sp) return null;

  return (
    <div className="house view">
      <div className="house-room">
        <div className="house-glow" />
        <div className="house-floor" />
        <button
          className={`house-critter dir-${dir > 0 ? "r" : "l"}`}
          style={{ left: `${pos.x}%`, bottom: `${pos.y}%` }}
          onClick={() => { react(); onOpenSheet(c.id); }}
          aria-label={`${c.name} — ouvrir la fiche`}
          title={`Voir ${c.name}`}
        >
          {emote && <span className="house-emote">{emote}</span>}
          <span className={`hc-body ${!walking ? "idle" : ""} ${reacting ? "reacting" : ""}`}>
            <img src={`/sprites/${sp.gfx}.png`} alt={c.name} draggable={false} />
          </span>
          <span className="house-critter-shadow" />
        </button>
      </div>

      <div className="house-below">
        <button className="house-id" onClick={() => onOpenSheet(c.id)} title="Ouvrir la fiche">
          <span className="team-name">{c.name} <span className="lvl">N.{c.level}</span></span>
          {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
          <span className="house-id-hp"><HpBar c={c} /></span>
        </button>

        {team.length > 1 && (
          <div className="house-dots">
            {team.map((t, i) => (
              <button
                key={t.id}
                className={`house-dot ${i === idx ? "on" : ""}`}
                onClick={() => setActiveIdx(i)}
                aria-label={t.name}
              />
            ))}
          </div>
        )}

        {quests.some((q) => !q.done) && (
          <button className="house-quests" onClick={onOpenDaily} aria-label="Journal du jour">
            <Icon name="journal" size={14} />
            {quests.filter((q) => !q.done).map((q) => (
              <span key={q.id} className="hq-item">{q.icon} {q.progress}/{q.target}</span>
            ))}
          </button>
        )}

        <div className="house-exit-choices">
          <button className="exit-choice" onClick={onGoForest} title="Explorer la carte du monde">
            <span className="exit-ico"><Icon name="map" size={24} /></span>
            <span className="exit-txt">Explorer</span>
          </button>
          <button className="exit-choice" onClick={onGoArena} title="Arène — duels de dresseurs">
            <span className="exit-ico"><Icon name="arena" size={24} /></span>
            <span className="exit-txt">Arène</span>
          </button>
          <button className="exit-choice" onClick={onGoShop} title="Boutique — potions">
            <span className="exit-ico"><Icon name="shop" size={24} /></span>
            <span className="exit-txt">Boutique</span>
          </button>
        </div>
      </div>
    </div>
  );
}
