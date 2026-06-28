// F2 — Modèle de données 3 niveaux (GDD v0.3, sans éléments, 5 stats génériques).

/** Les 5 stats de base. */
export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spd: number; // vitesse → pilote la file chronométrique (F4)
  sta: number; // stamina → ressource des talents (F8)
};

export type StatKey = keyof Stats;

/** Rareté d'un auto monster / d'une bestiole. */
export type Rarity = "common" | "rare" | "boss";

/**
 * F2 niveau 1 — Définition d'espèce (data statique).
 * Partagée par tous les exemplaires d'une même famille.
 */
export type SpeciesDef = {
  id: string;
  name: string;
  /** créature jouable (auto monster) ou simple bestiole ennemie */
  kind: "automonster" | "bestiole";
  rarity: Rarity;
  gfx: string; // clé d'asset (ex: "flameling" → /sprites/flameling.png)
  size: number; // échelle d'affichage (100 = normal)
  baseStats: Stats;
  /** Talent signature inné, toujours présent (GDD 4.1). Id de talent. */
  innate: string | null;
  /** Palette de talents apprenables aux paliers (GDD 4.3). */
  talentPool: string[];
  tint: string; // couleur placeholder/aura
};

/**
 * F2 niveau 2 — Character : monstre possédé, persisté, plat.
 */
export type Character = {
  id: string;
  speciesId: string;
  name: string;
  level: number;
  xp: number;
  /** PV courants persistés entre combats (soins) */
  life: number;
  /** stats effectives = base + bonus de packs choisis aux level-ups */
  stats: Stats;
  /** talents acquis (ids), max 3 hors inné (GDD 4.3) */
  talents: string[];
  /** timestamp (ms) du début d'un soin progressif en cours ; null = pas de soin */
  healStart?: number | null;
};

/** F6 — un talent = hooks enregistrés sur le Fighter. */
export type AttackInfo = {
  attacker: Fighter;
  target: Fighter;
  /** dégâts (mutable par les hooks défensifs) */
  damage: number;
};

export type TurnHook = (f: Fighter, mgr: CombatManager) => void;

export type FighterHooks = {
  /** modifie les dégâts reçus (bouclier, réduction…) F5.10 */
  defenses: ((info: AttackInfo) => void)[];
  /** après avoir infligé une attaque */
  afterAttack: ((info: AttackInfo) => void)[];
  /** proc au début du tour du combattant (régén, buff…) F6 events */
  onTurn: TurnHook[];
};

/** Interface minimale exposée aux talents pendant le combat (F6). */
export type CombatManager = {
  emit(a: Action): void;
  rng: import("./rng").Rng;
};

/**
 * F2 niveau 3 — Fighter : runtime, dérivé à l'init, jeté en fin de combat.
 */
export type Fighter = {
  fid: number;
  side: 0 | 1;
  name: string;
  gfx: string;
  size: number;
  tint: string;
  level: number;
  // stats runtime
  maxLife: number;
  life: number;
  startLife: number;
  atk: number;
  def: number;
  spd: number;
  maxSta: number;
  sta: number;
  // bonus mutables par les talents/skills
  atkBonus: number; // additif au score d'attaque (F5.1)
  atkMult: number; // multiplicateur du prochain assaut (F5.2)
  dodge: number; // % esquive (F5.8)
  // file chronométrique (F4)
  time: number;
  timeMultiplier: number;
  // capacités / talents
  talents: string[];
  hooks: FighterHooks;
};

// ───────────────────────────────────────────────────────────────────────────
// F9 — Journal d'actions (ActionLog) : union discriminée sérialisable.
// Unique sortie du moteur, consommée par le renderer (F10).
// ───────────────────────────────────────────────────────────────────────────
export type Action =
  | { t: "add"; fid: number; name: string; gfx: string; side: 0 | 1; life: number; maxLife: number; size: number; tint: string; level: number }
  | { t: "display" }
  | { t: "announce"; fid: number; text: string }
  | { t: "goto"; fid: number; tid: number }
  | { t: "return"; fid: number }
  | { t: "damage"; fid: number; tid: number; life: number; crit: boolean }
  | { t: "dodge"; fid: number; tid: number }
  | { t: "lost"; fid: number; life: number }
  | { t: "regen"; fid: number; life: number }
  | { t: "dead"; fid: number }
  | { t: "text"; text: string }
  | { t: "pause"; time: number }
  | { t: "timeLimit" }
  | { t: "finish"; winner: 0 | 1 | null };

export type CombatRules = {
  /** limite de tours anti-combat-infini → égalité (F4) */
  maxTurns: number;
};

export type CombatInput = {
  seed: number;
  teamA: Character[]; // joueur (side 0)
  teamB: Character[]; // ennemis (side 1)
  rules?: Partial<CombatRules>;
};

/** F16 — stats par combattant, cohérentes avec le log. */
export type FightStat = {
  fid: number;
  name: string;
  side: 0 | 1;
  damageDealt: number;
  damageTaken: number;
  survived: boolean;
  lifeLeft: number;
  maxLife: number;
};

export type CombatResult = {
  log: Action[];
  winner: 0 | 1 | null; // null = égalité / timeout
  stats: FightStat[];
};
