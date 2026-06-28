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

/** Un lieu de la carte = un combat. Accessible librement (pas d'ordre imposé). */
export type MapLocation = {
  id: string;
  name: string;
  enemySpecies: string;
  enemyLevel: number;
  isBoss: boolean;
  /** position sur la petite carte, en % (0..100) */
  x: number;
  y: number;
  recommendedLevel: number;
  /** loot accordé à la 1re victoire */
  gold: number;
  potions: number;
  /** xp accordée au vainqueur */
  xp: number;
  blurb: string;
  /** limite de tours (boss : court → égalité, on grignote en plusieurs parties) */
  maxTurns?: number;
};

/** Rétro-compat : un lieu est aussi une "étape". */
export type MapStep = MapLocation;

export const BOSS_MAX_TURNS = 40;

export const MAP_LOCATIONS: MapLocation[] = [
  {
    id: "moss",
    name: "Sentier moussu",
    enemySpecies: "mossprout",
    enemyLevel: 1,
    isBoss: false,
    x: 18,
    y: 70,
    recommendedLevel: 1,
    gold: 20,
    potions: 1,
    xp: 35,
    blurb: "Une petite pousse remue dans les fougères.",
  },
  {
    id: "windy",
    name: "Clairière venteuse",
    enemySpecies: "chirple",
    enemyLevel: 2,
    isBoss: false,
    x: 38,
    y: 42,
    recommendedLevel: 2,
    gold: 25,
    potions: 0,
    xp: 50,
    blurb: "Un piaillement strident fond sur toi.",
  },
  {
    id: "scree",
    name: "Éboulis gris",
    enemySpecies: "peblix",
    enemyLevel: 3,
    isBoss: false,
    x: 58,
    y: 66,
    recommendedLevel: 3,
    gold: 30,
    potions: 1,
    xp: 65,
    blurb: "Un caillou… qui a des dents.",
  },
  {
    id: "cloud",
    name: "Crête nuageuse",
    enemySpecies: "nimbus",
    enemyLevel: 4,
    isBoss: false,
    x: 74,
    y: 34,
    recommendedLevel: 4,
    gold: 40,
    potions: 1,
    xp: 80,
    blurb: "Une brume électrique tourbillonne.",
  },
  {
    id: "lair",
    name: "Antre de Gravelmaw",
    enemySpecies: "gravelmaw",
    enemyLevel: 5,
    isBoss: true,
    x: 88,
    y: 64,
    recommendedLevel: 6,
    gold: 120,
    potions: 2,
    xp: 160,
    blurb: "Le sol tremble. Quelque chose d'énorme se réveille.",
    maxTurns: 40,
  },
];

/** Rétro-compat : ancien nom. */
export const MAP_STEPS = MAP_LOCATIONS;

export const POTION_HEAL = 0.5; // soigne 50% des PV max (instantané)
export const FULL_HEAL_COST = 30; // or pour soin complet immédiat

// ── Soin progressif (régén continue temps réel) ────────────────────────────
/** Durée pour régénérer de 0 à PV max. Test : 5 s. À terme : plusieurs heures. */
export const HEAL_FULL_MS = 5000;

// ── Boost de stat (inventaire, payant en or) ───────────────────────────────
export const BOOST_COST = 20; // or par boost
/** Montant ajouté par boost, par stat. */
export const BOOST_AMOUNT: Record<string, number> = { hp: 8, atk: 3, def: 3, spd: 3, sta: 4 };
