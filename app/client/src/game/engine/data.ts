// Données statiques du jeu : espèces (auto monsters + bestioles), map, loot.

import type { SpeciesDef, Stats, InteractKind, Personality } from "./types";

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
    desc: "Petite salamandre de braise née dans les cheminées volcaniques. Vive et impétueuse, elle frappe fort mais encaisse mal. On dit que sa flamme dorsale reflète son humeur.",
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
    desc: "Créature des sources froides à la carapace gorgée d'eau. Lente mais robuste, elle absorbe les coups avec une patience minérale. Calme en apparence, fidèle à qui la respecte.",
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
    desc: "Renardeau de feuilles vives, le plus rapide des trois starters. Joueur et curieux, il esquive plus qu'il n'encaisse. Difficile à canaliser, mais redoutable bien entraîné.",
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
    desc: "Feu follet d'âme errante, rare et insaisissable. Se régénère en flottant entre les mondes. Mystérieux, il ne se lie qu'aux dresseurs patients et observateurs.",
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
    desc: "Galet vivant aux dents de pierre, tapi sur les sentiers rocailleux.",
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
    desc: "Oisillon criard et nerveux qui fond sur les imprudents.",
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
    desc: "Bourgeon mobile et têtu qui s'agite dans les fougères.",
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
    desc: "Nuée électrique qui tourbillonne sur les crêtes venteuses.",
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
    desc: "Colosse de roche et de mâchoires, gardien de l'antre. Increvable : ses blessures persistent d'un combat à l'autre.",
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
  { speciesId: "leafkit", level: 4, price: 20, fights: 3 },
  { speciesId: "willowisp", level: 6, price: 45, fights: 3 },
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
    tint: "#5bbf8a",
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
    tint: "#6fae4f",
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
    tint: "#7d7fb3",
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
