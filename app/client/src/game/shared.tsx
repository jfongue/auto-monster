// Petits composants partagés entre GamePage, House et l'Éditeur d'espèces.
// Règle absolue du projet : les sprites ne s'affichent JAMAIS en grand — toujours
// miniature/petit format (voir game.css : toute image de sprite est plafonnée).

import { currentLife, isHealing, DEFAULT_RANK, DEFAULT_STAMINA } from "./engine/progression";
import type { Character } from "./engine/types";
import { TALENTS, CATEGORY_LABEL } from "./engine/talents";
import { Icon } from "./icons";

/** Ligne compacte Rang/HP/Stamina d'un AM (T007/T008 : remplace l'ancien
 *  StatRow atk/def/spd, retiré partout où il restait affiché — carte starter,
 *  liste d'équipe, révélation de capture). */
export function RankStatLine({ c }: { c: Character }) {
  return (
    <div className="statgrid">
      <span>🏅 {c.rank ?? DEFAULT_RANK}</span>
      <span className="chip-ico"><Icon name="hp" size={12} /> {c.stats.hp}</span>
      <span>⚡ {c.stamina ?? DEFAULT_STAMINA}</span>
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
      <span className="hp-num sm">{Math.round(life)}/{c.stats.hp}{healing && <Icon name="heal" size={11} className="hp-heal-ico" />}</span>
    </div>
  );
}
