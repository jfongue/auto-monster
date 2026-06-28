// État de jeu persisté. Sérialisable en JSON.
// Grande carte à lieux libres : le joueur a une position (playerLoc) et se déplace.

import type { Character } from "./engine/types";
import { COMBAT_LOCATIONS, START_LOC } from "./engine/data";

export const GAME_VERSION = 3;

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

/** Normalise un état chargé (compat anciennes versions). */
export function migrate(s: Partial<GameState> | null | undefined): GameState {
  const base = freshState();
  if (!s) return base;
  return {
    ...base,
    ...s,
    playerLoc: s.playerLoc ?? START_LOC,
    bossLife: s.bossLife ?? {},
    cleared: s.cleared ?? [],
    rental: s.rental ?? null,
    version: GAME_VERSION,
  };
}

export const isLocationCleared = (s: GameState, id: string) => s.cleared.includes(id);
export const allCleared = (s: GameState) => COMBAT_LOCATIONS.every((l) => s.cleared.includes(l.id));
