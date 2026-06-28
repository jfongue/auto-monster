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

// ── Carte : grande toile, lieux de types variés, déplacement par nœuds ──────
/** Type d'un lieu sur la carte. */
export type LocType = "combat" | "shop" | "heal" | "ranch" | "dialogue";

/** Dimensions de la grande toile (coordonnées des lieux en px). */
export const MAP_W = 1280;
export const MAP_H = 820;

/** Un lieu de la carte. Accès libre : on s'y déplace, puis on interagit. */
export type MapLocation = {
  id: string;
  name: string;
  type: LocType;
  /** position sur la grande toile, en px (0..MAP_W / 0..MAP_H) */
  x: number;
  y: number;
  icon: string; // emoji affiché sur le nœud
  desc: string; // courte description (fiche du lieu)
  // ── champs spécifiques aux lieux de combat ──
  enemySpecies?: string;
  enemyLevel?: number;
  isBoss?: boolean;
  recommendedLevel?: number;
  gold?: number;
  potions?: number;
  xp?: number;
  maxTurns?: number;
  // ── champs spécifiques aux dialogues ──
  lines?: string[];
};

/** Rétro-compat : un lieu est aussi une "étape". */
export type MapStep = MapLocation;

export const BOSS_MAX_TURNS = 40;

export const MAP_LOCATIONS: MapLocation[] = [
  // ── Village ──────────────────────────────────────────────────────────────
  {
    id: "plaza",
    name: "Place du village",
    type: "dialogue",
    x: 200,
    y: 430,
    icon: "🏘️",
    desc: "Le cœur du village. Tout commence ici.",
    lines: [
      "« Bienvenue, dresseur ! »",
      "Au nord, la boutique et le centre de soin. Au sud, le ranch de Boris.",
      "À l'est s'étend la vallée sauvage : c'est là que tu trouveras des combats.",
    ],
  },
  {
    id: "shop",
    name: "Boutique de Perle",
    type: "shop",
    x: 360,
    y: 290,
    icon: "🏪",
    desc: "Perle vend des potions de soin.",
  },
  {
    id: "heal",
    name: "Centre de soin",
    type: "heal",
    x: 330,
    y: 580,
    icon: "➕",
    desc: "Soigne instantanément toute ton équipe, contre une petite somme.",
  },
  {
    id: "ranch",
    name: "Ranch de Boris",
    type: "ranch",
    x: 150,
    y: 650,
    icon: "🐴",
    desc: "Boris loue ses Auto Monsters pour quelques combats.",
  },
  {
    id: "traveler",
    name: "Voyageuse",
    type: "dialogue",
    x: 600,
    y: 230,
    icon: "💬",
    desc: "Une voyageuse fait une pause sur la crête.",
    lines: [
      "« Gravelmaw ? Ce monstre est increvable… »",
      "« Use-le sur plusieurs combats : ses blessures restent d'une fois sur l'autre. »",
    ],
  },
  // ── Vallée sauvage (combats) ───────────────────────────────────────────────
  {
    id: "moss",
    name: "Sentier moussu",
    type: "combat",
    x: 520,
    y: 620,
    icon: "⚔️",
    desc: "Une petite pousse remue dans les fougères.",
    enemySpecies: "mossprout",
    enemyLevel: 1,
    isBoss: false,
    recommendedLevel: 1,
    gold: 20,
    potions: 1,
    xp: 35,
  },
  {
    id: "windy",
    name: "Clairière venteuse",
    type: "combat",
    x: 700,
    y: 440,
    icon: "⚔️",
    desc: "Un piaillement strident fond sur toi.",
    enemySpecies: "chirple",
    enemyLevel: 2,
    isBoss: false,
    recommendedLevel: 2,
    gold: 25,
    potions: 0,
    xp: 50,
  },
  {
    id: "scree",
    name: "Éboulis gris",
    type: "combat",
    x: 850,
    y: 640,
    icon: "⚔️",
    desc: "Un caillou… qui a des dents.",
    enemySpecies: "peblix",
    enemyLevel: 3,
    isBoss: false,
    recommendedLevel: 3,
    gold: 30,
    potions: 1,
    xp: 65,
  },
  {
    id: "cloud",
    name: "Crête nuageuse",
    type: "combat",
    x: 1000,
    y: 400,
    icon: "⚔️",
    desc: "Une brume électrique tourbillonne.",
    enemySpecies: "nimbus",
    enemyLevel: 4,
    isBoss: false,
    recommendedLevel: 4,
    gold: 40,
    potions: 1,
    xp: 80,
  },
  {
    id: "lair",
    name: "Antre de Gravelmaw",
    type: "combat",
    x: 1150,
    y: 600,
    icon: "☠",
    desc: "Le sol tremble. Quelque chose d'énorme se réveille.",
    enemySpecies: "gravelmaw",
    enemyLevel: 5,
    isBoss: true,
    recommendedLevel: 6,
    gold: 120,
    potions: 2,
    xp: 160,
    maxTurns: 40,
  },
];

/** Lieux de combat uniquement (pour tests / simulation / progression). */
export const COMBAT_LOCATIONS = MAP_LOCATIONS.filter((l) => l.type === "combat");

/** Rétro-compat : ancien nom = liste des combats. */
export const MAP_STEPS = COMBAT_LOCATIONS;

/** Chemins reliant les lieux (décor). */
export const MAP_PATHS: [string, string][] = [
  ["plaza", "shop"],
  ["plaza", "heal"],
  ["plaza", "ranch"],
  ["shop", "heal"],
  ["plaza", "moss"],
  ["moss", "windy"],
  ["windy", "traveler"],
  ["windy", "scree"],
  ["scree", "cloud"],
  ["cloud", "lair"],
];

/** Lieu de départ du joueur. */
export const START_LOC = "plaza";

export const POTION_HEAL = 0.5; // soigne 50% des PV max (instantané)
export const FULL_HEAL_COST = 30; // or pour soin complet immédiat (inventaire/fiche)

// ── Boutique ────────────────────────────────────────────────────────────────
export const POTION_PRICE = 15; // or par potion achetée

// ── Centre de soin ───────────────────────────────────────────────────────────
export const HEAL_CENTER_COST = 25; // or pour soigner toute l'équipe à fond

// ── Ranch : location d'Auto Monsters ─────────────────────────────────────────
export type RanchOffer = { speciesId: string; level: number; price: number; fights: number };
export const RANCH_OFFERS: RanchOffer[] = [
  { speciesId: "leafkit", level: 4, price: 20, fights: 3 },
  { speciesId: "willowisp", level: 6, price: 45, fights: 3 },
];
/** Prolongation de contrat (proposée au dernier combat). */
export const RANCH_EXTEND = { price: 30, fights: 3 };

// ── Soin progressif (régén continue temps réel) ────────────────────────────
/** Durée pour régénérer de 0 à PV max. Test : 5 s. À terme : plusieurs heures. */
export const HEAL_FULL_MS = 5000;

// ── Boost de stat (inventaire, payant en or) ───────────────────────────────
export const BOOST_COST = 20; // or par boost
/** Montant ajouté par boost, par stat. */
export const BOOST_AMOUNT: Record<string, number> = { hp: 8, atk: 3, def: 3, spd: 3, sta: 4 };
