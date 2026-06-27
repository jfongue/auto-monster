// F6 — Talents implémentés en hooks. Ajouter un talent = une entrée ici,
// sans toucher la boucle de combat.

import type { Fighter } from "./types";

export type TalentCategory = "offensif" | "défensif" | "utilitaire";

export type TalentDef = {
  id: string;
  name: string;
  category: TalentCategory;
  desc: string;
  /** appliqué à l'init du Fighter : mute le fighter / enregistre des hooks */
  apply: (f: Fighter) => void;
};

export const TALENTS: Record<string, TalentDef> = {
  // ── Offensifs ──────────────────────────────────────────────────────────
  ember: {
    id: "ember",
    name: "Braise",
    category: "offensif",
    desc: "+20% de puissance d'attaque.",
    apply: (f) => {
      f.atkBonus += Math.round(f.atk * 0.2);
    },
  },
  frenzy: {
    id: "frenzy",
    name: "Frénésie",
    category: "offensif",
    desc: "1 attaque sur 4 frappe 60% plus fort.",
    apply: (f) => {
      f.hooks.afterAttack.push(() => {}); // marqueur (proba gérée au combat via talents)
      // le proc est lu dans resolveAttack via la présence du talent
    },
  },

  // ── Défensifs ──────────────────────────────────────────────────────────
  stoneskin: {
    id: "stoneskin",
    name: "Peau de pierre",
    category: "défensif",
    desc: "Réduit de 15% les dégâts reçus.",
    apply: (f) => {
      f.hooks.defenses.push((info) => {
        info.damage = Math.max(1, Math.round(info.damage * 0.85));
      });
    },
  },
  thorns: {
    id: "thorns",
    name: "Épines",
    category: "défensif",
    desc: "Renvoie 25% des dégâts reçus à l'attaquant.",
    apply: (f) => {
      f.hooks.defenses.push((info) => {
        const reflect = Math.max(1, Math.round(info.damage * 0.25));
        info.attacker.life = Math.max(0, info.attacker.life - reflect);
      });
    },
  },

  // ── Utilitaires ────────────────────────────────────────────────────────
  swift: {
    id: "swift",
    name: "Vivacité",
    category: "utilitaire",
    desc: "Agit 15% plus souvent.",
    apply: (f) => {
      f.timeMultiplier *= 0.85;
    },
  },
  regen: {
    id: "regen",
    name: "Régénération",
    category: "utilitaire",
    desc: "Récupère 4% des PV max à chaque tour.",
    apply: (f) => {
      f.hooks.onTurn.push((self, mgr) => {
        if (self.life <= 0 || self.life >= self.maxLife) return;
        const heal = Math.max(1, Math.round(self.maxLife * 0.04));
        self.life = Math.min(self.maxLife, self.life + heal);
        mgr.emit({ t: "regen", fid: self.fid, life: self.life });
      });
    },
  },
};

export function talentName(id: string): string {
  return TALENTS[id]?.name ?? id;
}
