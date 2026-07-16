// Combat LIVE — composant React. Rend le squelette DOM (façon combat-live-proto.html)
// et monte le moteur impératif liveEngine.ts qui pilote ticks, télégraphe, garde,
// parade, décharge, clash et juice. Remplace l'ancien CombatView (replay passif).

import { useEffect, useRef } from "react";
import "./live-combat.css";
import type { Character } from "../engine/types";
import { kitFor, type LiveResult } from "../engine/live";
import { createLiveCombat } from "./liveEngine";

export default function LiveCombat({
  player,
  enemy,
  speed = 1,
  seed,
  tutorial = false,
  onFinish,
}: {
  player: Character;
  enemy: Character;
  speed?: number;
  seed?: number;
  /** Mode guidé : texte d'intro pédagogique. */
  tutorial?: boolean;
  onFinish: (r: LiveResult) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const finishedRef = useRef(false);
  const kit = kitFor(player.speciesId);

  useEffect(() => {
    if (!rootRef.current) return;
    finishedRef.current = false;
    const engine = createLiveCombat({
      root: rootRef.current,
      player,
      enemy,
      seed: seed ?? Math.floor(Math.random() * 1_000_000_000),
      speed: () => speedRef.current,
      intro: tutorial
        ? { title: "À toi de jouer", sub: "Choisis une action à chaque tick. Ne rien faire = charger. Pare au bon moment !", cta: "Commencer" }
        : { title: "Combat", sub: "La clock avance seule. Ne rien faire = charger.", cta: "Prêt ?" },
      onEnd: (r: LiveResult) => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onFinish(r);
      },
    });
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, enemy.id]);

  const gP = player.speciesId;
  const gE = enemy.speciesId;

  return (
    <div className={`live-combat sp-${kit.special}`} ref={rootRef}>
      <div className="lc-wrap">
        <header className="lc-top">
          <h1>
            Combat <span className="lc-live">LIVE</span>
          </h1>
          <div className="tickbadge">
            TICK <b data-el="tickN">0</b>
          </div>
        </header>

        <div className="arena" data-el="arena">
          <div className="ground" />
          <div className="timer" data-el="timer" style={{ transform: "scaleX(0)" }} />
          <div className="flash" data-el="flash" />
          <div className="clashspark" data-el="spark" />
          <div className="clashring" data-el="clashring" />
          <div className="clashtext" data-el="fC" />
          <div className="shock" data-el="shock" />

          <div className="fighter player" data-el="fP">
            <div className="nameplate">
              <div className="nm">
                <span>{player.name}</span>
                <span className="lc-lvl">N.{player.level}</span>
              </div>
              <div className="hpbar">
                <div className="trail" data-el="trailP" />
                <div className="fill" data-el="hpP" />
              </div>
            </div>
            <div className="combo-badge" data-el="comboP" />
            <div className="sprite-wrap">
              <div className="field" data-el="fieldP" />
              <div className="shield-fx" data-el="shfxP" />
              <div className="sprite idle" data-el="sprP">
                <img src={`/sprites/${gP}.png`} alt={player.name} draggable={false} />
              </div>
            </div>
            <div className="nrj" data-el="nrjP" />
          </div>

          <div className="fighter enemy" data-el="fE">
            <div className="nameplate">
              <div className="nm">
                <span>{enemy.name}</span>
                <span className="lc-lvl">N.{enemy.level}</span>
              </div>
              <div className="hpbar">
                <div className="trail" data-el="trailE" />
                <div className="fill" data-el="hpE" />
              </div>
            </div>
            <div className="sprite-wrap">
              <div className="sprite idle" data-el="sprE">
                <img src={`/sprites/${gE}.png`} alt={enemy.name} draggable={false} />
              </div>
            </div>
            <div className="nrj" data-el="nrjE" />
          </div>

          <div className="overlay" data-el="overlay">
            <div className="big-t" data-el="ovT">
              Combat
            </div>
            <div className="sub" data-el="ovS" />
            <div className="lc-playstyle">{kit.playstyle}</div>
            <button className="cta" data-el="cta">
              Prêt ?
            </button>
          </div>
        </div>

        <div className="controls">
          <div className="btns" data-el="btns" />
          <div className="chargewrap" data-el="chargeWrap" />
        </div>
      </div>
    </div>
  );
}
