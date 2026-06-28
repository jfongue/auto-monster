// État de jeu persisté (équipe, or, lieux nettoyés, boss). Sérialisable en JSON.
// Carte à lieux libres : pas d'ordre imposé.

import type { Character } from "./engine/types";
import { MAP_LOCATIONS } from "./engine/data";

export const GAME_VERSION = 2;

export type GameState = {
  version: number;
  started: boolean; // a adopté un premier AM
  team: Character[]; // auto monsters possédés
  gold: number;
  potions: number;
  cleared: string[]; // ids des lieux déjà vaincus (récompense unique)
  bossLife: Record<string, number>; // PV persistants des boss entamés, par lieu
  capturedRare: boolean;
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
  };
}

export const isLocationCleared = (s: GameState, id: string) => s.cleared.includes(id);
export const allCleared = (s: GameState) => MAP_LOCATIONS.every((l) => s.cleared.includes(l.id));
