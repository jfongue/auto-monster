// Éditeur d'espèces — outil de dev accessible depuis le menu ☰. Permet
// d'ajuster nom / stats / rareté / disponibilité en combat PvE sauvage (Forêt)
// pour chaque espèce (existante ou fraîchement importée depuis les planches).
// Persisté globalement via /api/species-overrides (partagé par toutes les parties).
//
// Règle absolue : les vignettes restent minuscules ici aussi (48px).

import { useMemo, useState } from "react";
import { SPECIES, applySpeciesOverrides } from "./engine/data";
import { api } from "../lib/api";
import type { Rarity, SpeciesDef, Stats } from "./engine/types";

type Row = {
  name: string;
  stats: Stats;
  rarity: Rarity;
  wildEncounterable: boolean;
  kind: SpeciesDef["kind"];
};

function toRow(sp: SpeciesDef): Row {
  return { name: sp.name, stats: { ...sp.baseStats }, rarity: sp.rarity, wildEncounterable: sp.wildEncounterable, kind: sp.kind };
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, fn: (r: Row) => Row) {
    setRows((prev) => ({ ...prev, [id]: fn(prev[id]) }));
    setDirty((prev) => new Set(prev).add(id));
    setSaved(false);
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
        overrides[id] = { name: r.name, baseStats: r.stats, rarity: r.rarity, wildEncounterable: r.wildEncounterable, kind: r.kind };
      }
      if (Object.keys(overrides).length > 0) {
        await api.saveSpeciesOverrides(overrides);
        applySpeciesOverrides(overrides);
      }
      setSaved(true);
      setDirty(new Set());
      // recharge pour que tout l'app (House, Forêt, bestiaire…) reflète les nouveaux noms/stats.
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
        <div className="am-page-title">🧬 Éditeur d'espèces</div>
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
              <button
                key={k}
                className={kindFilter === k ? "on" : ""}
                onClick={() => setKindFilter(k)}
              >
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
            <span>❤️</span>
            <span>⚔️</span>
            <span>🛡️</span>
            <span>💨</span>
            <span>Rareté</span>
            <span>Type</span>
            <span>PvE sauvage</span>
          </div>
          {filtered.map((id) => {
            const sp = SPECIES[id];
            const r = rows[id];
            const isDirty = dirty.has(id);
            return (
              <div key={id} className={`editor-row ${isDirty ? "dirty" : ""}`}>
                <span className="editor-thumb"><img src={`/sprites/${sp.gfx}.png`} alt={id} /></span>
                <input
                  className="editor-name"
                  value={r.name}
                  onChange={(e) => patch(id, (row) => ({ ...row, name: e.target.value }))}
                />
                {(["hp", "atk", "def", "spd"] as const).map((k) => (
                  <input
                    key={k}
                    type="number"
                    className="editor-stat"
                    value={r.stats[k]}
                    onChange={(e) =>
                      patch(id, (row) => ({ ...row, stats: { ...row.stats, [k]: Number(e.target.value) || 0 } }))
                    }
                  />
                ))}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
