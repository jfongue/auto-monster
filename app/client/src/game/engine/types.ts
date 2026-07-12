// F2 — Modèle de données 3 niveaux (GDD v0.3, sans éléments, 5 stats génériques).

/** Les 4 stats de base (la stamina a été retirée en v0.20 : jamais utilisée). */
export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spd: number; // vitesse → pilote la file chronométrique (F4) + esquive
};

export type StatKey = keyof Stats;

/** Rareté d'un auto monster / d'une bestiole. */
export type Rarity = "common" | "rare" | "boss";

// ── Altérations d'état (F7) : dégâts sur la durée (poison, brûlure…) ──────────
export type StatusKind = "poison" | "burn";
/** Une altération active sur un Fighter : dégâts par tick, tours restants. */
export type StatusEntry = { kind: StatusKind; dmg: number; turns: number; icon: string };

/**
 * Une branche de spécialisation d'un auto monster (GDD 4.2/4.3).
 * Le joueur en choisit UNE à `BRANCH_CHOICE_LEVEL` ; ses talents se débloquent
 * ensuite par paliers de niveau. Deux branches par espèce = deux playstyles.
 */
export type BranchTier = { level: number; talent: string };
export type BranchDef = {
  id: string;
  name: string;
  icon: string;
  /** Résumé du style de jeu de la branche (une phrase). */
  desc: string;
  /** Talents débloqués aux paliers (triés par niveau croissant). */
  tiers: BranchTier[];
};

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
  /** Palette de talents apprenables aux paliers (GDD 4.3, legacy/éditeur). */
  talentPool: string[];
  /** Deux branches de spécialisation (GDD 4.2). Absent = pas de branches. */
  branches?: BranchDef[];
  tint: string; // couleur placeholder/aura
  /** Descriptif de l'espèce (lore affiché sur la fiche). */
  desc: string;
  /** Peut-on la rencontrer en combat PvE sauvage (Forêt) ? Éditable via l'éditeur d'espèces. */
  wildEncounterable: boolean;
};

/** Action d'interaction sociale possible avec un AM. */
export type InteractKind = "caresser" | "coacher" | "observer";

/**
 * Caractère UNIQUE d'un individu (pas de l'espèce). Généré à la capture.
 * Les affinités biaisent l'issue de chaque interaction (-1 hostile → +1 adore).
 */
export type Personality = {
  archetype: string; // ex: "Affectueux", "Sauvage"
  emoji: string;
  blurb: string; // courte description de l'individu
  affinity: Record<InteractKind, number>; // -1..+1
};

/** Entrée d'historique (combats menés, interactions, jalons). */
export type HistoryEntry = {
  t: number; // timestamp
  kind: "capture" | "combat" | "interact" | "levelup";
  text: string;
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
  /** branche de spécialisation choisie (id) ; null/absent = pas encore choisie */
  branch?: string | null;
  /** timestamp (ms) du début d'un soin progressif en cours ; null = pas de soin */
  healStart?: number | null;
  // ── Identité individuelle (AM possédés ; absent pour les ennemis) ──
  /** timestamp de capture/adoption */
  capturedAt?: number;
  /** caractère unique de cet individu */
  personality?: Personality;
  /** humeur courante 0..100 (impacte légèrement le combat) */
  mood?: number;
  /** journal de l'individu (combats, interactions…) */
  history?: HistoryEntry[];
  /** dernier usage de chaque interaction (cooldown), par type */
  lastInteract?: Partial<Record<InteractKind, number>>;
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
  /** quand ce combattant ESQUIVE une attaque (riposte, élan…) */
  onDodge: ((self: Fighter, attacker: Fighter, mgr: CombatManager) => void)[];
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
  // ── état de branches / altérations (réglé par les talents à l'init) ──
  statuses: StatusEntry[]; // altérations actives sur ce combattant (poison, brûlure)
  critChance: number; // % de coup critique (0 = jamais) — Frénésie, etc.
  critMult: number; // multiplicateur d'un critique
  lifesteal: number; // 0..1 : fraction des dégâts infligés récupérée en PV (Ponction)
  ampVsStatus: Partial<Record<StatusKind, number>>; // ×dégâts contre une cible affligée (Pyromane/Virulence)
  onHitStatus: StatusEntry | null; // altération infligée à la cible quand on la frappe (Embrasement/Inoculation)
  poisonOnHurt: StatusEntry | null; // altération infligée à l'attaquant quand on est touché (Spores)
  rageOnCrit: number; // +Force (fraction de l'atk de base) gagnée à chaque critique (Fournaise)
  regenLowMult: number; // multiplicateur de régén sous 40% PV (Second souffle)
  riposte: boolean; // contre-attaque à l'esquive (Riposte)
  riposteCrit: boolean; // les ripostes sont des critiques (Contre parfait)
  dodgeAtkGain: number; // +Force (fraction) gagnée à chaque esquive (Élan)
  dodgeSnowball: boolean; // chaque esquive augmente aussi esquive + vitesse (Danse du vent)
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
  | { t: "talentProc"; fid: number; talent: string; label: string }
  | { t: "dodge"; fid: number; tid: number }
  | { t: "status"; fid: number; kind: StatusKind; label: string }
  | { t: "statusTick"; fid: number; kind: StatusKind; life: number; dmg: number }
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
