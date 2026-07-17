// House — cœur de la home. Vue de côté d'une petite pièce où le compagnon actif
// erre tranquillement (marche aléatoire, pauses, profondeur, émotes spontanées).
// Un clic sur le compagnon met la House en « focus in-place » (T002) : le reste
// de la House fade out, l'AM glisse en haut à gauche et sa fiche (stats, actions,
// espèce, historique) apparaît en fade-in autour de lui — sans changer de page ni
// pousser d'entrée d'historique de navigation. Un clic hors de l'AM revient à la
// House de base en douceur.

import { useEffect, useState } from "react";
import { SPECIES } from "./engine/data";
import { HpBar } from "./shared";
import { Icon } from "./icons";
import { AmHeroInfo, AmDetails } from "./AmDetails";
import type { Character, InteractKind } from "./engine/types";

// Bornes de déplacement dans la pièce.
const X_MIN = 18;
const X_MAX = 78;
const DEPTH_MIN = 6; // bottom %, proche (avant-plan)
const DEPTH_MAX = 30; // bottom %, loin

// Durée du fade-out avant démontage du panneau de focus (doit matcher le CSS).
const FOCUS_OUT_MS = 460;

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Résumé d'une quête du jour, affiché en rappel sur la House. */
export type QuestGlance = { id: string; icon: string; label: string; progress: number; target: number; done: boolean };

export default function House({
  team,
  quests,
  gold,
  potions,
  onOpenDaily,
  onGoForest,
  onGoShop,
  onGoArena,
  onToggleHeal,
  onPotion,
  onFull,
  onInteract,
  onChooseBranch,
}: {
  team: Character[];
  quests: QuestGlance[];
  gold: number;
  potions: number;
  onOpenDaily: () => void;
  onGoForest: () => void;
  onGoShop: () => void;
  onGoArena: () => void;
  onToggleHeal: (id: string) => void;
  onPotion: (id: string) => void;
  onFull: (id: string) => void;
  onInteract: (id: string, k: InteractKind) => void;
  onChooseBranch: (id: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState({ x: 46, y: 14 });
  const [walking, setWalking] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [reacting, setReacting] = useState(false);
  const [emote, setEmote] = useState<string | null>(null);
  // Focus in-place : `focused` = intention (pilote les classes/transitions),
  // `rendered` = présence DOM du panneau (maintenu le temps du fade-out).
  const [focused, setFocused] = useState(false);
  const [rendered, setRendered] = useState(false);

  const EMOTES = ["❤️", "✨", "😊", "🎵", "💜", "🌟"];
  function react(emo?: string) {
    setReacting(true);
    setEmote(emo ?? EMOTES[Math.floor(Math.random() * EMOTES.length)]);
    window.setTimeout(() => setReacting(false), 520);
    window.setTimeout(() => setEmote(null), 950);
  }

  function openFocus() {
    setRendered(true);
    // laisse le DOM se monter avant d'activer la transition d'entrée
    requestAnimationFrame(() => setFocused(true));
  }
  function closeFocus() {
    setFocused(false);
    window.setTimeout(() => setRendered(false), FOCUS_OUT_MS);
  }

  const idx = Math.min(activeIdx, Math.max(0, team.length - 1));
  const c = team[idx];
  const sp = c ? SPECIES[c.speciesId] : null;

  // Errance aléatoire — gelée pendant le focus.
  useEffect(() => {
    if (!c || focused) return;
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
  }, [c, focused]);

  // Émotes spontanées — gelées pendant le focus.
  useEffect(() => {
    if (!c || focused) return;
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
  }, [c, focused]);

  if (!c || !sp) return null;

  // En focus : l'AM se fige en haut à gauche de la pièce (compacte) ; sinon il erre.
  const critterStyle = focused
    ? { left: "24%", bottom: "16%" }
    : { left: `${pos.x}%`, bottom: `${pos.y}%` };

  return (
    <div className={`house view ${focused ? "focused" : ""}`}>
      <div
        className="house-room"
        onClick={() => { if (focused) closeFocus(); }}
      >
        <div className="house-glow" />
        <div className="house-floor" />
        <button
          className={`house-critter dir-${dir > 0 ? "r" : "l"}`}
          style={critterStyle}
          onClick={(e) => { e.stopPropagation(); react(); if (!focused) openFocus(); }}
          aria-label={focused ? `${c.name} — fermer la fiche` : `${c.name} — voir la fiche`}
          title={focused ? c.name : `Voir ${c.name}`}
        >
          {emote && <span className="house-emote">{emote}</span>}
          <span className={`hc-body ${!walking ? "idle" : ""} ${reacting ? "reacting" : ""}`}>
            <img src={`/sprites/${sp.gfx}.png`} alt={c.name} draggable={false} />
          </span>
          <span className="house-critter-shadow" />
        </button>
      </div>

      {rendered && (
        <div className={`house-focus ${focused ? "on" : ""}`}>
          <div className="house-focus-head">
            <AmHeroInfo c={c} />
            <button className="ghost sm house-focus-close" onClick={closeFocus} aria-label="Fermer la fiche">
              <Icon name="close" size={16} />
            </button>
          </div>
          <AmDetails
            c={c}
            gold={gold}
            potions={potions}
            onToggleHeal={onToggleHeal}
            onPotion={onPotion}
            onFull={onFull}
            onInteract={onInteract}
            onChooseBranch={() => onChooseBranch(c.id)}
          />
        </div>
      )}

      <div className="house-below">
        <button className="house-id" onClick={openFocus} title="Voir la fiche">
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
