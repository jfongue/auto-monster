// État de jeu persisté. Sérialisable en JSON.
// Grande carte à lieux libres : le joueur a une position (playerLoc) et se déplace.

import type { Character } from "./engine/types";
import { COMBAT_LOCATIONS, START_LOC, makePersonality, MOOD_START } from "./engine/data";

export const GAME_VERSION = 4;

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
  playerLoc: string; // lieu où se trouve le joueur
  rental: Rental | null; // monstre loué au ranch
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
    rental: null,
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
    bossLife: s.bossLife ?? {},
    cleared: s.cleared ?? [],
    version: GAME_VERSION,
  };
}

export const isLocationCleared = (s: GameState, id: string) => s.cleared.includes(id);
export const allCleared = (s: GameState) => COMBAT_LOCATIONS.every((l) => s.cleared.includes(l.id));
