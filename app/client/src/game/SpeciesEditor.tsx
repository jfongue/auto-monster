// Éditeur de bestiaire — outil de dev accessible depuis le menu ☰. Permet
// d'ajuster, par espèce : Rang / HP de base / Stamina de base, le pool de
// Traits (actifs + passifs, T006) piochables/améliorables par l'espèce, son
// Trait de départ, la rareté et la disponibilité en combat PvE sauvage.
// T004 — remplace l'ancien éditeur (HP/atk/def/spd, retirés du nouveau modèle,
// voir T007). Persisté globalement via /api/species-overrides (déjà générique :
// stocke un patch JSON quelconque par espèce, aucun changement serveur requis).
//
// Règle absolue : les vignettes restent minuscules ici aussi (48px).

import { useMemo, useState } from "react";
import { SPECIES, applySpeciesOverrides } from "./engine/data";
import { kitFor } from "./engine/live";
import { ACTIVE_TRAITS, PASSIVE_TRAITS } from "./engine/traits";
import { DEFAULT_RANK, DEFAULT_STAMINA } from "./engine/progression";
import { api } from "../lib/api";
import type { Rarity, SpeciesDef } from "./engine/types";

const ACTIVE_IDS = Object.keys(ACTIVE_TRAITS);
const PASSIVE_IDS = Object.keys(PASSIVE_TRAITS);

type Row = {
  name: string;
  rank: number;
  baseHp: number;
  baseStamina: number;
  rarity: Rarity;
  wildEncounterable: boolean;
  kind: SpeciesDef["kind"];
  traitPool: string[]; // ids ACTIVE_TRAITS + PASSIVE_TRAITS mélangés
  startTrait: string; // id ACTIVE_TRAITS
};

/** Pool par défaut d'une espèce sans override T004 : son kit LIVE actuel (actifs) + son talentPool (passifs, ids déjà compatibles). */
function defaultPool(sp: SpeciesDef): string[] {
  const kit = kitFor(sp.id);
  const actives = kit.actions.map((m) => m.id);
  const passives = (sp.talentPool ?? []).filter((id) => !!PASSIVE_TRAITS[id]);
  const innate = sp.innate && PASSIVE_TRAITS[sp.innate] ? [sp.innate] : [];
  return Array.from(new Set([...actives, ...passives, ...innate]));
}

/** Trait de départ par défaut : la première attaque du kit actuel de l'espèce. */
function defaultStart(sp: SpeciesDef): string {
  const kit = kitFor(sp.id);
  return kit.actions.find((m) => m.kind === "atk")?.id ?? kit.actions[0].id;
}

function toRow(sp: SpeciesDef): Row {
  return {
    name: sp.name,
    rank: sp.rank ?? DEFAULT_RANK,
    baseHp: sp.baseHp ?? sp.baseStats.hp,
    baseStamina: sp.baseStamina ?? DEFAULT_STAMINA,
    rarity: sp.rarity,
    wildEncounterable: sp.wildEncounterable,
    kind: sp.kind,
    traitPool: sp.traitPool ?? defaultPool(sp),
    startTrait: sp.startTrait ?? defaultStart(sp),
  };
}

export default function SpeciesEditor({ onClose }: { onClose: () => void }) {
  const allIds = useMemo(() => Object.keys(SPECIES), []);
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const r: Record<string, Row> = {};
    for (const id of allIds) r[id] = toRow(SPECIES[id]);
    return r;
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "automonster" | "bestiole">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, fn: (r: Row) => Row) {
    setRows((prev) => ({ ...prev, [id]: fn(prev[id]) }));
    setDirty((prev) => new Set(prev).add(id));
    setSaved(false);
  }

  function toggleTrait(id: string, traitId: string) {
    patch(id, (row) => {
      const has = row.traitPool.includes(traitId);
      const traitPool = has ? row.traitPool.filter((t) => t !== traitId) : [...row.traitPool, traitId];
      // le Trait de départ doit rester dans le pool actif sélectionné
      const activeInPool = traitPool.filter((t) => ACTIVE_TRAITS[t]);
      const startTrait = activeInPool.includes(row.startTrait) ? row.startTrait : activeInPool[0] ?? row.startTrait;
      return { ...row, traitPool, startTrait };
    });
  }

  const filtered = allIds.filter((id) => {
    const sp = SPECIES[id];
    if (kindFilter !== "all" && sp.kind !== kindFilter) return false;
    if (q && !sp.name.toLowerCase().includes(q.toLowerCase()) && !id.includes(q.toLowerCase())) return false;
    return true;
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const overrides: Record<string, Partial<SpeciesDef>> = {};
      for (const id of dirty) {
        const r = rows[id];
        overrides[id] = {
          name: r.name,
          rarity: r.rarity,
          wildEncounterable: r.wildEncounterable,
          kind: r.kind,
          rank: r.rank,
          baseHp: r.baseHp,
          baseStamina: r.baseStamina,
          traitPool: r.traitPool,
          startTrait: r.startTrait,
        };
      }
      if (Object.keys(overrides).length > 0) {
        await api.saveSpeciesOverrides(overrides);
        applySpeciesOverrides(overrides);
      }
      setSaved(true);
      setDirty(new Set());
      // recharge pour que tout l'app (House, Forêt, bestiaire…) reflète les nouvelles valeurs.
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="am-page species-editor">
      <header className="am-page-top">
        <button className="ghost sm" onClick={onClose}>← Retour</button>
        <div className="am-page-title">🧬 Éditeur de bestiaire</div>
        <button className="primary sm" disabled={dirty.size === 0 || saving} onClick={save}>
          {saving ? "…" : saved ? "✓ Enregistré" : `Enregistrer${dirty.size ? ` (${dirty.size})` : ""}`}
        </button>
      </header>

      <div className="am-page-body">
        {error && <p className="warn">{error}</p>}
        <div className="editor-toolbar">
          <input
            className="editor-search"
            placeholder="Rechercher une espèce…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="editor-filters">
            {(["all", "automonster", "bestiole"] as const).map((k) => (
              <button key={k} className={kindFilter === k ? "on" : ""} onClick={() => setKindFilter(k)}>
                {k === "all" ? "Toutes" : k === "automonster" ? "Auto Monsters" : "Bestioles"}
              </button>
            ))}
          </div>
          <p className="muted small">
            {filtered.length} espèce(s) · <strong>{dirty.size}</strong> modification(s) non enregistrée(s)
          </p>
        </div>

        <div className="editor-table">
          <div className="editor-row editor-head">
            <span></span>
            <span>Nom</span>
            <span>🏅 Rang</span>
            <span>❤️ HP</span>
            <span>⚡ Stamina</span>
            <span>Rareté</span>
            <span>Type</span>
            <span>PvE</span>
            <span>Traits</span>
          </div>
          {filtered.map((id) => {
            const sp = SPECIES[id];
            const r = rows[id];
            const isDirty = dirty.has(id);
            const isOpen = expanded === id;
            return (
              <div key={id} className="editor-row-group">
                <div className={`editor-row ${isDirty ? "dirty" : ""}`}>
                  <span className="editor-thumb"><img src={`/sprites/${sp.gfx}.png`} alt={id} /></span>
                  <input
                    className="editor-name"
                    value={r.name}
                    onChange={(e) => patch(id, (row) => ({ ...row, name: e.target.value }))}
                  />
                  <input
                    type="number" min={1} max={5}
                    className="editor-stat"
                    value={r.rank}
                    onChange={(e) => patch(id, (row) => ({ ...row, rank: Math.max(1, Math.min(5, Number(e.target.value) || 1)) }))}
                  />
                  <input
                    type="number" min={1}
                    className="editor-stat"
                    value={r.baseHp}
                    onChange={(e) => patch(id, (row) => ({ ...row, baseHp: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                  <input
                    type="number" min={1}
                    className="editor-stat"
                    value={r.baseStamina}
                    onChange={(e) => patch(id, (row) => ({ ...row, baseStamina: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                  <select
                    className="editor-rarity"
                    value={r.rarity}
                    onChange={(e) => patch(id, (row) => ({ ...row, rarity: e.target.value as Rarity }))}
                  >
                    <option value="common">common</option>
                    <option value="rare">rare</option>
                    <option value="boss">boss</option>
                  </select>
                  <select
                    className="editor-kind"
                    value={r.kind}
                    onChange={(e) => patch(id, (row) => ({ ...row, kind: e.target.value as SpeciesDef["kind"] }))}
                  >
                    <option value="automonster">Auto Monster</option>
                    <option value="bestiole">Monstre</option>
                  </select>
                  <input
                    type="checkbox"
                    checked={r.wildEncounterable}
                    onChange={(e) => patch(id, (row) => ({ ...row, wildEncounterable: e.target.checked }))}
                  />
                  <button className="ghost sm editor-traits-toggle" onClick={() => setExpanded(isOpen ? null : id)}>
                    {r.traitPool.length} {isOpen ? "▴" : "▾"}
                  </button>
                </div>

                {isOpen && (
                  <div className="editor-traits-panel">
                    <div className="editor-traits-col">
                      <div className="editor-traits-label">Traits actifs</div>
                      <div className="editor-traits-chips">
                        {ACTIVE_IDS.map((tid) => {
                          const def = ACTIVE_TRAITS[tid];
                          const on = r.traitPool.includes(tid);
                          return (
                            <button
                              key={tid}
                              className={`talent-mini cat-offensif ${on ? "on" : ""}`}
                              title={`${def.icon} ${def.name}`}
                              onClick={() => toggleTrait(id, tid)}
                            >
                              {def.icon} {def.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="editor-traits-col">
                      <div className="editor-traits-label">Traits passifs</div>
                      <div className="editor-traits-chips">
                        {PASSIVE_IDS.map((tid) => {
                          const def = PASSIVE_TRAITS[tid];
                          const on = r.traitPool.includes(tid);
                          return (
                            <button
                              key={tid}
                              className={`talent-mini cat-utilitaire ${on ? "on" : ""}`}
                              title={`${def.icon} ${def.name}`}
                              onClick={() => toggleTrait(id, tid)}
                            >
                              {def.icon} {def.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="editor-traits-col">
                      <div className="editor-traits-label">Trait de départ (niv. 1)</div>
                      <select
                        className="editor-kind"
                        value={r.startTrait}
                        onChange={(e) => patch(id, (row) => ({ ...row, startTrait: e.target.value }))}
                      >
                        {r.traitPool.filter((t) => ACTIVE_TRAITS[t]).map((tid) => (
                          <option key={tid} value={tid}>{ACTIVE_TRAITS[tid].icon} {ACTIVE_TRAITS[tid].name}</option>
                        ))}
                      </select>
                      {r.traitPool.filter((t) => ACTIVE_TRAITS[t]).length === 0 && (
                        <p className="muted small">Sélectionne au moins un Trait actif pour choisir un départ.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
