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
    apply: (f) => {
      f.critChance = 25;
      f.critMult = 1.6;
    },
  },
  fournaise: {
    id: "fournaise",
    name: "Fournaise",
    icon: "🌋",
    category: "offensif",
    desc: "Chaque coup critique augmente sa Force pour tout le combat (+15%).",
    apply: (f) => {
      f.rageOnCrit = 0.15;
    },
  },
  embrasement: {
    id: "embrasement",
    name: "Embrasement",
    icon: "🔥",
    category: "offensif",
    desc: "Ses attaques enflamment la cible : Brûlure (dégâts sur 3 tours).",
    apply: (f) => {
      f.onHitStatus = { kind: "burn", dmg: Math.max(2, Math.round(f.atk * 0.28)), turns: 3, icon: "🔥" };
    },
  },
  pyromane: {
    id: "pyromane",
    name: "Pyromane",
    icon: "🔥",
    category: "offensif",
    desc: "Inflige +35% de dégâts aux cibles en feu.",
    apply: (f) => {
      f.ampVsStatus.burn = 1.35;
    },
  },
  inoculation: {
    id: "inoculation",
    name: "Inoculation",
    icon: "☠️",
    category: "offensif",
    desc: "Ses attaques empoisonnent la cible (dégâts sur 3 tours).",
    apply: (f) => {
      f.onHitStatus = { kind: "poison", dmg: Math.max(2, Math.round(f.atk * 0.25)), turns: 3, icon: "☠️" };
    },
  },
  virulence: {
    id: "virulence",
    name: "Virulence",
    icon: "☠️",
    category: "offensif",
    desc: "Inflige +35% de dégâts aux cibles empoisonnées.",
    apply: (f) => {
      f.ampVsStatus.poison = 1.35;
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
  spores: {
    id: "spores",
    name: "Spores toxiques",
    icon: "🍄",
    category: "défensif",
    desc: "Quand il est touché, il empoisonne l'attaquant (3 tours).",
    apply: (f) => {
      f.poisonOnHurt = { kind: "poison", dmg: Math.max(2, Math.round(f.atk * 0.22)), turns: 3, icon: "☠️" };
    },
  },
  secondwind: {
    id: "secondwind",
    name: "Second souffle",
    icon: "💚",
    category: "défensif",
    desc: "Sa régénération est doublée quand ses PV passent sous 40%.",
    apply: (f) => {
      f.regenLowMult = 2;
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
  evasion: {
    id: "evasion",
    name: "Insaisissable",
    icon: "🕊️",
    category: "utilitaire",
    desc: "Esquive nettement plus souvent les attaques (+16% esquive).",
    apply: (f) => {
      f.dodge += 16;
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
        const low = self.life < self.maxLife * 0.4;
        const mult = low ? self.regenLowMult : 1;
        const heal = Math.max(1, Math.round(self.maxLife * 0.04 * mult));
        self.life = Math.min(self.maxLife, self.life + heal);
        mgr.emit({ t: "regen", fid: self.fid, life: self.life });
        mgr.emit({ t: "talentProc", fid: self.fid, talent: "regen", label: `+${heal} 💚` });
      });
    },
  },
  ponction: {
    id: "ponction",
    name: "Ponction",
    icon: "🩸",
    category: "utilitaire",
    desc: "Récupère 30% des dégâts qu'il inflige en PV (vol de vie).",
    apply: (f) => {
      f.lifesteal = Math.max(f.lifesteal, 0.3);
    },
  },
  sangsue: {
    id: "sangsue",
    name: "Sangsue",
    icon: "🩸",
    category: "utilitaire",
    desc: "Le vol de vie grimpe à 55% des dégâts infligés.",
    apply: (f) => {
      f.lifesteal = Math.max(f.lifesteal, 0.55);
    },
  },
  riposte: {
    id: "riposte",
    name: "Riposte",
    icon: "⚔️",
    category: "utilitaire",
    desc: "Quand il esquive, il contre-attaque immédiatement.",
    apply: (f) => {
      f.riposte = true;
    },
  },
  contreParfait: {
    id: "contreParfait",
    name: "Contre parfait",
    icon: "✨",
    category: "utilitaire",
    desc: "Ses ripostes sont des coups critiques (+60% de dégâts).",
    apply: (f) => {
      f.riposteCrit = true;
    },
  },
  elan: {
    id: "elan",
    name: "Élan",
    icon: "🌀",
    category: "utilitaire",
    desc: "Chaque esquive augmente sa Force pour tout le combat (+12%).",
    apply: (f) => {
      f.dodgeAtkGain = Math.max(f.dodgeAtkGain, 0.12);
    },
  },
  danse: {
    id: "danse",
    name: "Danse du vent",
    icon: "🌀",
    category: "utilitaire",
    desc: "Chaque esquive augmente aussi son esquive et sa vitesse.",
    apply: (f) => {
      f.dodgeSnowball = true;
    },
  },
};

export function talentName(id: string): string {
  return TALENTS[id]?.name ?? id;
}

export function talentIcon(id: string): string {
  return TALENTS[id]?.icon ?? "✨";
}
