// AmDetails — panneau réutilisable de la fiche d'un AM (caractéristiques, talents,
// spécialisation, soins, interactions, description d'espèce, historique).
// Extrait de AmPage pour être partagé entre la fiche plein écran (modal, depuis
// l'équipe/inventaire) et le focus in-place de la House (T002).

import { useEffect, useState } from "react";
import {
  SPECIES,
  INTERACT_LABELS,
  TOY_LABEL,
  FULL_HEAL_COST,
  activeTalents,
} from "./engine/data";
import {
  xpForNext,
  isFull,
  isHealing,
  healEtaMs,
  moodLabel,
  socialOf,
  socialLabel,
  interactReadyIn,
  DEFAULT_RANK,
  DEFAULT_STAMINA,
} from "./engine/progression";
import { ACTIVE_TRAITS, PASSIVE_TRAITS } from "./engine/traits";
import { HpBar, TalentList } from "./shared";
import { Icon } from "./icons";
import type { Character, InteractKind } from "./engine/types";

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

/** Bloc « Traits » de la fiche (T008) : les 3 Traits actifs + le passif équipés, niveau 1-3. */
export function TraitBlock({ c }: { c: Character }) {
  const actives = c.activeTraits ?? [];
  const slots = [0, 1, 2];
  return (
    <div className="branch-block">
      <h4 className="block-title">Traits équipés</h4>
      <div className="editor-traits-chips">
        {slots.map((i) => {
          const t = actives[i];
          const def = t ? ACTIVE_TRAITS[t.id] : null;
          return (
            <span key={i} className={`talent-mini cat-offensif ${def ? "on" : ""}`}>
              {def ? `${def.icon} ${def.name} · N.${t!.level}` : "— slot libre —"}
            </span>
          );
        })}
        <span className={`talent-mini cat-utilitaire ${c.passiveTrait ? "on" : ""}`}>
          {c.passiveTrait ? `${PASSIVE_TRAITS[c.passiveTrait.id]?.icon} ${PASSIVE_TRAITS[c.passiveTrait.id]?.name} · N.${c.passiveTrait.level}` : "— passif libre —"}
        </span>
      </div>
      {(c.traitPoints ?? 0) > 0 && <p className="muted small">🆙 {c.traitPoints} choix de Trait en attente.</p>}
    </div>
  );
}

export function InteractButtons({ c, toys, onInteract, onToy }: {
  c: Character; toys: number; onInteract: (id: string, k: InteractKind) => void; onToy: (id: string) => void;
}) {
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
        <button className="interact-btn" disabled={toys <= 0} onClick={() => onToy(c.id)} title={TOY_LABEL.hint}>
          <span className="interact-emoji">{TOY_LABEL.emoji}</span>
          <span>{TOY_LABEL.name}</span>
          <span className="muted small">{toys > 0 ? `${toys} en stock` : "aucun jouet"}</span>
        </button>
      </div>
      {lastText && <p className="interact-last">« {lastText} »</p>}
    </div>
  );
}

/** Bloc d'identité (nom, niveau, espèce, trait, humeur, PV, XP). Sans l'art :
 *  l'art est fourni par le contexte (fiche modale ou compagnon de la House).
 *  Le nom (surnom) est éditable via `onRename` ; l'espèce reste toujours affichée
 *  séparément juste en-dessous, quel que soit le surnom choisi. */
export function AmHeroInfo({ c, rentedFights, onRename }: { c: Character; rentedFights?: number; onRename?: (name: string) => void }) {
  const sp = SPECIES[c.speciesId];
  const xpNext = xpForNext(c.level);
  const p = c.personality;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.name);

  useEffect(() => { setDraft(c.name); }, [c.name, c.id]);

  function commit() {
    const trimmed = draft.trim().slice(0, 18);
    if (onRename && trimmed && trimmed !== c.name) onRename(trimmed);
    else setDraft(c.name);
    setEditing(false);
  }
  function cancel() {
    setDraft(c.name);
    setEditing(false);
  }

  return (
    <div className="am-hero-info">
      <div className="team-name big">
        {editing ? (
          <input
            className="am-name-input"
            value={draft}
            autoFocus
            maxLength={18}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
          />
        ) : (
          <>
            {c.name} <span className="lvl">N.{c.level}</span>
            {onRename && (
              <button
                type="button"
                className="am-rename-btn"
                onClick={() => setEditing(true)}
                aria-label="Renommer"
                title="Renommer"
              >
                <Icon name="edit" size={13} />
              </button>
            )}
          </>
        )}
        {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
        {rentedFights != null && <span className="rent-tag">loué · {rentedFights}c</span>}
      </div>
      <div className="muted small">{sp.name} · {sp.kind === "automonster" ? "Auto Monster" : "Bestiole"}</div>
      {p && <div className="am-trait">{p.emoji} {p.archetype}</div>}
      <div className="am-mood">Humeur : <strong>{moodLabel(c)}</strong></div>
      <div className="am-mood">
        Lien : <strong>{socialLabel(c)}</strong>
        <div className="socialbar"><div className="socialbar-fill" style={{ width: `${socialOf(c)}%` }} /></div>
      </div>
      <HpBar c={c} />
      <div className="xpbar"><div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} /></div>
      <div className="muted small">XP {c.xp}/{xpNext}</div>
    </div>
  );
}

/** Colonnes de la fiche : caractéristiques/talents/spécialisation/soins/interactions
 *  d'un côté, description d'espèce + historique de l'autre. Réutilisable. */
export function AmDetails({ c, gold, potions, toys, onToggleHeal, onPotion, onFull, onInteract, onToy }: {
  c: Character; gold: number; potions: number; toys: number;
  onToggleHeal: (id: string) => void; onPotion: (id: string) => void; onFull: (id: string) => void;
  onInteract: (id: string, k: InteractKind) => void; onToy: (id: string) => void;
}) {
  const sp = SPECIES[c.speciesId];
  return (
    <div className="am-cols">
      <div className="am-col">
        <h4 className="block-title">Caractéristiques</h4>
        <div className="sheet-stats">
          <div className="sheet-stat"><span className="chip-ico"><Icon name="rank" size={15} /> Rang</span><strong>{sp.rank ?? DEFAULT_RANK}</strong></div>
          <div className="sheet-stat"><span className="chip-ico"><Icon name="hp" size={15} /> HP</span><strong>{c.stats.hp}</strong></div>
          <div className="sheet-stat"><span className="chip-ico"><Icon name="stamina" size={15} /> Stamina</span><strong>{sp.baseStamina ?? c.stamina ?? DEFAULT_STAMINA}</strong></div>
        </div>
        <TraitBlock c={c} />
        <h4 className="block-title">Soins</h4>
        <HealControls c={c} gold={gold} potions={potions} onToggleHeal={onToggleHeal} onPotion={onPotion} onFull={onFull} />
        <InteractButtons c={c} toys={toys} onInteract={onInteract} onToy={onToy} />
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
