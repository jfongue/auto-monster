// Arène des Dresseurs — duels asynchrones contre les équipes (instantanés)
// des autres joueurs. S'il n'y a personne, un rival "maison" est généré au
// niveau du joueur pour que l'arène soit toujours jouable.

import { useEffect, useState } from "react";
import { api, type ArenaOpponent } from "../lib/api";
import { SPECIES, STARTERS } from "./engine/data";
import { currentLife, statsForLevel } from "./engine/progression";
import { HpBar } from "./shared";
import { Icon } from "./icons";
import type { Character } from "./engine/types";
import { GameState, ARENA_MAX_REWARDED_WINS, ARENA_WIN_GOLD, arenaWinsToday } from "./state";

/** Rival généré localement quand aucun autre dresseur n'existe encore. */
function makeBotOpponent(playerLevel: number): ArenaOpponent {
  const speciesId = STARTERS[Math.floor(Math.random() * STARTERS.length)];
  const level = Math.max(1, playerLevel);
  return {
    userId: -1,
    trainer: "Nova (rivale)",
    teamSize: 1,
    lead: {
      speciesId,
      name: SPECIES[speciesId].name,
      level,
      stats: statsForLevel(speciesId, level),
      talents: [],
    },
  };
}

export default function Arena({
  gs,
  onBack,
  onDuel,
}: {
  gs: GameState;
  onBack: () => void;
  onDuel: (opp: ArenaOpponent, charId: string) => void;
}) {
  const [opponents, setOpponents] = useState<ArenaOpponent[] | null>(null);
  const combatants = [...gs.team, ...(gs.rental ? [gs.rental.char] : [])];
  const firstAlive = combatants.find((c) => currentLife(c) > 0) ?? combatants[0];
  const [pick, setPick] = useState(firstAlive?.id ?? "");
  const wins = arenaWinsToday(gs);
  const rewardedLeft = Math.max(0, ARENA_MAX_REWARDED_WINS - wins);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { opponents } = await api.getArenaOpponents();
        if (!alive) return;
        setOpponents(opponents.length ? opponents : [makeBotOpponent(gs.team[0]?.level ?? 1)]);
      } catch {
        if (alive) setOpponents([makeBotOpponent(gs.team[0]?.level ?? 1)]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = combatants.find((c) => c.id === pick);
  const ko = chosen ? currentLife(chosen) <= 0 : true;

  return (
    <div className="hub arena view">
      <button className="ghost sm zone-back chip-ico" onClick={onBack}><Icon name="back" size={15} /> Maison</button>

      <div className="zone-hero arena-hero">
        <div className="zh-icon"><Icon name="arena" size={40} /></div>
        <div className="zone-name">Arène des Dresseurs</div>
        <div className="zh-sub">Duels amicaux, sans risque.</div>
        <span className="zh-state exploration chip-ico">
          {rewardedLeft > 0
            ? <><Icon name="gold" size={13} /> {rewardedLeft} victoire{rewardedLeft > 1 ? "s" : ""} récompensée{rewardedLeft > 1 ? "s" : ""} (+{ARENA_WIN_GOLD})</>
            : "Récompenses du jour épuisées — à demain !"}
        </span>
      </div>

      <div className="zone-cols">
        <div className="card">
          <div className="card-title chip-ico"><Icon name="arena" size={16} /> Adversaires</div>
          {opponents === null && <p className="muted small">Recherche de dresseurs…</p>}
          {opponents?.map((o) => {
            const sp = SPECIES[o.lead.speciesId];
            if (!sp) return null;
            return (
              <div key={o.userId} className="arena-row">
                <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={o.lead.name} />
                <div className="pick-meta">
                  <div className="team-name">{o.lead.name} <span className="lvl">N.{o.lead.level}</span></div>
                  <div className="muted small">Dresseur·se : {o.trainer} · équipe de {o.teamSize}</div>
                </div>
                <button className="primary sm" disabled={ko || !chosen} onClick={() => chosen && onDuel(o, chosen.id)}>
                  Duel
                </button>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-title chip-ico"><Icon name="def" size={16} /> Ton champion</div>
          <div className="pick-list">
            {combatants.map((c) => (
              <div
                key={c.id}
                className={`pick-row ${combatants.length > 1 && c.id === pick ? "active" : ""}`}
                onClick={() => combatants.length > 1 && setPick(c.id)}
              >
                <img className="mini" src={`/sprites/${SPECIES[c.speciesId].gfx}.png`} alt={c.name} />
                <div className="pick-meta">
                  <div className="team-name">{c.name} <span className="lvl">N.{c.level}</span></div>
                  <HpBar c={c} />
                </div>
                {combatants.length > 1 && c.id === pick && <span className="active-tag">choisi</span>}
              </div>
            ))}
          </div>
          {ko && <p className="warn chip-ico"><Icon name="warn" size={14} /> Champion K.O. — soigne-le d'abord.</p>}
          <p className="hint" style={{ marginBottom: 0 }}>Duel sans risque : PV restaurés après le combat.</p>
        </div>
      </div>
    </div>
  );
}

/** Construit le Character ennemi d'un duel depuis l'instantané serveur. */
export function makeDuelEnemy(opp: ArenaOpponent): Character {
  const { lead } = opp;
  return {
    id: `duel_${opp.userId}_${Date.now().toString(36)}`,
    speciesId: lead.speciesId,
    name: lead.name,
    level: lead.level,
    xp: 0,
    life: lead.stats.hp,
    stats: { ...lead.stats },
    talents: lead.talents ?? [],
    healStart: null,
  };
}
