// Données statiques du jeu : espèces (auto monsters + bestioles), map, loot.

import type { SpeciesDef, Stats } from "./types";

const st = (hp: number, atk: number, def: number, spd: number, sta: number): Stats => ({
  hp,
  atk,
  def,
  spd,
  sta,
});

export const SPECIES: Record<string, SpeciesDef> = {
  // ── Auto monsters jouables (3 starters) ──────────────────────────────────
  flameling: {
    id: "flameling",
    name: "Flameling",
    kind: "automonster",
    rarity: "common",
    gfx: "flameling",
    size: 100,
    baseStats: st(55, 26, 8, 48, 30),
    innate: "ember",
    talentPool: ["ember", "frenzy", "swift", "stoneskin"],
    tint: "#ff7a3c",
  },
  aquafi: {
    id: "aquafi",
    name: "Aquafi",
    kind: "automonster",
    rarity: "common",
    gfx: "aquafi",
    size: 100,
    baseStats: st(82, 18, 16, 38, 35),
    innate: "stoneskin",
    talentPool: ["stoneskin", "thorns", "regen", "ember"],
    tint: "#3cc6ff",
  },
  leafkit: {
    id: "leafkit",
    name: "Leafkit",
    kind: "automonster",
    rarity: "common",
    gfx: "leafkit",
    size: 100,
    baseStats: st(60, 21, 9, 62, 28),
    innate: "swift",
    talentPool: ["swift", "frenzy", "regen", "thorns"],
    tint: "#6fd97a",
  },

  // ── Auto monster rare (capture après le boss) ────────────────────────────
  willowisp: {
    id: "willowisp",
    name: "Willowisp",
    kind: "automonster",
    rarity: "rare",
    gfx: "willowisp",
    size: 105,
    baseStats: st(75, 28, 12, 55, 45),
    innate: "regen",
    talentPool: ["regen", "ember", "frenzy", "swift", "thorns", "stoneskin"],
    tint: "#c89bff",
  },

  // ── Bestioles ennemies (créatures simples, pas des auto monsters) ─────────
  peblix: {
    id: "peblix",
    name: "Peblix",
    kind: "bestiole",
    rarity: "common",
    gfx: "peblix",
    size: 95,
    baseStats: st(46, 12, 10, 30, 0),
    innate: null,
    talentPool: [],
    tint: "#b9a07a",
  },
  chirple: {
    id: "chirple",
    name: "Chirple",
    kind: "bestiole",
    rarity: "common",
    gfx: "chirple",
    size: 90,
    baseStats: st(38, 15, 5, 52, 0),
    innate: null,
    talentPool: [],
    tint: "#ffd24a",
  },
  mossprout: {
    id: "mossprout",
    name: "Mossprout",
    kind: "bestiole",
    rarity: "common",
    gfx: "mossprout",
    size: 95,
    baseStats: st(58, 13, 9, 28, 0),
    innate: null,
    talentPool: [],
    tint: "#7fae5a",
  },
  nimbus: {
    id: "nimbus",
    name: "Nimbus",
    kind: "bestiole",
    rarity: "common",
    gfx: "nimbus",
    size: 95,
    baseStats: st(50, 16, 7, 46, 0),
    innate: null,
    talentPool: [],
    tint: "#aab8d8",
  },

  // ── Boss : bestiole massive et coriace (combats longs → égalités) ─────────
  gravelmaw: {
    id: "gravelmaw",
    name: "Gravelmaw",
    kind: "bestiole",
    rarity: "boss",
    gfx: "peblix",
    size: 165,
    baseStats: st(240, 10, 17, 30, 0),
    innate: "stoneskin",
    talentPool: [],
    tint: "#8c6b4a",
  },
};

export const STARTERS = ["flameling", "aquafi", "leafkit"] as const;
export const RARE_REWARD = "willowisp";

/** Une étape de la map = un combat. */
export type MapStep = {
  index: number;
  name: string;
  enemySpecies: string;
  enemyLevel: number;
  isBoss: boolean;
  /** loot en cas de victoire */
  gold: number;
  potions: number;
  /** xp accordée au vainqueur */
  xp: number;
  blurb: string;
  /** limite de tours (boss : court → égalité, on grignote en plusieurs parties) */
  maxTurns?: number;
};

export const BOSS_MAX_TURNS = 40;

export const MAP_STEPS: MapStep[] = [
  {
    index: 0,
    name: "Sentier moussu",
    enemySpecies: "mossprout",
    enemyLevel: 1,
    isBoss: false,
    gold: 20,
    potions: 1,
    xp: 35,
    blurb: "Une petite pousse remue dans les fougères.",
  },
  {
    index: 1,
    name: "Clairière venteuse",
    enemySpecies: "chirple",
    enemyLevel: 2,
    isBoss: false,
    gold: 25,
    potions: 0,
    xp: 50,
    blurb: "Un piaillement strident fond sur toi.",
  },
  {
    index: 2,
    name: "Éboulis gris",
    enemySpecies: "peblix",
    enemyLevel: 3,
    isBoss: false,
    gold: 30,
    potions: 1,
    xp: 65,
    blurb: "Un caillou… qui a des dents.",
  },
  {
    index: 3,
    name: "Crête nuageuse",
    enemySpecies: "nimbus",
    enemyLevel: 4,
    isBoss: false,
    gold: 40,
    potions: 1,
    xp: 80,
    blurb: "Une brume électrique tourbillonne.",
  },
  {
    index: 4,
    name: "Antre de Gravelmaw",
    enemySpecies: "gravelmaw",
    enemyLevel: 5,
    isBoss: true,
    gold: 120,
    potions: 2,
    xp: 160,
    blurb: "Le sol tremble. Quelque chose d'énorme se réveille.",
    maxTurns: 40,
  },
];

export const POTION_HEAL = 0.5; // soigne 50% des PV max
export const FULL_HEAL_COST = 30; // or pour soin complet au camp
