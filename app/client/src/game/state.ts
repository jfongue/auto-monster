// État de jeu persisté. Sérialisable en JSON.
// Monde à zones : le joueur voyage entre des zones (playerZone), explore,
// fait grimper un taux de complétion, débloque de nouvelles zones et un boss.

import type { Character } from "./engine/types";
import { COMBAT_LOCATIONS, START_LOC, makePersonality, MOOD_START, START_ZONE, zoneById } from "./engine/data";

export const GAME_VERSION = 5;

/** Monstre loué au ranch : un Character + nb de combats restants. */
export type Rental = { char: Character; fightsLeft: number };

export type GameState = {
  version: number;
  started: boolean; // a adopté un premier AM
  team: Character[]; // auto monsters possédés
  gold: number;
  potions: number;
  cleared: string[]; // ids des lieux de combat déjà vaincus (récompense unique)
  bossLife: Record<string, number>; // PV persistants des boss entamés, par lieu
  capturedRare: boolean;
  playerLoc: string; // (compat) lieu de combat courant dans la zone
  playerZone: string; // zone où se trouve le joueur
  rental: Rental | null; // monstre loué au ranch
  // ── Refonte "monde à zones" ──
  bestiary: string[]; // ids d'espèces rencontrées (bestiaire / pokédex)
  zoneProgress: Record<string, number>; // victoires cumulées par zone
  zonesUnlocked: string[]; // zones accessibles sur la carte
  bossDefeated: string[]; // ids de zones dont le boss est vaincu (→ paisibles)
};

export function freshState(): GameState {
  return {
    version: GAME_VERSION,
    started: false,
    team: [],
    gold: 0,
    potions: 0,
    cleared: [],
    bossLife: {},
    capturedRare: false,
    playerLoc: START_LOC,
    playerZone: START_ZONE,
    rental: null,
    bestiary: [],
    zoneProgress: {},
    zonesUnlocked: [START_ZONE, "vallee"],
    bossDefeated: [],
  };
}

/** Backfill des champs d'identité individuelle sur un Character chargé. */
function migrateChar(c: Character): Character {
  if (c.personality && c.capturedAt) return c;
  return {
    ...c,
    capturedAt: c.capturedAt ?? Date.now(),
    personality: c.personality ?? makePersonality(),
    mood: c.mood ?? MOOD_START,
    history: c.history ?? [{ t: Date.now(), kind: "capture", text: "Rejoint l'équipe." }],
    lastInteract: c.lastInteract ?? {},
  };
}

/** Normalise un état chargé (compat anciennes versions). */
export function migrate(s: Partial<GameState> | null | undefined): GameState {
  const base = freshState();
  if (!s) return base;
  return {
    ...base,
    ...s,
    team: (s.team ?? []).map(migrateChar),
    rental: s.rental ? { ...s.rental, char: migrateChar(s.rental.char) } : null,
    playerLoc: s.playerLoc ?? START_LOC,
    playerZone: s.playerZone ?? START_ZONE,
    bossLife: s.bossLife ?? {},
    cleared: s.cleared ?? [],
    bestiary: s.bestiary ?? [],
    zoneProgress: s.zoneProgress ?? {},
    zonesUnlocked: s.zonesUnlocked && s.zonesUnlocked.length ? s.zonesUnlocked : base.zonesUnlocked,
    bossDefeated: s.bossDefeated ?? [],
    version: GAME_VERSION,
  };
}

export const isLocationCleared = (s: GameState, id: string) => s.cleared.includes(id);
export const allCleared = (s: GameState) => COMBAT_LOCATIONS.every((l) => s.cleared.includes(l.id));

// ── Complétion & état des zones ──────────────────────────────────────────────

const UNLOCK_THRESHOLD = 0.75; // 75% → débloque la zone suivante

/** Taux de complétion 0..1 d'une zone (victoires cumulées / objectif). */
export function zoneCompletion(s: GameState, zoneId: string): number {
  const z = zoneById(zoneId);
  const target = z.winsToComplete || 1;
  const wins = s.zoneProgress[zoneId] ?? 0;
  return Math.max(0, Math.min(1, wins / target));
}

/** Le boss de la zone est-il vaincu → zone pacifiée ? */
export const isZonePacified = (s: GameState, zoneId: string): boolean =>
  s.bossDefeated.includes(zoneId);

/** État courant d'une zone selon la progression. */
export function zoneMood(s: GameState, zoneId: string): "peaceful" | "exploration" | "threatened" {
  const z = zoneById(zoneId);
  if (z.baseMood === "peaceful") return "peaceful";
  if (z.baseMood === "threatened") return isZonePacified(s, zoneId) ? "peaceful" : "threatened";
  // exploration : reste exploration (elle se "termine" mais reste explorable)
  return "exploration";
}

/** Une zone est-elle accessible sur la carte ? */
export const isZoneUnlocked = (s: GameState, zoneId: string): boolean =>
  s.zonesUnlocked.includes(zoneId);

/**
 * Enregistre une victoire dans une zone : incrémente la complétion et
 * débloque la zone suivante au passage du seuil. Renvoie le nouvel état.
 */
export function registerZoneWin(s: GameState, zoneId: string): GameState {
  const z = zoneById(zoneId);
  const wins = (s.zoneProgress[zoneId] ?? 0) + 1;
  const next: GameState = { ...s, zoneProgress: { ...s.zoneProgress, [zoneId]: wins } };
  if (z.unlocks && wins / (z.winsToComplete || 1) >= UNLOCK_THRESHOLD && !next.zonesUnlocked.includes(z.unlocks)) {
    next.zonesUnlocked = [...next.zonesUnlocked, z.unlocks];
  }
  return next;
}

/** Ajoute une espèce au bestiaire (sans doublon). */
export function recordBestiary(s: GameState, speciesId: string): GameState {
  if (s.bestiary.includes(speciesId)) return s;
  return { ...s, bestiary: [...s.bestiary, speciesId] };
}
