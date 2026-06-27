// État de jeu persisté (équipe, or, avancée map, boss). Sérialisable en JSON.

import type { Character } from "./engine/types";
import { MAP_STEPS } from "./engine/data";

export const GAME_VERSION = 1;

export type GameState = {
  version: number;
  started: boolean; // a adopté un premier AM
  team: Character[]; // auto monsters possédés
  active: number; // index de l'AM actif (combat 1v1 ; prêt pour +)
  gold: number;
  potions: number;
  stepIndex: number; // prochaine étape à jouer (0..5 ; 5 = map terminée)
  bossLife: number | null; // PV persistants du boss entre parties
  capturedRare: boolean;
};

export function freshState(): GameState {
  return {
    version: GAME_VERSION,
    started: false,
    team: [],
    active: 0,
    gold: 0,
    potions: 0,
    stepIndex: 0,
    bossLife: null,
    capturedRare: false,
  };
}

export const isMapComplete = (s: GameState) => s.stepIndex >= MAP_STEPS.length;
export const activeChar = (s: GameState): Character | undefined => s.team[s.active];
