// Petits composants partagés entre GamePage, House et l'Éditeur d'espèces.
// Règle absolue du projet : les sprites ne s'affichent JAMAIS en grand — toujours
// miniature/petit format (voir game.css : toute image de sprite est plafonnée).

import { currentLife, isHealing } from "./engine/progression";
import type { Character, Stats } from "./engine/types";
import { TALENTS, CATEGORY_LABEL } from "./engine/talents";

// Valeurs de référence pour remplir les barres (0–100 %). Un peu au-dessus des
// stats typiques d'un AM pour que les barres restent lisibles sans saturer.
const STAT_REF: Record<keyof Stats, number> = { hp: 120, atk: 35, def: 30, spd: 60 };
const STAT_META: { key: keyof Stats; icon: string; label: string }[] = [
  { key: "hp", icon: "❤️", label: "Vie" },
  { key: "atk", icon: "⚔️", label: "Force" },
  { key: "def", icon: "🛡️", label: "Armure" },
  { key: "spd", icon: "💨", label: "Vitesse" },
];

/** Tag de rôle déduit des stats, pour lire l'archétype d'un coup d'œil. */
export function roleOf(stats: Stats): string {
  const n = {
    hp: stats.hp / STAT_REF.hp,
    atk: stats.atk / STAT_REF.atk,
    def: stats.def / STAT_REF.def,
    spd: stats.spd / STAT_REF.spd,
  };
  const tank = (n.hp + n.def) / 2;
  if (n.spd >= 0.7 && n.spd >= n.atk && n.spd >= tank) return "💨 Rapide";
  if (n.atk >= 0.6 && n.atk >= tank) return "⚔️ Cogneur";
  if (tank >= 0.6 && tank >= n.atk) return "🛡️ Tank";
  return "⚖️ Polyvalent";
}

/** Barres de stats étiquetées + tag de rôle (remplace l'ancien affichage brut). */
export function StatRow({ stats, role = true }: { stats: Stats; role?: boolean }) {
  return (
    <div className="statbars">
      {role && <div className="stat-role">{roleOf(stats)}</div>}
      {STAT_META.map(({ key, icon, label }) => {
        const pct = Math.min(100, Math.round((stats[key] / STAT_REF[key]) * 100));
        return (
          <div key={key} className="statbar" title={`${label} : ${stats[key]}`}>
            <span className="statbar-ico">{icon}</span>
            <span className="statbar-track"><span className={`statbar-fill s-${key}`} style={{ width: `${pct}%` }} /></span>
            <span className="statbar-val">{stats[key]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Infobulle riche et homogène pour un talent (icône · catégorie — effet). */
export function talentTooltip(id: string): string {
  const t = TALENTS[id];
  if (!t) return id;
  return `${t.icon} ${t.name} · ${CATEGORY_LABEL[t.category]}\n${t.desc}`;
}

/** Liste de talents avec icône + infobulle explicative (fiche AM). */
export function TalentList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="talents-line">
      {ids.map((id) => {
        const t = TALENTS[id];
        return (
          <span key={id} className={`talent-mini cat-${t?.category ?? ""}`} title={talentTooltip(id)}>
            {t?.icon ?? "✨"} {t?.name ?? id}
          </span>
        );
      })}
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
