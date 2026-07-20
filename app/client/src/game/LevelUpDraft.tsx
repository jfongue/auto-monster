// LevelUpDraft — modal de choix de Traits à la montée de niveau (T008).
// Remplace le choix de branche (retiré du flow de jeu réel, cf GDD v0.53) :
// à chaque niveau gagné, propose 2-3 cartes (améliorer un Trait possédé, ou en
// acquérir un nouveau du pool de l'espèce). Peut réapparaître plusieurs fois de
// suite si le Character a gagné plusieurs niveaux d'un coup (traitPoints > 1).

import { useMemo } from "react";
import { SPECIES } from "./engine/data";
import { generateDraft, draftLabel, type DraftOption } from "./engine/draft";
import { makeRng } from "./engine/rng";
import type { Character } from "./engine/types";

export default function LevelUpDraft({ c, onPick }: { c: Character; onPick: (choice: DraftOption) => void }) {
  const sp = SPECIES[c.speciesId];
  // seed dérivé de l'état du Character : un tirage stable par palier de traitPoints restant,
  // mais différent d'un niveau à l'autre (traitPoints décroît à chaque choix appliqué).
  const seed = useMemo(() => c.level * 1000 + (c.traitPoints ?? 0) * 37 + (c.activeTraits?.length ?? 0), [c.level, c.traitPoints, c.activeTraits?.length]);
  const options = useMemo(() => generateDraft(c, sp, makeRng(seed)), [c, sp, seed]);

  return (
    <div className="overlay">
      <div className="modal levelup" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="levelup-title">🆙 {c.name} monte de niveau !</h3>
        <p className="muted levelup-sub">Choisis un Trait — Niveau {c.level}{(c.traitPoints ?? 0) > 1 && ` · encore ${c.traitPoints! - 1} choix après celui-ci`}</p>
        <div className="branch-choices">
          {options.length === 0 && <p className="muted small">Plus aucune option disponible pour l'instant (pool épuisé).</p>}
          {options.map((o) => {
            const label = draftLabel(o);
            return (
              <button key={`${o.kind}-${o.id}`} className="branch-choice" onClick={() => onPick(o)}>
                <div className="branch-head"><span className="branch-ico">{label.icon}</span> <b>{label.name}</b></div>
                <p className="muted small">{label.kindLabel}</p>
                <p className="branch-desc">{label.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
