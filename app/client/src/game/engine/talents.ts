// F6 — Talents implémentés en hooks. Ajouter un talent = une entrée ici,
// sans toucher la boucle de combat.

import type { Fighter } from "./types";

export type TalentCategory = "offensif" | "défensif" | "utilitaire";

export type TalentDef = {
  id: string;
  name: string;
  icon: string; // emoji affiché partout (fiche, infobulle, label de combat)
  category: TalentCategory;
  /** phrase courte et claire, montrée en infobulle (GDD v0.20). */
  desc: string;
  /** appliqué à l'init du Fighter : mute le fighter / enregistre des hooks */
  apply: (f: Fighter) => void;
};

export const CATEGORY_LABEL: Record<TalentCategory, string> = {
  offensif: "Offensif",
  défensif: "Défensif",
  utilitaire: "Utilitaire",
};

export const TALENTS: Record<string, TalentDef> = {
  // ── Offensifs ──────────────────────────────────────────────────────────
  ember: {
    id: "ember",
    name: "Braise",
    icon: "🔥",
    category: "offensif",
    desc: "Frappe 20% plus fort à chaque attaque.",
    apply: (f) => {
      f.atkBonus += Math.round(f.atk * 0.2);
    },
  },
  frenzy: {
    id: "frenzy",
    name: "Frénésie",
    icon: "⚡",
    category: "offensif",
    desc: "1 attaque sur 4 est un coup critique (+60% de dégâts).",
    apply: () => {
      // proc lu dans resolveAttack via la présence du talent (RNG seedé)
    },
  },

  // ── Défensifs ──────────────────────────────────────────────────────────
  stoneskin: {
    id: "stoneskin",
    name: "Peau de pierre",
    icon: "🪨",
    category: "défensif",
    desc: "Encaisse 15% de dégâts en moins sur chaque coup reçu.",
    apply: (f) => {
      f.hooks.defenses.push((info) => {
        info.damage = Math.max(1, Math.round(info.damage * 0.85));
      });
    },
  },
  thorns: {
    id: "thorns",
    name: "Épines",
    icon: "🌵",
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
    icon: "💨",
    category: "utilitaire",
    desc: "Agit 15% plus souvent que la normale.",
    apply: (f) => {
      f.timeMultiplier *= 0.85;
    },
  },
  regen: {
    id: "regen",
    name: "Régénération",
    icon: "💚",
    category: "utilitaire",
    desc: "Récupère 4% de ses PV max à chaque tour.",
    apply: (f) => {
      f.hooks.onTurn.push((self, mgr) => {
        if (self.life <= 0 || self.life >= self.maxLife) return;
        const heal = Math.max(1, Math.round(self.maxLife * 0.04));
        self.life = Math.min(self.maxLife, self.life + heal);
        mgr.emit({ t: "regen", fid: self.fid, life: self.life });
        mgr.emit({ t: "talentProc", fid: self.fid, talent: "regen", label: `+${heal} 💚` });
      });
    },
  },
};

export function talentName(id: string): string {
  return TALENTS[id]?.name ?? id;
}

export function talentIcon(id: string): string {
  return TALENTS[id]?.icon ?? "✨";
}
