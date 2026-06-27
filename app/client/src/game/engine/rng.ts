// F1 — RNG seedé déterministe (mulberry32). Jamais Math.random() dans le moteur.

export type Rng = {
  /** flottant [0,1) */
  next(): number;
  /** entier [0,n) */
  int(n: number): number;
  /** flottant [0,max) */
  float(max: number): number;
  /** true avec probabilité pct (0-100) */
  chance(pct: number): boolean;
  /** état courant (debug/replay) */
  state(): number;
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    float: (max: number) => next() * max,
    chance: (pct: number) => next() * 100 < pct,
    state: () => a >>> 0,
  };
}
