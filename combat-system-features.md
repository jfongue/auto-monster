# Système de combat — Spécifications par feature

Inspiré de l'architecture de combat de DinoRPG (Motion-Twin). Ce document découpe le système en **features autonomes**, chacune avec son objectif, son modèle de données, son comportement et ses critères d'acceptation. Pensé pour une implémentation web/mobile en TypeScript, testable en headless et facile à itérer.

---

## Principe directeur

L'architecture repose sur une **séparation stricte en deux couches**, reliées par un seul artefact : le **journal d'actions** (`ActionLog`).

```
┌─────────────────┐     ActionLog[]     ┌──────────────────┐
│  MOTEUR (logique)│ ──────────────────> │ RENDERER (visuel) │
│  pur, déterministe│   liste d'events    │  rejoue, "bête"   │
└─────────────────┘                      └──────────────────┘
```

- Le **moteur** calcule l'intégralité du combat d'un coup, sans aucun rendu, et produit une liste ordonnée d'événements.
- Le **renderer** ne calcule rien : il rejoue cette liste comme une animation séquentielle.

Conséquences : le moteur est testable à 100 % en headless, n'importe quel combat est rejouable depuis son seed, et on peut développer logique et visuel indépendamment.

### Phasage recommandé

| Phase | Features | But |
|-------|----------|-----|
| **MVP** | F1, F2, F3, F4, F5, F9, F10, F11 | Un combat 1v1 jouable et animé |
| **V1** | F6, F7, F8, F12, F13, F14, F15 | Skills, statuts, effets visuels, équipes |
| **V2** | F16, F17, F18 | Récompenses, invocations, PvP/château |
| **Transverse** | F19, F20 | Tests déterministes, outils de debug |

---

# COUCHE MOTEUR (logique de combat)

## F1 — Architecture moteur déterministe

**Objectif.** Un moteur pur qui, pour des mêmes entrées + seed, produit toujours le même `ActionLog`.

**Données.**
```ts
type CombatInput = {
  seed: number;
  teamA: Character[];   // attaquants
  teamB: Character[];   // défenseurs
  rules?: CombatRules;  // énergie activée ?, limite de tours, etc.
};
type CombatResult = {
  log: Action[];        // le journal rejouable
  winner: 0 | 1 | null; // null = égalité/timeout
  stats: FightStat[];   // dégâts infligés, XP, etc.
};
```

**Comportement.**
- RNG seedé maison (ex. `mulberry32`), **jamais** `Math.random()`. Toute aléa passe par cette source.
- `runCombat(input): CombatResult` exécute la boucle complète sans I/O ni rendu.
- Aucune dépendance au DOM, au temps réel ou aux assets.

**Critères d'acceptation.**
- Deux appels avec le même seed produisent des `log` strictement identiques (égalité profonde).
- Le moteur tourne en Node sans navigateur.

---

## F2 — Modèle de données des personnages

**Objectif.** Trois niveaux de modèle, du déclaratif au runtime.

**Données.**
```ts
// 1. Définition d'espèce / famille (data statique, éditable à la main)
type SpeciesDef = {
  id: string;
  name: string;
  baseElements: [number, number, number, number, number]; // [Feu,Bois,Eau,Foudre,Air]
  levelup: [number, number, number, number, number];       // % de répartition par level
  skills: string[];        // ids de skills innés
  gfx: string;             // clé d'asset visuel
  size?: number;           // échelle d'affichage (100 = normal)
};

// 2. Personnage instancié (persistable)
type Character = {
  id: string;
  speciesId: string;
  name: string;
  level: number;
  xp: number;
  life: number;
  maxLife: number;
  elements: [number, number, number, number, number];
  skills: string[];
  equip?: string[];        // objets équipés (optionnel)
  gfx: string;
};

// 3. Combattant runtime (dérivé à l'init du combat — voir F3 à F8)
type Fighter = Character & {
  fid: number;
  side: 0 | 1;
  startLife: number;
  defense: number[];       // 6 valeurs, dérivées des elements
  elementsOrder: number[]; // cycle d'éléments du tour
  time: number;            // file chronométrique (F4)
  /* + bonus, énergie, statuts, hooks… ajoutés par les features suivantes */
  hooks: FighterHooks;     // callbacks de skills (F6)
};
```

**Comportement.**
- L'entrée d'un combat reste **plate et minimale** : un personnage ≈ 8 champs + une liste de skills par id.
- Tout le reste (défense, ordre des éléments, bonus) est **dérivé** au démarrage du combat, jamais stocké.

**Critères d'acceptation.**
- On peut écrire un `Character` à la main en quelques lignes pour tester un combat.
- `buildFighter(character, side)` produit un `Fighter` complet sans effets de bord.

---

## F3 — Système d'éléments

**Objectif.** 6 éléments avec forces/faiblesses circulaires, base du calcul de dégâts et de défense.

**Données.**
```ts
const FIRE = 0, WOOD = 1, WATER = 2, THUNDER = 3, AIR = 4, VOID = 5;
// VOID = neutre, ignore les résistances
```

**Comportement.**
- Chaque combattant porte un vecteur `elements[6]` (puissance par élément) et un vecteur `defense[6]` dérivé.
- Matrice de défense circulaire : chaque élément est fort (×1.5) contre un, faible (×0.5) contre un autre, neutre (×1.0) sinon. `VOID` ignore la matrice.
- `computeDefenses(elements)` produit `defense[6]` à la création du Fighter.
- `elementsOrder` : ordre dans lequel le combattant utilise ses éléments au fil des tours, trié par puissance + léger bruit aléatoire (départage seedé). Les éléments à 0 sont retirés ; fallback sur `VOID`.

**Critères d'acceptation.**
- La matrice est paramétrable en un seul endroit (table de constantes).
- Un combattant tout-feu reçoit plus de dégâts d'une attaque eau et moins d'une attaque bois (selon la table choisie).

---

## F4 — Système de tour chronométrique

**Objectif.** Remplacer le tour-par-tour classique par une **file temporelle** : agit toujours le combattant dont le compteur `time` est le plus bas.

**Données.**
```ts
const TIMEBASE = 10, TIMECOEF = 10;
// fighter.time, fighter.timeMultiplier, fighter.timeMultipliers[6]
```

**Comportement.**
- `time` initial = `curtime + rnd(TIMEBASE) * TIMECOEF` (léger décalage aléatoire par combattant).
- Boucle : sélectionner le `Fighter` avec `time` minimum → il agit → `time += TIMEBASE * TIMECOEF * timeMultiplier * timeMultipliers[élémentCourant]`.
- Un combattant rapide (`timeMultiplier` bas) joue plus souvent.
- L'élément courant avance dans `elementsOrder` après chaque tour (sauf si `lockedElement`).
- Garde-fous : limite de tours / limite de temps pour éviter les combats infinis (émet `timeLimit`).

**Critères d'acceptation.**
- Avec `timeMultiplier` égal, l'ordre d'action alterne équitablement.
- Diviser le `timeMultiplier` d'un combattant par 2 double sa fréquence d'action.

---

## F5 — Résolution des dégâts

**Objectif.** Calculer les dégâts d'une attaque en croisant attaque, défense, éléments et aléa borné.

**Comportement (pipeline).**
1. **Score d'attaque** : base + somme des dégâts par élément + bonus d'assaut (`assaultsBonus[e] + allAssaultsBonus`) ou bonus de puissance selon le type d'attaque.
2. **Multiplicateurs** : `nextAssaultMultiplier * assaultMultiplier`, puis `+ nextAssaultBonus`.
3. **Score de défense** : moyenne pondérée de `defense[e]` par les dégâts élémentaires de l'attaque, `+ armor` (sauf si `cancelArmor`).
4. **Aléa** : `bonus = rnd() * scoreAtt / 3` (≈ ±30 %).
5. **Dégâts** : `life = ceil((scoreAtt + bonus) * GORE − scoreDef)`.
6. **Lissage** : si les deux combattants sont `balanced`, appliquer `life = life^0.6` pour réduire la variance.
7. **Planchers** : `max(life, minDamage)` ; `max(life, minAssaultDamage)` pour un assaut.
8. **Esquive** : assaut esquivé si `rnd(100) < esquive` ; attaque normale esquivée si `rnd(100) < superEsquive` → dégâts à 0.
9. **Immunités** : vol (`_SFly`), intangibilité (`_SIntang`)… annulent selon les capacités de l'attaquant.
10. **Callbacks défensifs** : exécuter `target.hooks.defenses` (peuvent modifier `life`).

**Critères d'acceptation.**
- Le calcul est isolé dans une fonction pure `resolveAttack(attacker, target, attack, rng)`.
- Les bornes (min, esquive, immunités) sont couvertes par des tests unitaires.

---

## F6 — Système de skills (hooks probabilistes)

**Objectif.** Des compétences qui **s'enregistrent** comme callbacks sur le combattant plutôt que via un gros `switch`. Extensible sans toucher au cœur.

**Données.**
```ts
type SkillType = 'permanent' | 'event' | 'attack' | 'special' | 'unique' | 'invocation';

type SkillDef = {
  id: string; name: string; type: SkillType;
  elt: number; elt2?: number;
  level: number; energy: number;
  candisable: boolean;
};

type Hook<T> = { priority: number; proba: number; energy: number; run: T };

type FighterHooks = {
  events:  Hook<() => void>[];                 // effets probabilistes au tour
  attacks: Hook<() => void>[];                 // attaques spéciales probabilistes
  defenses: ((info: AttackInfo) => void)[];    // réactions aux dégâts reçus
  afterAttack: ((info: AttackInfo) => void)[];
  afterDefense: ((info: AttackInfo) => void)[];
  onKill: (() => boolean)[];
  onLost: (() => void)[];
};
```

**Comportement.**
- Une skill = une fonction `apply(fighter, manager)` qui mute le Fighter ou enregistre un hook.
  - *Permanente* : `_force` → `fighter.allAssaultsBonus += 1`.
  - *Événement* : `_colere` → `addEvent({priority:1, proba:20, run: () => { fighter.nextAssaultMultiplier *= 1.25; manager.fx('aura', fighter); }})`.
  - *Invocation* : `_flamch` → `manager.addMonster('flam', fighter.side)`.
- À chaque tour, le moteur : (1) tente les `events` (triés par `priority`, tirés selon `proba`), (2) sinon une `attack` spéciale, (3) sinon l'assaut par défaut.
- Coût en énergie pris en compte si la règle énergie est active (F8).

**Critères d'acceptation.**
- Ajouter une nouvelle skill = un seul fichier/fonction, sans modifier la boucle de combat.
- L'ordre d'exécution respecte `priority` puis `proba` de façon déterministe (RNG seedé).

---

## F7 — Statuts et altérations

**Objectif.** États temporaires modifiant un combattant (poison, vol, intangible, boucliers, buffs…).

**Données.**
```ts
type StatusInfo = {
  id: string;          // 'fly', 'intang', 'poison', 'shield'…
  duration?: number;   // en tours, ou permanent
  data?: any;
  onApply?(f: Fighter): void;
  onTick?(f: Fighter): void;     // émet damage/regen
  onRemove?(f: Fighter): void;
};
// fighter.status: StatusInfo[]
// fighter.restrictions: ('object'|'magicObject'|'effects')[]
```

**Comportement.**
- Application/retrait émettent `status` / `noStatus` dans le log.
- Statuts à effet périodique (poison, régén) déclenchent leurs événements à l'écoulement du temps.
- Certains statuts modifient la résolution (vol = immunise contre attaques au sol, intangible = immunise sauf attaquant adapté).
- Durée décrémentée par le système de temps ; retrait automatique à expiration.

**Critères d'acceptation.**
- Un poison de N tours inflige bien N ticks puis disparaît.
- Le statut `fly` rend la cible intouchable par un attaquant non volant.

---

## F8 — Système d'énergie (optionnel, activable)

**Objectif.** Limiter la fréquence des skills coûteuses via une réserve d'énergie.

**Données.** `maxEnergy = 100`, `energy`, `recoveryMultiplier`. Coût par hook (`energy`).

**Comportement.**
- Activable globalement (`rules.enableEnergy`). Si désactivé, tout est gratuit.
- Énergie consommée par assaut (coût de base, +1 par combo) et par skill.
- Régénération au fil du temps, modulée par `recoveryMultiplier`.
- Un hook trop coûteux est ignoré ce tour-là.
- Émet `energy` / `maxEnergy` dans le log pour l'affichage des barres.

**Critères d'acceptation.**
- Désactivé : aucun combattant ne manque jamais d'énergie.
- Activé : une skill à 50 énergie ne peut pas se déclencher deux fois sans régén.

---

## F9 — Journal d'actions (ActionLog / sérialisation)

**Objectif.** L'unique sortie du moteur consommée par le renderer. Liste ordonnée et sérialisable de tout ce qui se passe.

**Données — union discriminée exhaustive.**
```ts
type Action =
  | { t: 'add';      fid: number; sprite: string; side: 0|1; life: number;
                     size: number; isDino: boolean; props: string[]; fx?: AddFx }
  | { t: 'display' }                                            // mise en place initiale
  | { t: 'announce'; fid: number; skill: string }              // annonce d'attaque/skill
  | { t: 'goto';     fid: number; tid: number; fx?: string }   // se déplace vers la cible
  | { t: 'return';   fid: number }                             // retour à sa position
  | { t: 'moveTo';   fid: number; x: number; y: number }
  | { t: 'flip';     fid: number }
  | { t: 'damage';   fid: number; tid: number; life: number; lifeFx: string; fx?: string }
  | { t: 'damageGroup'; fid: number; targets: {tid:number; life:number}[]; fx: string }
  | { t: 'lost';     fid: number; life: number; fx: string }   // PV perdus (affichage)
  | { t: 'regen';    fid: number; life: number; fx: string }
  | { t: 'status';   fid: number; status: string }
  | { t: 'noStatus'; fid: number; status: string }
  | { t: 'fx';       kind: string; src?: number; dst?: number }// effet spécial autonome
  | { t: 'dead';     fid: number }
  | { t: 'escape';   fid: number }
  | { t: 'talk';     fid: number; text: string }
  | { t: 'text';     text: string }
  | { t: 'pause';    time: number }
  | { t: 'energy';   fids: number[]; energies: number[] }
  | { t: 'finish';   winner: 0|1|null };
```

**Comportement.**
- Chaque opération du moteur **émet** une ou plusieurs actions via `manager.emit(action)`.
- Le log est sérialisable en JSON (transport réseau, sauvegarde, replay).
- Le `switch` sur `t` doit être **exhaustif** (vérifié par le compilateur TS).

**Critères d'acceptation.**
- `JSON.parse(JSON.stringify(log))` est égal au log original.
- Tout type d'action a un renderer associé (F10) ; aucun cas non géré.

---

# COUCHE RENDERER (rejeu visuel)

## F10 — File d'actions animées (playback)

**Objectif.** Rejouer l'`ActionLog` comme une séquence d'animations, une action à la fois.

**Données.**
```ts
abstract class AnimAction {
  coef = 0;          // progression 0 → 1
  speed = 0.1;       // Δcoef par frame
  onComplete!: () => void;   // chaîne vers l'action suivante
  abstract init(): void;
  abstract update(dt: number): void;  // anime ; appelle end() quand fini
  end() { this.onComplete(); }
}
```

**Comportement.**
- `playNext()` dépile une `Action`, la convertit en `AnimAction` concrète, et branche `onComplete = playNext`.
- Exécution **strictement séquentielle** : une action bloque jusqu'à `onComplete()`. Pas de parallélisme (simple, déterministe, facile à déboguer).
- Certaines actions « instantanées » (status, text court) avancent vite ; d'autres attendent une durée ou la fin d'une animation de sprite.

**Critères d'acceptation.**
- Le combat se déroule du premier `add` au `finish` sans blocage.
- Mettre en pause / avancer pas-à-pas est possible (un tick = une action).

---

## F11 — Sprites et animations des créatures

**Objectif.** Charger et animer les combattants avec des états d'animation nommés.

**Données.** États standards : `stand`, `walk`/`run`, `jump`/`jumpDown`, `cast`, `release`, `attack`, `hit`, `air`, `dead`.

**Comportement.**
- Asset par créature identifié par sa clé `gfx`, chargé à la volée (atlas de sprites, ou squelette type Spine/DragonBones, ou Lottie pour du vectoriel).
- `playAnim(name)` change l'état ; détection de fin d'anim non bouclée → retour à `stand`.
- Idle « vivant » : à intervalle aléatoire, un combattant au repos fait un petit pas (anim `walk`).
- Pour démarrer vite : placeholders colorés (rectangles + label) avant de brancher les vrais assets.

**Critères d'acceptation.**
- Chaque action de combat déclenche l'anim correspondante (attaque → `attack`, mort → `dead`).
- Le swap placeholder → asset réel ne casse pas la logique de rendu.

---

## F12 — Positionnement 2.5D et tri en profondeur

**Objectif.** Donner une fausse perspective (créatures plus basses = plus proches) sans vraie 3D.

**Données.** Coordonnées logiques : `x` (horizontal), `y` (profondeur), `z` (hauteur, pour sauts).

**Comportement.**
- Projection écran : `screenX = x`, `screenY = baseY + y * 0.5 + z * 0.5`.
- Ombre projetée au sol (`z = 0`), indépendante du sprite.
- **Z-order par `y`** : les sprites plus bas passent devant. (Avec PixiJS : `container.sortableChildren = true` + `zIndex = y`.)
- Couches de profondeur fixes : fond → ombres → château → combattants → effets → particules → UI.

**Critères d'acceptation.**
- Un combattant qui avance vers le bas de l'écran passe devant ceux du fond.
- Les sauts (`z`) ne cassent pas l'ordre de profondeur.

---

## F13 — Système d'effets visuels (FX)

**Objectif.** Sorts élémentaires, projectiles et particules, pilotés par les actions `fx` / `damage`.

**Données.** Catalogue d'effets par clé : `fireball`, `meteor`, `aura`, `heal`, `lightning`, `tornade`, `ice`, `projectile`, `charge`, etc.

**Comportement.**
- Chaque effet est une **petite machine à états** (`step`) : ex. Fireball = `cast` (aura + anim) → spawn des projectiles → vol → impact (déclenche les dégâts visuels) → fin.
- Système de **particules** physiques : `vx/vy/vz`, poids, friction, durée de vie, fondu (scale ou alpha).
- Projectiles spécialisés : `homing` (poursuite avec arc), `turner` (rotation + traînée).
- L'impact de l'effet est synchronisé avec l'affichage des PV perdus (`lost`).

**Critères d'acceptation.**
- Ajouter un nouvel effet = un fichier déclarant ses steps, sans toucher au reste.
- Un effet manquant retombe sur un effet par défaut (placeholder) sans planter.

---

## F14 — Déplacements, tweens et physique légère

**Objectif.** Mouvements fluides (approche, saut, recul) et petits rebonds.

**Comportement.**
- Tween linéaire de base : `pos = start * (1 − coef) + end * coef`.
- Arcs de saut via sinus : `z = −sin(coef * π) * hauteur` (saut), variantes pour sauter par-dessus / retomber.
- Vitesse de déplacement = `distance / runSpeed` (les longs trajets ne sont pas plus lents visuellement).
- Easing (`easeOut`) pour les éléments d'UI (barres de vie/énergie).
- Effets au sol : poussière à la course, impact à l'atterrissage.
- `shake` de caméra amorti sur les gros impacts.

**Critères d'acceptation.**
- Une attaque au corps-à-corps : approche → frappe → retour à la position d'origine, enchaînés.
- Les tweens sont indexés sur le delta-time (fluide à 60 fps comme à 30).

---

# COUCHE SETUP & MÉTA

## F15 — Composition des équipes et génération de rencontres

**Objectif.** Construire les deux camps avant le combat.

**Comportement.**
- Équipe joueur : liste de `Character` (dinoz/persos possédés).
- Adversaires : soit fixés (scénario/boss), soit **générés** selon un contexte (zone, niveau, probabilités).
- Table de spawn : par zone/lieu, liste pondérée de monstres avec `proba`, contraintes de groupe (`groups`).
- Hooks de scénario : règles spéciales, cinématiques, monstres uniques (`special`).

**Critères d'acceptation.**
- Une même zone + seed génère toujours la même rencontre.
- Les contraintes de groupe et probabilités sont respectées statistiquement.

---

## F16 — Récompenses et issue du combat

**Objectif.** Calculer le résultat : victoire, XP, or, capture, level-up.

**Données.**
```ts
type FightStat = { fid: number; name: string; damageDealt: number; damageTaken: number;
                   xpGained: number; goldGained: number; survived: boolean };
```

**Comportement.**
- Victoire déterminée quand un camp n'a plus de combattant actif (ou timeout → règle d'égalité).
- XP/or répartis selon les monstres vaincus (`xp`, `gold`, bonus si même niveau).
- Capture possible de certains monstres (`capture`), level-up appliqué après coup.
- Persistance des PV restants des persos joueur.

**Critères d'acceptation.**
- Le `CombatResult` contient des stats cohérentes avec le log (somme des dégâts = PV perdus).
- Aucune récompense en cas de fuite/défaite (selon règles).

---

## F17 — Invocations et combattants dynamiques

**Objectif.** Ajouter des combattants en cours de combat (invocations, clones).

**Comportement.**
- Une skill d'invocation appelle `manager.addMonster(id, side)` pendant le combat → émet `add` avec un `fx` d'apparition (`grow`, `ground`, `fall`…).
- Compteur `invocations` limitant le nombre par combattant.
- Les invoqués entrent dans la file de temps comme les autres.

**Critères d'acceptation.**
- Un invoqué apparaît avec son animation et agit aux tours suivants.
- La limite d'invocations est respectée.

---

## F18 — Mode château / PvP (optionnel, V2)

**Objectif.** Combats avec une structure défendable (bâtiments, PV de château) pour le PvP.

**Comportement.**
- Entité `Castle` avec PV et bâtiments ; actions `addCastle`, `castleAttack`.
- Quand un camp n'a plus de défenseurs, les attaquants frappent le château.
- Sorts/bonus liés aux bâtiments.

**Critères d'acceptation.**
- Le château encaisse et émet ses propres actions de dégâts.
- La victoire peut se décider sur la destruction du château.

---

# TRANSVERSE

## F19 — Tests déterministes et équilibrage

**Objectif.** Exploiter le déterminisme pour tester et équilibrer massivement.

**Comportement.**
- Tests unitaires des fonctions pures (résolution de dégâts, matrice d'éléments, file de temps).
- Tests de **snapshot** : un combat (seed fixe) produit un log de référence ; toute régression est détectée.
- **Simulation de masse** headless : jouer 10 000 combats pour mesurer winrates, durée moyenne, variance → ajuster l'équilibrage.
- Aucun rendu requis pour ces tests.

**Critères d'acceptation.**
- La CI échoue si un log de référence change sans intention.
- Un rapport de winrate par matchup peut être généré en une commande.

---

## F20 — Outils de debug et replay

**Objectif.** Itérer vite (vibe coding) avec une boucle de feedback courte.

**Comportement.**
- Rejeu d'un combat depuis `{seed, teams}` ou depuis un `ActionLog` exporté.
- Lecteur pas-à-pas : avancer/reculer action par action, inspecter l'état des combattants.
- Contrôle de vitesse (x0.5 → x4), saut à la fin.
- Export/import du log (JSON) pour partager un cas de bug reproductible.

**Critères d'acceptation.**
- Coller un `ActionLog` rejoue exactement le combat.
- Le mode pas-à-pas affiche l'action courante et l'état résultant.

---

## Stack technique suggérée

| Besoin | Choix recommandé |
|--------|------------------|
| Moteur | TypeScript pur, zéro dépendance, RNG seedé (`mulberry32`) |
| Format d'échange | JSON (union discriminée `Action`) |
| Renderer 2D web/mobile | PixiJS v8 (WebGL/WebGPU, z-sort intégré) |
| Animations créatures | Atlas de sprites (MVP) → Spine/DragonBones (V1) |
| Tweens | Tweens natifs Pixi ou `@tweenjs/tween.js` |
| Particules | `@pixi/particle-emitter` |
| Tests | Vitest (unitaires + snapshots de log) |
| Build/dev | Vite |

## Mapping vers l'original DinoRPG (référence)

| Feature | Source d'origine |
|---------|------------------|
| F1, F4, F5 | `src/fight/Manager.hx` |
| F2 | `src/fight/Fighter.hx`, `src/data/Monster.hx`, `Dino.hx` |
| F3 | `Data.hx` (constantes éléments), `computeDefenses` |
| F6 | `src/fight/SkillsImpl.hx`, `src/data/Skill.hx` |
| F7 | enum `_Status` (`src/com/Fight.hx`) |
| F9 | enum `_History` (`src/com/Fight.hx`) |
| F10 | `gfx/fight/src/Main.hx` (`playNext`), `State.hx`, dossier `ac/` |
| F11 | `gfx/fight/src/Fighter.hx`, `SlotDinoz.hx` |
| F12 | `gfx/fight/src/Scene.hx`, `Sprite.hx` |
| F13 | dossier `gfx/fight/src/fx/` |
| F14 | `gfx/fight/src/Tween.hx`, `Phys.hx` |
| F15 | `src/fight/Scenario.hx` |
| F16 | `src/fight/Result.hx` |
| F18 | `src/fight/Castle.hx` |
