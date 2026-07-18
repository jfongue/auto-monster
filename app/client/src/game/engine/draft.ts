// T008 — Level-up par draft de Traits (GDD 4.3).
//
// À chaque niveau gagné (Character.traitPoints, cf progression.ts addXp), on propose
// un tirage de 2-3 cartes parmi :
//   1. Améliorer un Trait possédé (niv 1→2→3, pondéré : palier haut = plus rare).
//   2. Acquérir un nouveau Trait du pool de l'espèce (slot actif libre, ou le
//      passif si aucun n'est encore équipé).
//   3. Améliorer un AUTRE Trait possédé — proposée seulement si l'AM a au moins
//      3 Traits non-maxés ; sinon ce slot est remplacé par une autre nouvelle carte.

import type { Character, SpeciesDef, EquippedTrait } from "./types";
import { ACTIVE_TRAITS, PASSIVE_TRAITS } from "./traits";
import type { Rng } from "./rng";

export type DraftOption =
  | { kind: "upgradeActive"; id: string; fromLevel: 1 | 2; toLevel: 2 | 3 }
  | { kind: "upgradePassive"; id: string; fromLevel: 1 | 2; toLevel: 2 | 3 }
  | { kind: "newActive"; id: string }
  | { kind: "newPassive"; id: string };

/** Poids d'apparition d'une amélioration selon le palier VISÉ (palier haut = plus rare). */
const UPGRADE_WEIGHT: Record<2 | 3, number> = { 2: 10, 3: 3 };

function upgradeCandidates(c: Character): DraftOption[] {
  const out: DraftOption[] = [];
  for (const t of c.activeTraits ?? []) {
    if (t.level < 3) out.push({ kind: "upgradeActive", id: t.id, fromLevel: t.level as 1 | 2, toLevel: (t.level + 1) as 2 | 3 });
  }
  if (c.passiveTrait && c.passiveTrait.level < 3) {
    const p = c.passiveTrait;
    out.push({ kind: "upgradePassive", id: p.id, fromLevel: p.level as 1 | 2, toLevel: (p.level + 1) as 2 | 3 });
  }
  return out;
}

function newCandidates(c: Character, sp: SpeciesDef): DraftOption[] {
  const pool = sp.traitPool ?? [];
  const ownedActive = new Set((c.activeTraits ?? []).map((t) => t.id));
  const ownedPassiveId = c.passiveTrait?.id;
  const activeSlotsOpen = (c.activeTraits?.length ?? 0) < 3;
  const passiveSlotOpen = !ownedPassiveId;
  const out: DraftOption[] = [];
  for (const id of pool) {
    if (ACTIVE_TRAITS[id]) {
      if (activeSlotsOpen && !ownedActive.has(id)) out.push({ kind: "newActive", id });
    } else if (PASSIVE_TRAITS[id]) {
      if (passiveSlotOpen && id !== ownedPassiveId) out.push({ kind: "newPassive", id });
    }
  }
  return out;
}

function weightOf(o: DraftOption): number {
  return o.kind === "upgradeActive" || o.kind === "upgradePassive" ? UPGRADE_WEIGHT[o.toLevel] : 1;
}

/** Tire un élément pondéré (poids relatifs, pas besoin qu'ils totalisent 1). */
function pickWeighted(rng: Rng, items: DraftOption[]): DraftOption | undefined {
  if (items.length === 0) return undefined;
  const weights = items.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[rng.int(items.length)];
  let r = rng.float(total);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const idOf = (o: DraftOption) => o.id;

/**
 * Génère un tirage de `count` cartes (2-3) pour un Character qui monte de niveau.
 * Déterministe pour un même `rng` (seedé par l'appelant).
 */
export function generateDraft(c: Character, sp: SpeciesDef, rng: Rng, count = 3): DraftOption[] {
  const out: DraftOption[] = [];
  const used = new Set<string>();
  const upgrades = upgradeCandidates(c);
  const news = newCandidates(c, sp);
  const nonMaxedCount = upgrades.length;

  // 1) une amélioration d'un Trait possédé, si possible.
  const u1 = pickWeighted(rng, upgrades);
  if (u1) { out.push(u1); used.add(idOf(u1)); }

  // 2) un nouveau Trait du pool, si possible.
  const n1 = pickWeighted(rng, news.filter((o) => !used.has(idOf(o))));
  if (n1) { out.push(n1); used.add(idOf(n1)); }

  // 3) règle des 3 : 2e amélioration SEULEMENT si ≥3 Traits non-maxés, sinon 2e nouvelle carte.
  let third: DraftOption | undefined;
  if (nonMaxedCount >= 3) {
    third = pickWeighted(rng, upgrades.filter((o) => !used.has(idOf(o))));
  }
  if (!third) third = pickWeighted(rng, news.filter((o) => !used.has(idOf(o))));
  if (!third) third = pickWeighted(rng, upgrades.filter((o) => !used.has(idOf(o))));
  if (third) { out.push(third); used.add(idOf(third)); }

  // complète jusqu'à `count` si le pool le permet (rare, espèces au pool très large).
  while (out.length < count) {
    const remN = news.filter((o) => !used.has(idOf(o)));
    const remU = upgrades.filter((o) => !used.has(idOf(o)));
    const extra = pickWeighted(rng, remN) ?? pickWeighted(rng, remU);
    if (!extra) break;
    out.push(extra);
    used.add(idOf(extra));
  }
  return out;
}

/** Applique un choix de draft : upgrade un Trait équipé, ou en ajoute un nouveau. Décrémente traitPoints. */
export function applyDraftChoice(c: Character, choice: DraftOption): Character {
  const traitPoints = Math.max(0, (c.traitPoints ?? 0) - 1);
  if (choice.kind === "upgradeActive") {
    const activeTraits = (c.activeTraits ?? []).map((t) => (t.id === choice.id ? { ...t, level: choice.toLevel } : t));
    return { ...c, activeTraits, traitPoints };
  }
  if (choice.kind === "upgradePassive") {
    const passiveTrait: EquippedTrait | undefined = c.passiveTrait && c.passiveTrait.id === choice.id ? { ...c.passiveTrait, level: choice.toLevel } : c.passiveTrait;
    return { ...c, passiveTrait, traitPoints };
  }
  if (choice.kind === "newActive") {
    const activeTraits = [...(c.activeTraits ?? []), { id: choice.id, level: 1 as const }];
    return { ...c, activeTraits, traitPoints };
  }
  // newPassive
  return { ...c, passiveTrait: { id: choice.id, level: 1 }, traitPoints };
}

/** Libellé + icône affichables d'une option de draft (UI). */
export function draftLabel(o: DraftOption): { icon: string; name: string; kindLabel: string; desc: string } {
  if (o.kind === "upgradeActive") {
    const d = ACTIVE_TRAITS[o.id];
    return { icon: d.icon, name: d.name, kindLabel: "Amélioration", desc: `Niveau ${o.fromLevel} → ${o.toLevel}` };
  }
  if (o.kind === "upgradePassive") {
    const d = PASSIVE_TRAITS[o.id];
    return { icon: d.icon, name: d.name, kindLabel: "Amélioration", desc: `Niveau ${o.fromLevel} → ${o.toLevel}` };
  }
  if (o.kind === "newActive") {
    const d = ACTIVE_TRAITS[o.id];
    return { icon: d.icon, name: d.name, kindLabel: "Nouveau Trait actif", desc: "Niveau 1" };
  }
  const d = PASSIVE_TRAITS[o.id];
  return { icon: d.icon, name: d.name, kindLabel: "Nouveau Trait passif", desc: "Niveau 1" };
}
