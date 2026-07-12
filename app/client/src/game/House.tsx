// House — cœur de la home page. Vue de côté d'une petite pièce où le compagnon
// actif erre tranquillement (marche aléatoire, pauses variables, profondeur).
// Un clic dessus déclenche un zoom smooth en place + une fiche résumée qui
// glisse dans un volet à droite (pas de changement de page, pas de fiche
// plein écran ici — voir .house-critter-anim.zoomed dans game.css).
//
// Règle du projet : le sprite reste "miniature" — le zoom au clic agrandit
// le compagnon dans la pièce mais ne le fait jamais passer plein écran.

import { useEffect, useRef, useState } from "react";
import { SPECIES } from "./engine/data";
import { xpForNext } from "./engine/progression";
import { HpBar, StatRow } from "./shared";
import type { Character } from "./engine/types";

// Bornes de déplacement dans la pièce.
const X_MIN = 18;
const X_MAX = 78;
const DEPTH_MIN = 4; // bottom %, proche (avant-plan)
const DEPTH_MAX = 32; // bottom %, loin (près de la ligne de sol)

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
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState({ x: 46, y: 12 });
  const [walking, setWalking] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);

  const idx = Math.min(activeIdx, Math.max(0, team.length - 1));
  const c = team[idx];
  const sp = c ? SPECIES[c.speciesId] : null;

  // Errance aléatoire : marche vers un point tiré au hasard (x + profondeur),
  // puis pause de durée variable, en boucle. Suspendue quand on est en focus.
  useEffect(() => {
    if (focused || !c) return;
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
        const pauseMs = randBetween(500, 3200); // pauses plus ou moins longues
        timer = window.setTimeout(() => {
          if (!cancelled) step();
        }, pauseMs);
      }, walkMs);
    };

    timer = window.setTimeout(() => {
      if (!cancelled) step();
    }, randBetween(400, 1200));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focused, c]);

  if (!c || !sp) return null;

  const xpNext = xpForNext(c.level);

  const critterStyle = focused
    ? { left: "50%", bottom: "18%" }
    : { left: `${pos.x}%`, bottom: `${pos.y}%` };

  return (
    <div className={`house view ${focused ? "house-open" : ""}`}>
      <div className="house-stage">
        <div className="house-room">
          <div className="house-floor-line" />
          <div className="house-window" />
          <button
            className={`house-critter dir-${dir > 0 ? "r" : "l"}`}
            style={critterStyle}
            onClick={() => !focused && setFocused(true)}
            title={focused ? undefined : `Voir ${c.name}`}
          >
            <div className={`house-critter-anim ${walking && !focused ? "walking" : ""} ${focused ? "zoomed" : ""}`}>
              <img src={`/sprites/${sp.gfx}.png`} alt={c.name} draggable={false} />
            </div>
            <span className="house-critter-shadow" />
          </button>
        </div>

        <div className="house-panel">
          <button className="ghost sm house-back" onClick={() => setFocused(false)}>← Retour</button>
          <div className="team-name big">
            {c.name} <span className="lvl">N.{c.level}</span>
            {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
          </div>
          <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
          <HpBar c={c} />
          <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
          <div className="muted small">XP {c.xp}/{xpNext}</div>
          <StatRow stats={c.stats} />
          <button className="house-exit-btn" style={{ marginTop: 10, maxWidth: "none" }} onClick={() => onOpenSheet(c.id)}>
            Voir la fiche complète
          </button>
        </div>
      </div>

      <div className={`house-below ${focused ? "faded" : ""}`}>
        <div className="house-caption">
          <span className="team-name">{c.name} <span className="lvl">N.{c.level}</span></span>
          {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
        </div>

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
          <button className="house-quests" onClick={onOpenDaily} title="Journal du jour">
            {quests.filter((q) => !q.done).map((q) => (
              <span key={q.id} className="hq-item">
                {q.icon} {q.progress}/{q.target}
              </span>
            ))}
          </button>
        )}

        <div className="house-exit-wrap">
          <div className="house-exit-choices">
            <button className="exit-choice" onClick={onGoForest}>
              <span className="exit-ico">🗺️</span>
              <span className="exit-txt">Explorer<span className="exit-sub">Carte du monde</span></span>
            </button>
            <button className="exit-choice" onClick={onGoArena}>
              <span className="exit-ico">🏟️</span>
              <span className="exit-txt">Arène<span className="exit-sub">Duels de dresseurs</span></span>
            </button>
            <button className="exit-choice" onClick={onGoShop}>
              <span className="exit-ico">🏪</span>
              <span className="exit-txt">Boutique<span className="exit-sub">Potions</span></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
