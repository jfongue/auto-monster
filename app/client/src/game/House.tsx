// House — cœur de la home page. Vue de côté d'une petite pièce où le compagnon
// actif sautille tranquillement. Un clic dessus ouvre un focus avec sa fiche
// résumée à droite (bouton retour). "Sortir" révèle Forêt / Boutique.
//
// Règle absolue du projet : le sprite reste toujours petit/miniature ici — on
// ne l'agrandit JAMAIS en plein écran (voir .house-critter / .house-focus-art
// dans game.css, plafonnées en px).

import { useEffect, useRef, useState } from "react";
import { SPECIES } from "./engine/data";
import { xpForNext } from "./engine/progression";
import { HpBar, StatRow } from "./shared";
import type { Character } from "./engine/types";

export default function House({
  team,
  gold,
  potions,
  onOpenSheet,
  onGoForest,
  onGoShop,
}: {
  team: Character[];
  gold: number;
  potions: number;
  onOpenSheet: (id: string) => void;
  onGoForest: () => void;
  onGoShop: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [walkX, setWalkX] = useState(46);
  const dirRef = useRef<1 | -1>(1);

  const idx = Math.min(activeIdx, Math.max(0, team.length - 1));
  const c = team[idx];
  const sp = c ? SPECIES[c.speciesId] : null;

  // Petite errance douce dans la pièce tant qu'on n'est pas en focus.
  useEffect(() => {
    if (focused || !c) return;
    const id = window.setInterval(() => {
      setWalkX((x) => {
        let nx = x + dirRef.current * 4;
        if (nx > 76) { nx = 76; dirRef.current = -1; }
        if (nx < 20) { nx = 20; dirRef.current = 1; }
        return nx;
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [focused, c]);

  if (!c || !sp) return null;

  const xpNext = xpForNext(c.level);

  return (
    <div className="house view">
      {!focused ? (
        <>
          <div className="house-purse">💰 {gold} <span className="dot">·</span> 🧪 {potions}</div>

          <div className="house-room">
            <div className="house-floor-line" />
            <div className="house-window" />
            <button
              className={`house-critter dir-${dirRef.current > 0 ? "r" : "l"}`}
              style={{ left: `${walkX}%` }}
              onClick={() => setFocused(true)}
              title={`Voir ${c.name}`}
            >
              <img src={`/sprites/${sp.gfx}.png`} alt={c.name} draggable={false} />
              <span className="house-critter-shadow" />
            </button>
          </div>

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

          <div className="house-exit-wrap">
            <button className="house-exit-btn" onClick={() => setExitOpen((v) => !v)}>
              {exitOpen ? "✕ Fermer" : "🚪 Sortir"}
            </button>
            {exitOpen && (
              <div className="house-exit-choices stagger">
                <button className="exit-choice" onClick={onGoForest}>
                  <span className="exit-ico">🌲</span>
                  <span className="exit-txt">Forêt<span className="exit-sub">Combats sauvages</span></span>
                </button>
                <button className="exit-choice" onClick={onGoShop}>
                  <span className="exit-ico">🏪</span>
                  <span className="exit-txt">Boutique<span className="exit-sub">Potions & fournitures</span></span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="house-focus view">
          <button className="ghost sm house-back" onClick={() => setFocused(false)}>← Retour</button>
          <div className="house-focus-body">
            <div className="house-focus-art">
              <img src={`/sprites/${sp.gfx}.png`} alt={c.name} draggable={false} />
            </div>
            <div className="house-focus-info">
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
        </div>
      )}
    </div>
  );
}
