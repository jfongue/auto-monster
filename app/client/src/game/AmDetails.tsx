// AmDetails — panneau réutilisable de la fiche d'un AM (caractéristiques, talents,
// spécialisation, soins, interactions, description d'espèce, historique).
// Extrait de AmPage pour être partagé entre la fiche plein écran (modal, depuis
// l'équipe/inventaire) et le focus in-place de la House (T002).

import { useEffect, useState } from "react";
import {
  SPECIES,
  INTERACT_LABELS,
  FULL_HEAL_COST,
  branchesOf,
  branchDef,
  activeTalents,
  BRANCH_CHOICE_LEVEL,
} from "./engine/data";
import {
  xpForNext,
  isFull,
  isHealing,
  healEtaMs,
  moodLabel,
  interactReadyIn,
} from "./engine/progression";
import { TALENTS } from "./engine/talents";
import { HpBar, TalentList, talentTooltip } from "./shared";
import { Icon, type IconName } from "./icons";
import type { Character, StatKey, InteractKind } from "./engine/types";

export const STAT_LABELS: Record<StatKey, { icon: IconName; label: string }> = {
  hp: { icon: "hp", label: "Vie" },
  atk: { icon: "atk", label: "Force" },
  def: { icon: "def", label: "Armure" },
  spd: { icon: "spd", label: "Vitesse" },
};

export const HIST_ICON: Record<string, string> = { capture: "⭐", combat: "⚔️", interact: "💞", levelup: "🆙" };

export function fmtDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function HealControls({ c, gold, potions, onToggleHeal, onPotion, onFull }: {
  c: Character; gold: number; potions: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
}) {
  const full = isFull(c);
  const healing = isHealing(c);
  const eta = healing ? Math.ceil(healEtaMs(c) / 1000) : 0;
  return (
    <div className="heal-row">
      <button className="chip-ico" disabled={full} onClick={() => onToggleHeal(c.id)} title={healing ? "Stopper le soin" : "Soin progressif gratuit"}>{healing ? <><Icon name="pause" size={14} /> {eta}s</> : <><Icon name="heal" size={14} /> Soin</>}</button>
      <button className="chip-ico" disabled={potions <= 0 || full} onClick={() => onPotion(c.id)} title="Utiliser une potion (+50% PV)"><Icon name="potion" size={14} /> {potions}</button>
      <button className="chip-ico" disabled={gold < FULL_HEAL_COST || full} onClick={() => onFull(c.id)} title={`Soin complet — ${FULL_HEAL_COST} or`}><Icon name="gold" size={14} /> {FULL_HEAL_COST}</button>
    </div>
  );
}

export function TalentChips({ c }: { c: Character }) {
  const sp = SPECIES[c.speciesId];
  const ids = [sp.innate, ...activeTalents(c)].filter(Boolean) as string[];
  // dédoublonne (l'inné peut réapparaître dans une branche)
  return <TalentList ids={[...new Set(ids)]} />;
}

/** Bloc « Spécialisation » de la fiche : branche choisie, ou invitation à choisir. */
export function BranchBlock({ c, onChoose }: { c: Character; onChoose: () => void }) {
  const branches = branchesOf(c.speciesId);
  if (branches.length === 0) return null;
  const chosen = branchDef(c.speciesId, c.branch);
  return (
    <div className="branch-block">
      <h4 className="block-title">Spécialisation</h4>
      {chosen ? (
        <div className="branch-current">
          <div className="branch-head"><span className="branch-ico">{chosen.icon}</span> <b>{chosen.name}</b></div>
          <p className="muted small">{chosen.desc}</p>
          <div className="branch-tiers">
            {chosen.tiers.map((t) => {
              const unlocked = c.level >= t.level;
              const td = TALENTS[t.talent];
              return (
                <span key={t.talent} className={`branch-tier ${unlocked ? "on" : "off"}`} title={talentTooltip(t.talent)}>
                  {unlocked ? "✓" : `N.${t.level}`} {td?.icon} {td?.name}
                </span>
              );
            })}
          </div>
        </div>
      ) : c.level >= BRANCH_CHOICE_LEVEL ? (
        <button className="primary sm" onClick={onChoose}>⚡ Choisir une spécialisation</button>
      ) : (
        <p className="muted small">Choix de spécialisation débloqué au niveau {BRANCH_CHOICE_LEVEL} (2 voies au choix).</p>
      )}
    </div>
  );
}

export function InteractButtons({ c, onInteract }: { c: Character; onInteract: (id: string, k: InteractKind) => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const kinds = Object.keys(INTERACT_LABELS) as InteractKind[];
  const lastText = c.history?.find((h) => h.kind === "interact")?.text;
  return (
    <div className="interact-block">
      <h4 className="block-title">Interagir</h4>
      <div className="interact-grid">
        {kinds.map((k) => {
          const ready = interactReadyIn(c, k);
          const meta = INTERACT_LABELS[k];
          return (
            <button key={k} className="interact-btn" disabled={ready > 0} onClick={() => onInteract(c.id, k)} title={meta.hint}>
              <span className="interact-emoji">{meta.emoji}</span>
              <span>{meta.name}</span>
              <span className="muted small">{ready > 0 ? `${Math.ceil(ready / 1000)}s` : meta.hint}</span>
            </button>
          );
        })}
      </div>
      {lastText && <p className="interact-last">« {lastText} »</p>}
    </div>
  );
}

/** Bloc d'identité (nom, niveau, espèce, trait, humeur, PV, XP). Sans l'art :
 *  l'art est fourni par le contexte (fiche modale ou compagnon de la House). */
export function AmHeroInfo({ c, rentedFights }: { c: Character; rentedFights?: number }) {
  const sp = SPECIES[c.speciesId];
  const xpNext = xpForNext(c.level);
  const p = c.personality;
  return (
    <div className="am-hero-info">
      <div className="team-name big">
        {c.name} <span className="lvl">N.{c.level}</span>
        {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
        {rentedFights != null && <span className="rent-tag">loué · {rentedFights}c</span>}
      </div>
      <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
      {p && <div className="am-trait">{p.emoji} {p.archetype}</div>}
      <div className="am-mood">Humeur : <strong>{moodLabel(c)}</strong></div>
      <HpBar c={c} />
      <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
      <div className="muted small">XP {c.xp}/{xpNext}</div>
    </div>
  );
}

/** Colonnes de la fiche : caractéristiques/talents/spécialisation/soins/interactions
 *  d'un côté, description d'espèce + historique de l'autre. Réutilisable. */
export function AmDetails({ c, gold, potions, onToggleHeal, onPotion, onFull, onInteract, onChooseBranch }: {
  c: Character; gold: number; potions: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onInteract: (id: string, k: InteractKind) => void; onChooseBranch: () => void;
}) {
  const sp = SPECIES[c.speciesId];
  return (
    <div className="am-cols">
      <div className="am-col">
        <h4 className="block-title">Caractéristiques</h4>
        <div className="sheet-stats">
          {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
            <div key={k} className="sheet-stat"><span className="chip-ico"><Icon name={STAT_LABELS[k].icon} size={15} /> {STAT_LABELS[k].label}</span><strong>{c.stats[k]}</strong></div>
          ))}
        </div>
        <TalentChips c={c} />
        <BranchBlock c={c} onChoose={onChooseBranch} />
        <h4 className="block-title">Soins</h4>
        <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
        <InteractButtons c={c} onInteract={onInteract} />
      </div>

      <div className="am-col">
        <h4 className="block-title">Espèce</h4>
        <p className="am-species-desc">{sp.desc}</p>
        <h4 className="block-title">Historique</h4>
        <div className="am-history">
          {(c.history ?? []).length === 0 && <p className="muted small">Aucun évènement pour l'instant.</p>}
          {(c.history ?? []).map((h, i) => (
            <div key={i} className="hist-row">
              <span className="hist-icon">{HIST_ICON[h.kind] ?? "•"}</span>
              <span className="hist-text">{h.text}</span>
              <span className="hist-date muted small">{fmtDate(h.t)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
