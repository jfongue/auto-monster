// Données statiques du jeu : espèces (auto monsters + bestioles), map, loot.

import type { SpeciesDef, Stats, InteractKind, Personality } from "./types";

const st = (hp: number, atk: number, def: number, spd: number): Stats => ({
  hp,
  atk,
  def,
  spd,
});

export const SPECIES: Record<string, SpeciesDef> = {
  // ── Auto monsters jouables (3 starters, v0.14) ───────────────────────────
  poofowl: {
    id: "poofowl",
    name: "Poofowl",
    kind: "automonster",
    rarity: "common",
    gfx: "poofowl",
    size: 100,
    baseStats: st(58, 15, 14, 30),
    innate: "regen",
    talentPool: ["regen", "stoneskin", "swift", "thorns"],
    tint: "#aaa4a0",
    desc: "Boule de duvet cornue, mi-chouette mi-mouton, adore somnoler. Douce et increvable, elle récupère vite entre deux combats.",
    wildEncounterable: false,
  },
  fungoot: {
    id: "fungoot",
    name: "Fungoot",
    kind: "automonster",
    rarity: "common",
    gfx: "fungoot",
    size: 100,
    baseStats: st(56, 15, 16, 26),
    innate: "thorns",
    talentPool: ["thorns", "stoneskin", "regen", "ember"],
    tint: "#b29075",
    desc: "Champignon tacheté renfrogné, pousse en cercles dans la mousse humide. Rancunier : il rend chaque coup reçu avec intérêt.",
    wildEncounterable: false,
  },
  emberpup: {
    id: "emberpup",
    name: "Emberpup",
    kind: "automonster",
    rarity: "common",
    gfx: "emberpup",
    size: 100,
    baseStats: st(54, 20, 10, 44),
    innate: "ember",
    talentPool: ["ember", "frenzy", "swift", "stoneskin"],
    tint: "#bb6d40",
    desc: "Lionceau à crinière de braise, plus joueur qu'agressif malgré ses flammes. Vif et mordant en combat.",
    wildEncounterable: false,
  },

  // ── Auto monster rare (capture après le boss) ────────────────────────────
  haloux: {
    id: "haloux",
    name: "Haloux",
    kind: "automonster",
    rarity: "rare",
    gfx: "haloux",
    size: 105,
    baseStats: st(70, 22, 15, 48),
    innate: "swift",
    talentPool: ["swift", "regen", "ember", "stoneskin", "thorns", "frenzy"],
    tint: "#d7c093",
    desc: "Oiselet angélique à l'auréole dorée, rare porte-bonheur des voyageurs. Se lie à qui a prouvé sa valeur face à Gravelmaw.",
    wildEncounterable: false,
  },

  // ── Boss : bestiole massive et coriace (combats longs → égalités) ─────────
  gravelmaw: {
    id: "gravelmaw",
    name: "Gravelmaw",
    kind: "bestiole",
    rarity: "boss",
    gfx: "peblix",
    size: 165,
    baseStats: st(240, 10, 17, 30),
    innate: "stoneskin",
    talentPool: [],
    tint: "#8c6b4a",
    desc: "Colosse de roche et de mâchoires, gardien de l'antre. Increvable : ses blessures persistent d'un combat à l'autre.",
    wildEncounterable: false,
  },

  // ── Bestiaire étendu (import planches, 2026-07-11) ───────────────────────
  // 43 nouvelles bestioles sauvages. Stats/noms/rareté/wildEncounterable
  // sont des valeurs de départ éditables via l'Éditeur d'espèces (menu ☰).
  // (emberpup, poofowl, fungoot, haloux promues Auto Monsters jouables v0.14,
  // déplacées en tête de fichier — 39 bestioles restent ici.)
  foxleaf: { id: "foxleaf", name: "Foxleaf", kind: "bestiole", rarity: "common", gfx: "foxleaf", size: 100, baseStats: st(48, 15, 7, 50), innate: null, talentPool: [], tint: "#838e5a", desc: "Petit renard feuillu qui bondit dans les sous-bois, sa queue bruissant comme un bosquet.", wildEncounterable: true },
  ottermis: { id: "ottermis", name: "Ottermis", kind: "bestiole", rarity: "common", gfx: "ottermis", size: 100, baseStats: st(60, 14, 12, 34), innate: null, talentPool: [], tint: "#6f8d9f", desc: "Loutre des rivages froids, curieuse et toujours prête à plonger.", wildEncounterable: true },
  sprigling: { id: "sprigling", name: "Sprigling", kind: "bestiole", rarity: "common", gfx: "sprigling", size: 100, baseStats: st(56, 13, 11, 30), innate: null, talentPool: [], tint: "#9f9b6e", desc: "Jeune tortue verte dont la coquille bourgeonne au printemps.", wildEncounterable: true },
  cobbleback: { id: "cobbleback", name: "Cobbleback", kind: "bestiole", rarity: "common", gfx: "cobbleback", size: 100, baseStats: st(58, 12, 16, 24), innate: null, talentPool: [], tint: "#766869", desc: "Tortue de granit trapue, imperturbable même sous les coups.", wildEncounterable: true },
  murkwisp: { id: "murkwisp", name: "Murkwisp", kind: "bestiole", rarity: "common", gfx: "murkwisp", size: 100, baseStats: st(44, 16, 6, 44), innate: null, talentPool: [], tint: "#766c99", desc: "Volute de brume violette qui hante les clairières discrètes.", wildEncounterable: true },
  squawklet: { id: "squawklet", name: "Squawklet", kind: "bestiole", rarity: "common", gfx: "squawklet", size: 100, baseStats: st(36, 15, 5, 54), innate: null, talentPool: [], tint: "#ab8167", desc: "Oisillon criard au bec vif, toujours le premier à sonner l'alarme.", wildEncounterable: true },
  snowlark: { id: "snowlark", name: "Snowlark", kind: "bestiole", rarity: "common", gfx: "snowlark", size: 100, baseStats: st(42, 14, 7, 50), innate: null, talentPool: [], tint: "#b5bfc8", desc: "Petit oiseau des cimes, plume en volute, annonciateur de neige.", wildEncounterable: true },

  serpentide: { id: "serpentide", name: "Serpentide", kind: "bestiole", rarity: "rare", gfx: "serpentide", size: 100, baseStats: st(78, 24, 14, 46), innate: null, talentPool: [], tint: "#88a791", desc: "Dragon-serpent élégant aux bois dorés ; rare, il n'apparaît qu'aux eaux calmes.", wildEncounterable: false },
  kelpshell: { id: "kelpshell", name: "Kelpshell", kind: "bestiole", rarity: "common", gfx: "kelpshell", size: 100, baseStats: st(60, 12, 15, 26), innate: null, talentPool: [], tint: "#ab8f69", desc: "Tortue des fonds tièdes, carapace tapissée d'algues odorantes.", wildEncounterable: true },
  jellumin: { id: "jellumin", name: "Jellumin", kind: "bestiole", rarity: "common", gfx: "jellumin", size: 100, baseStats: st(46, 15, 8, 36), innate: null, talentPool: [], tint: "#8993c0", desc: "Méduse flottante aux reflets mauves, inoffensive tant qu'on l'observe de loin.", wildEncounterable: true },
  geodite: { id: "geodite", name: "Geodite", kind: "bestiole", rarity: "rare", gfx: "geodite", size: 100, baseStats: st(72, 20, 20, 22), innate: null, talentPool: [], tint: "#6c817f", desc: "Golem de cristal aux yeux ambrés, rare relique des grottes profondes.", wildEncounterable: false },
  axolume: { id: "axolume", name: "Axolume", kind: "bestiole", rarity: "rare", gfx: "axolume", size: 100, baseStats: st(70, 22, 13, 40), innate: null, talentPool: [], tint: "#cda28b", desc: "Axolotl ailé scintillant, rare esprit des sources sacrées.", wildEncounterable: false },
  petalump: { id: "petalump", name: "Petalump", kind: "bestiole", rarity: "common", gfx: "petalump", size: 100, baseStats: st(54, 12, 11, 30), innate: null, talentPool: [], tint: "#95a062", desc: "Petite tortue coiffée d'une fleur, paisible grignoteuse de pétales.", wildEncounterable: true },
  glooze: { id: "glooze", name: "Glooze", kind: "bestiole", rarity: "common", gfx: "glooze", size: 100, baseStats: st(50, 16, 8, 32), innate: null, talentPool: [], tint: "#7b5d98", desc: "Gelée violette marquée d'un crâne, plus câline que menaçante.", wildEncounterable: true },
  ribbiton: { id: "ribbiton", name: "Ribbiton", kind: "bestiole", rarity: "common", gfx: "ribbiton", size: 100, baseStats: st(44, 15, 6, 48), innate: null, talentPool: [], tint: "#8c9973", desc: "Grenouille ailée qui bondit d'une berge à l'autre en voletant.", wildEncounterable: true },
  scarabolt: { id: "scarabolt", name: "Scarabolt", kind: "bestiole", rarity: "common", gfx: "scarabolt", size: 100, baseStats: st(56, 17, 14, 32), innate: null, talentPool: [], tint: "#566b88", desc: "Scarabée cuirassé aux cornes acérées, robuste combattant des sous-bois.", wildEncounterable: true },

  smokecoil: { id: "smokecoil", name: "Smokecoil", kind: "bestiole", rarity: "common", gfx: "smokecoil", size: 100, baseStats: st(48, 16, 7, 42), innate: null, talentPool: [], tint: "#839778", desc: "Serpent fumant aux volutes vertes, glisse sans un bruit.", wildEncounterable: true },
  bloomcrest: { id: "bloomcrest", name: "Bloomcrest", kind: "bestiole", rarity: "common", gfx: "bloomcrest", size: 100, baseStats: st(46, 14, 7, 38), innate: null, talentPool: [], tint: "#a98879", desc: "Esprit floral couronné de pétales, danse au moindre souffle de vent.", wildEncounterable: true },
  icubis: { id: "icubis", name: "Icubis", kind: "bestiole", rarity: "rare", gfx: "icubis", size: 100, baseStats: st(68, 17, 20, 20), innate: null, talentPool: [], tint: "#6791b6", desc: "Cube de glace vivant, rare curiosité des lacs gelés.", wildEncounterable: false },
  ribbonel: { id: "ribbonel", name: "Ribbonel", kind: "bestiole", rarity: "common", gfx: "ribbonel", size: 100, baseStats: st(42, 17, 6, 46), innate: null, talentPool: [], tint: "#a18ba9", desc: "Ruban violet en spirale, insaisissable et toujours en mouvement.", wildEncounterable: true },
  cattermil: { id: "cattermil", name: "Cattermil", kind: "bestiole", rarity: "common", gfx: "cattermil", size: 100, baseStats: st(46, 11, 10, 26), innate: null, talentPool: [], tint: "#938e66", desc: "Chenille dorée aux antennes curieuses, patiente avant sa métamorphose.", wildEncounterable: true },
  wickember: { id: "wickember", name: "Wickember", kind: "bestiole", rarity: "common", gfx: "wickember", size: 100, baseStats: st(48, 18, 8, 38), innate: null, talentPool: [], tint: "#9d7f79", desc: "Lanterne-citrouille malicieuse, sa flamme danse au rythme de son humeur.", wildEncounterable: true },
  finspike: { id: "finspike", name: "Finspike", kind: "bestiole", rarity: "common", gfx: "finspike", size: 100, baseStats: st(50, 19, 10, 44), innate: null, talentPool: [], tint: "#7284a5", desc: "Petit prédateur aquatique aux ailerons acérés, rapide en embuscade.", wildEncounterable: true },

  leapleaf: { id: "leapleaf", name: "Leapleaf", kind: "bestiole", rarity: "common", gfx: "leapleaf", size: 100, baseStats: st(46, 15, 6, 52), innate: null, talentPool: [], tint: "#96ab6e", desc: "Renardeau facétieux qui laisse une traînée de feuilles en sautant.", wildEncounterable: true },
  armadge: { id: "armadge", name: "Armadge", kind: "bestiole", rarity: "common", gfx: "armadge", size: 100, baseStats: st(56, 12, 17, 22), innate: null, talentPool: [], tint: "#897972", desc: "Tatou blindé qui se love en boule au moindre danger.", wildEncounterable: true },
  frostspine: { id: "frostspine", name: "Frostspine", kind: "bestiole", rarity: "common", gfx: "frostspine", size: 100, baseStats: st(52, 16, 12, 32), innate: null, talentPool: [], tint: "#7fa4c0", desc: "Hérisson de givre aux piquants cristallins, craint le redoux.", wildEncounterable: true },
  sporeling: { id: "sporeling", name: "Sporeling", kind: "bestiole", rarity: "common", gfx: "sporeling", size: 100, baseStats: st(54, 12, 11, 28), innate: null, talentPool: [], tint: "#a39367", desc: "Tortue forestière coiffée de champignons et d'une fleur, sent la mousse fraîche.", wildEncounterable: true },
  tarblob: { id: "tarblob", name: "Tarblob", kind: "bestiole", rarity: "common", gfx: "tarblob", size: 100, baseStats: st(52, 16, 9, 30), innate: null, talentPool: [], tint: "#7f649b", desc: "Mare de goudron violet grimaçante, colle à tout ce qu'elle touche.", wildEncounterable: true },
  voltkit: { id: "voltkit", name: "Voltkit", kind: "bestiole", rarity: "common", gfx: "voltkit", size: 100, baseStats: st(44, 17, 6, 56), innate: null, talentPool: [], tint: "#c5a95e", desc: "Renardeau électrique à la queue en éclair, ne tient jamais en place.", wildEncounterable: true },
  splashling: { id: "splashling", name: "Splashling", kind: "bestiole", rarity: "common", gfx: "splashling", size: 100, baseStats: st(58, 13, 12, 32), innate: null, talentPool: [], tint: "#7eacce", desc: "Petit phoque des bassins clairs, adore éclabousser les visiteurs.", wildEncounterable: true },

  snailorn: { id: "snailorn", name: "Snailorn", kind: "bestiole", rarity: "common", gfx: "snailorn", size: 100, baseStats: st(50, 11, 17, 18), innate: null, talentPool: [], tint: "#a99484", desc: "Escargot des chemins, coquille rayée comme une corne d'abondance.", wildEncounterable: true },
  axolotine: { id: "axolotine", name: "Axolotine", kind: "bestiole", rarity: "rare", gfx: "axolotine", size: 100, baseStats: st(64, 17, 12, 36), innate: null, talentPool: [], tint: "#c28fae", desc: "Axolotl rose des rivières calmes, rare et d'une timidité désarmante.", wildEncounterable: false },
  meteorb: { id: "meteorb", name: "Meteorb", kind: "bestiole", rarity: "rare", gfx: "meteorb", size: 100, baseStats: st(74, 19, 18, 26), innate: null, talentPool: [], tint: "#6d6f75", desc: "Fragment de météore flottant, gravite lentement en grondant à peine.", wildEncounterable: false },
  bellwisp: { id: "bellwisp", name: "Bellwisp", kind: "bestiole", rarity: "common", gfx: "bellwisp", size: 100, baseStats: st(46, 15, 8, 34), innate: null, talentPool: [], tint: "#7dbabc", desc: "Esprit-cloche translucide, flotte en laissant une traînée de bulles.", wildEncounterable: true },
  beetlorn: { id: "beetlorn", name: "Beetlorn", kind: "bestiole", rarity: "common", gfx: "beetlorn", size: 100, baseStats: st(54, 18, 13, 38), innate: null, talentPool: [], tint: "#687277", desc: "Insecte cuirassé aux longues pattes, guette immobile puis charge sans prévenir.", wildEncounterable: true },
  thicket: { id: "thicket", name: "Thicket", kind: "bestiole", rarity: "common", gfx: "thicket", size: 100, baseStats: st(58, 13, 14, 22), innate: null, talentPool: [], tint: "#667439", desc: "Buisson ambulant aux bras noueux, dort debout au milieu des fougères.", wildEncounterable: true },
  waxwick: { id: "waxwick", name: "Waxwick", kind: "bestiole", rarity: "common", gfx: "waxwick", size: 100, baseStats: st(42, 17, 6, 40), innate: null, talentPool: [], tint: "#986d53", desc: "Flammèche facétieuse perchée sur une souche calcinée.", wildEncounterable: true },
  spinepuff: { id: "spinepuff", name: "Spinepuff", kind: "bestiole", rarity: "common", gfx: "spinepuff", size: 100, baseStats: st(48, 13, 15, 24), innate: null, talentPool: [], tint: "#8a879c", desc: "Petite boule de piquants pastel, se hérisse dès qu'on l'approche.", wildEncounterable: true },
  bannertail: { id: "bannertail", name: "Bannertail", kind: "bestiole", rarity: "rare", gfx: "bannertail", size: 100, baseStats: st(62, 20, 11, 52), innate: null, talentPool: [], tint: "#a2716a", desc: "Oiseau héraut à la queue en étendard, rare messager des grands vents.", wildEncounterable: false },
};

/** Toutes les espèces "bestiole" rencontrables en combat sauvage (Forêt), selon le flag éditable. */
export const wildSpeciesList = () => Object.values(SPECIES).filter((s) => s.wildEncounterable);

/**
 * Applique des surcharges (Éditeur d'espèces) sur SPECIES, EN PLACE (même
 * référence d'objet) : les composants qui lisent SPECIES[id] à chaque rendu
 * voient donc la mise à jour sans changement de câblage supplémentaire.
 */
export function applySpeciesOverrides(overrides: Record<string, Partial<SpeciesDef>>) {
  for (const [id, patch] of Object.entries(overrides || {})) {
    if (SPECIES[id]) Object.assign(SPECIES[id], patch);
  }
}

export const STARTERS = ["poofowl", "fungoot", "emberpup"] as const;
export const RARE_REWARD = "haloux";

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
    enemySpecies: "sprigling",
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
    enemySpecies: "squawklet",
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
    enemySpecies: "cobbleback",
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
    enemySpecies: "murkwisp",
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
  // village (étoile autour de la place)
  ["plaza", "shop"],
  ["plaza", "heal"],
  ["plaza", "ranch"],
  // sentier vers la vallée sauvage (chaîne unique, lisible)
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
  { speciesId: "emberpup", level: 4, price: 20, fights: 3 },
  { speciesId: "haloux", level: 6, price: 45, fights: 3 },
];
/** Prolongation de contrat (proposée au dernier combat). */
export const RANCH_EXTEND = { price: 30, fights: 3 };

// ── Soin progressif (régén continue temps réel) ────────────────────────────
/** Durée pour régénérer de 0 à PV max. Test : 5 s. À terme : plusieurs heures. */
export const HEAL_FULL_MS = 5000;

// ── Personnalité & interactions (gratuit, aléatoire, par individu) ──────────
/** Cooldown entre deux interactions du même type. Test : 8 s. À terme : qq heures. */
export const INTERACT_COOLDOWN_MS = 8000;

/** Bornes d'humeur. 50 = neutre. */
export const MOOD_MIN = 0;
export const MOOD_MAX = 100;
export const MOOD_START = 60;

export const INTERACT_LABELS: Record<InteractKind, { name: string; emoji: string; hint: string }> = {
  caresser: { name: "Caresser", emoji: "🤚", hint: "Renforce le lien… si l'individu aime le contact." },
  coacher: { name: "Coacher", emoji: "🏋️", hint: "Entraînement : peut gagner une stat… ou le braquer." },
  observer: { name: "Observer", emoji: "🔎", hint: "Étude discrète : peu risqué, révèle parfois un détail." },
};

/**
 * Archétypes de caractère. Chaque individu en reçoit un à la capture, PUIS
 * ses affinités sont perturbées aléatoirement → deux individus du même
 * archétype réagissent différemment (caractère propre à l'individu).
 */
export const ARCHETYPES: Omit<Personality, "blurb">[] = [
  { archetype: "Affectueux", emoji: "💗", affinity: { caresser: 0.8, coacher: 0.1, observer: 0.2 } },
  { archetype: "Sauvage", emoji: "🔥", affinity: { caresser: -0.6, coacher: 0.3, observer: -0.2 } },
  { archetype: "Orgueilleux", emoji: "👑", affinity: { caresser: -0.2, coacher: 0.6, observer: -0.3 } },
  { archetype: "Craintif", emoji: "🫣", affinity: { caresser: 0.3, coacher: -0.4, observer: -0.5 } },
  { archetype: "Curieux", emoji: "✨", affinity: { caresser: 0.2, coacher: 0.2, observer: 0.8 } },
  { archetype: "Stoïque", emoji: "🗿", affinity: { caresser: -0.1, coacher: 0.4, observer: 0.4 } },
  { archetype: "Joueur", emoji: "🎲", affinity: { caresser: 0.5, coacher: -0.2, observer: 0.3 } },
  { archetype: "Paresseux", emoji: "😴", affinity: { caresser: 0.4, coacher: -0.6, observer: 0.1 } },
];

const BLURBS: Record<string, string> = {
  Affectueux: "Réclame des câlins et fond dès qu'on s'approche.",
  Sauvage: "Indomptable ; n'apprécie pas qu'on le touche, mais adore se dépenser.",
  Orgueilleux: "Se prend pour un champion ; veut qu'on le pousse, déteste qu'on l'épie.",
  Craintif: "Sursaute pour un rien ; gagne en confiance dans la durée.",
  Curieux: "Fasciné par tout ; adore qu'on l'observe et qu'on lui apprenne.",
  Stoïque: "Impassible ; rien ne semble l'atteindre, l'entraînement le révèle.",
  Joueur: "Espiègle et imprévisible ; transforme tout en jeu.",
  Paresseux: "Économe de ses efforts ; câlins oui, exercice bof.",
};

/** Génère un caractère UNIQUE (archétype + affinités perturbées). */
export function makePersonality(rand: () => number = Math.random): Personality {
  const a = ARCHETYPES[Math.floor(rand() * ARCHETYPES.length)];
  const jitter = (v: number) => Math.max(-1, Math.min(1, v + (rand() - 0.5) * 0.5));
  return {
    archetype: a.archetype,
    emoji: a.emoji,
    blurb: BLURBS[a.archetype] ?? "",
    affinity: {
      caresser: jitter(a.affinity.caresser),
      coacher: jitter(a.affinity.coacher),
      observer: jitter(a.affinity.observer),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONES & PNJ (refonte "mise en scène")
// ─ Trois zones sur la carte du monde. Chaque zone a un état (peaceful /
//   exploration / threatened) et un lot de PNJ avec qui dialoguer (chat DE).
// ═══════════════════════════════════════════════════════════════════════════

export type ZoneMood = "peaceful" | "exploration" | "threatened";

/** Rôle d'un PNJ → détermine les actions offertes dans le chat. */
export type NpcRole = "mentor" | "merchant" | "healer" | "ranch" | "lore";

export type Npc = {
  id: string;
  name: string;
  title: string;
  emoji: string; // portrait de secours (emoji)
  tint: string; // couleur d'accent du portrait
  role: NpcRole;
  /** répliques d'ambiance (chat façon Disco Elysium) */
  lines: string[];
};

export type Zone = {
  id: string;
  name: string;
  subtitle: string;
  x: number; // position sur la carte du monde (0..MAP_W)
  y: number;
  icon: string;
  /** teinte d'accent de la zone (thème clair) */
  tint: string;
  /** état par défaut (avant progression) */
  baseMood: ZoneMood;
  /** ids d'encounters (combats) présents dans la zone */
  encounters: string[];
  /** nb de victoires pour atteindre 100% de complétion */
  winsToComplete: number;
  /** id de la zone débloquée à 75% (avec un boss) */
  unlocks?: string;
  /** id de l'encounter boss (si zone menacée) */
  boss?: string;
  /** PNJ présents quand la zone est paisible */
  npcs: Npc[];
  /** PNJ présents pendant la phase d'exploration (avant pacification) */
  wildNpcs?: Npc[];
};

export const MAP_WORLD_W = 1200;
export const MAP_WORLD_H = 560;

export const ZONES: Zone[] = [
  {
    id: "clairiere",
    name: "Clairière du Départ",
    subtitle: "Le hameau paisible où tout commence.",
    x: 210,
    y: 360,
    icon: "🌿",
    tint: "#2fb79a",
    baseMood: "peaceful",
    encounters: [],
    winsToComplete: 0,
    npcs: [
      {
        id: "sylve",
        name: "Sylve",
        title: "Gardienne de la clairière",
        emoji: "🧝‍♀️",
        tint: "#5bbf8a",
        role: "mentor",
        lines: [
          "« Te voilà enfin. J'ai senti ta venue dans le bruissement des feuilles. »",
          "« Chaque dresseur commence ici, avec un seul compagnon. Le tien t'attend. »",
          "« Va vers l'est, la Vallée Sauvage. Bats-toi, encore et encore — elle te livrera ses secrets. »",
        ],
      },
      {
        id: "perle",
        name: "Perle",
        title: "Marchande ambulante",
        emoji: "🧕",
        tint: "#e0a34a",
        role: "merchant",
        lines: [
          "« Une potion, dresseur ? Ça remet d'aplomb un Auto Monster amoché. »",
          "« Mes fioles viennent des sources chaudes. Efficacité garantie. »",
        ],
      },
      {
        id: "soin",
        name: "Fontaine de soin",
        title: "Source claire",
        emoji: "⛲",
        tint: "#4aa6e0",
        role: "healer",
        lines: [
          "« Confie tes compagnons à l'eau vive. Elle les remet sur pied en un instant. »",
        ],
      },
      {
        id: "boris",
        name: "Boris",
        title: "Éleveur du ranch",
        emoji: "🧑‍🌾",
        tint: "#c98a5a",
        role: "ranch",
        lines: [
          "« Besoin de renfort ? Je loue mes bêtes pour quelques combats, pas plus. »",
          "« Traite-les bien, elles te le rendront. »",
        ],
      },
    ],
  },
  {
    id: "vallee",
    name: "Vallée Sauvage",
    subtitle: "Terres foisonnantes à explorer, combat après combat.",
    x: 560,
    y: 300,
    icon: "🍃",
    tint: "#56b96f",
    baseMood: "exploration",
    encounters: ["moss", "windy", "scree", "cloud"],
    winsToComplete: 10,
    unlocks: "cimes",
    wildNpcs: [
      {
        id: "voyageuse",
        name: "Nima",
        title: "Voyageuse",
        emoji: "🧗‍♀️",
        tint: "#a06fc9",
        role: "lore",
        lines: [
          "« Gravelmaw ? Ce monstre est increvable… ses blessures restent d'un combat à l'autre. »",
          "« Plus tu explores cette vallée, plus tu la comprends. Ne lâche rien. »",
        ],
      },
    ],
    npcs: [
      {
        id: "voyageuse",
        name: "Nima",
        title: "Voyageuse",
        emoji: "🧗‍♀️",
        tint: "#a06fc9",
        role: "lore",
        lines: [
          "« La vallée est apaisée maintenant. On respire. »",
          "« Les Cimes, là-haut, grondent encore. Sois prudent. »",
        ],
      },
    ],
  },
  {
    id: "cimes",
    name: "Cimes Orageuses",
    subtitle: "Un colosse de pierre menace les hauteurs.",
    x: 940,
    y: 200,
    icon: "⛰️",
    tint: "#7b83e0",
    baseMood: "threatened",
    encounters: ["lair"],
    winsToComplete: 1,
    boss: "lair",
    wildNpcs: [
      {
        id: "guetteur",
        name: "Orn",
        title: "Guetteur affolé",
        emoji: "🧙‍♂️",
        tint: "#c95a5a",
        role: "lore",
        lines: [
          "« Il est là-haut ! Gravelmaw écrase tout sur son passage ! »",
          "« Toi seul peux l'arrêter. Les Cimes comptent sur toi. »",
        ],
      },
    ],
    npcs: [
      {
        id: "orn",
        name: "Orn",
        title: "Marchand des cimes",
        emoji: "🧙‍♂️",
        tint: "#7d7fb3",
        role: "merchant",
        lines: [
          "« Le colosse est tombé. Le calme est revenu sur les Cimes. »",
          "« Reste un peu — j'ai de quoi ravitailler les héros. »",
        ],
      },
      {
        id: "orn-lore",
        name: "Nima",
        title: "Voyageuse",
        emoji: "🧗‍♀️",
        tint: "#a06fc9",
        role: "lore",
        lines: [
          "« Tu as pacifié les trois zones. La légende, c'est toi maintenant. »",
        ],
      },
    ],
  },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;
export const encounterById = (id: string) => MAP_LOCATIONS.find((l) => l.id === id)!;
export const START_ZONE = "clairiere";

/** Chemins reliant les zones (décor de la carte du monde). */
export const ZONE_PATHS: [string, string][] = [
  ["clairiere", "vallee"],
  ["vallee", "cimes"],
];
