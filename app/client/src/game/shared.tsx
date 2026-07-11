// Petits composants partagés entre GamePage, House et l'Éditeur d'espèces.
// Règle absolue du projet : les sprites ne s'affichent JAMAIS en grand — toujours
// miniature/petit format (voir game.css : toute image de sprite est plafonnée).

import { currentLife, isHealing } from "./engine/progression";
import type { Character, Stats } from "./engine/types";

export function StatRow({ stats }: { stats: Stats }) {
  return (
    <div className="statgrid">
      <span>❤️ {stats.hp}</span><span>⚔️ {stats.atk}</span><span>🛡️ {stats.def}</span><span>💨 {stats.spd}</span><span>⚡ {stats.sta}</span>
    </div>
  );
}

export function HpBar({ c }: { c: Character }) {
  const life = currentLife(c);
  const pct = Math.round((life / c.stats.hp) * 100);
  const healing = isHealing(c);
  return (
    <div className="hpline">
      <div className={`hpbar sm ${healing ? "healing" : ""}`}><div className="hpbar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="hp-num sm">{Math.round(life)}/{c.stats.hp}{healing ? " 💚" : ""}</span>
    </div>
  );
}
