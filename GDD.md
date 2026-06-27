# Game Design Document — Auto Battler

> Version 0.3 — Document de référence du projet
> Refonte : abandon du système de cartes, passage à un combat de **monstres en live**.

---

## 1. Vision

Un jeu où le joueur compose une **équipe de monstres** et les regarde se battre **en live** dans une arène animée. L'inspiration combat n'est plus Slay the Spire mais **DinoRPG (Motion-Twin)** : des créatures avec éléments, skills et stats qui s'affrontent automatiquement, l'issue se jouant à la préparation.

Le pilier du jeu : **la stratégie est dans la préparation, pas dans l'exécution.**

Plateforme cible : **Web + Mobile** (sessions courtes, UI adaptée tactile).

---

## 2. Boucle de jeu principale

```
Explorer la carte → Rencontrer un combat → Regarder le combat live → Récompenses → Améliorer l'équipe → Répéter
```

### 2.1 Phase d'exploration
- Carte du monde découpée en **zones thématiques** (biomes, factions, donjons...)
- Chaque zone a une difficulté, une esthétique et des ennemis/boss propres
- En explorant, le joueur trouve : nouveaux monstres, objets, marchands, événements

### 2.2 Phase de combat
- Combat **d'équipe contre équipe**, entièrement automatique
- Le joueur observe ; il ne contrôle pas les actions pendant le combat
- Les monstres agissent selon leurs stats, leurs éléments et leurs skills

### 2.3 Phase de progression
- Après le combat : XP, ressources, captures éventuelles
- Entre les combats : composition de l'équipe, montée de niveau, spécialisations, équipement

---

## 3. Système de combat (live)

> Le système de combat détaillé est spécifié feature par feature dans `combat-system-features.md`.
> Cette section décrit le **principe**, les features retenues seront listées au fil de la refonte.

### 3.1 Principe directeur — moteur / renderer

Le combat repose sur une **séparation stricte en deux couches**, reliées par un seul artefact : le **journal d'actions** (`ActionLog`).

```
┌──────────────────┐     ActionLog[]     ┌───────────────────┐
│ MOTEUR (logique)  │ ──────────────────> │ RENDERER (visuel)  │
│ pur, déterministe │   liste d'events    │ rejoue, "bête"     │
└──────────────────┘                      └───────────────────┘
```

- Le **moteur** calcule l'intégralité du combat d'un coup, sans rendu, et produit une liste ordonnée d'événements.
- Le **renderer** ne calcule rien : il rejoue cette liste comme une animation séquentielle.

Conséquences : moteur testable à 100 % en headless, tout combat rejouable depuis son seed, logique et visuel développés indépendamment.

### 3.2 Ce qui remplace les cartes

Plus de deck ni de file de cartes. Un monstre agit via :
- ses **stats génériques** (attaque, défense, vitesse — pas de système d'éléments),
- ses **skills** (capacités passives, événements probabilistes, attaques spéciales),
- un **système de tour chronométrique** (le monstre le plus "rapide" agit le plus souvent).

### 3.3 Features de combat retenues

*(à compléter au fil des décisions — voir refonte en cours)*

| Feature | Statut | Décision |
|---------|--------|----------|
| **F1 — Moteur déterministe** | ✅ Retenu | Socle. RNG seedé (`mulberry32`), `runCombat` headless, zéro DOM. Garantit replays PvP et tests reproductibles. |
| **F2 — Modèle de données** | ✅ Retenu (simplifié) | Principe 3 niveaux conservé : `SpeciesDef` (bestiaire statique) → `Character` (monstre possédé, persisté, plat) → `Fighter` (runtime, dérivé à l'init, jeté en fin de combat). **Sans système d'éléments** : stats génériques (attaque / défense / vitesse) au lieu des 5 vecteurs élémentaires. |
| **F3 — Système d'éléments** | ❌ Abandonné | Pas de forces/faiblesses élémentaires. Dégâts basés uniquement sur les stats génériques. |
| **F4 — Tour chronométrique** | ✅ Retenu | File temporelle : agit le `Fighter` au `time` minimum, puis `time += base × timeMultiplier` (dérivé de la vitesse). Pas de multiplicateurs par élément (F3 abandonné). Garde-fous anti-combat-infini (limite de tours). |
| **F5 — Résolution des dégâts** | ✅ Retenu (complet) | Fonction pure `resolveAttack(attacker, target, attack, rng)` : score attaque vs défense, aléa borné (~±30%), planchers, esquive, immunités. Inclut le point d'accroche `hooks.defenses` (callbacks défensifs : bouclier, renvoi, réduction…) pour l'extensibilité via F6. Sans calcul élémentaire. |
| **F6 — Skills par hooks** | ✅ Retenu | Une skill = une fonction qui mute le `Fighter` ou enregistre un hook (`events` probabilistes au tour, `attacks` spéciales, `defenses`, `afterAttack`, `onKill`, `onLost`). Triés par `priority`, tirés par `proba` (RNG seedé). Ajouter une skill = 1 fichier, sans toucher à la boucle. Champ `elt` du SkillDef retiré (pas d'éléments). |
| **F7 — Statuts & altérations** | ✅ Retenu | `StatusInfo` avec `duration`, `onApply/onTick/onRemove`. Poison, bouclier, buff/debuff, intangible… Effets périodiques au fil du temps, retrait auto à expiration. Émet `status`/`noStatus` dans le log. |
| **F8 — Système d'énergie** | ⏳ Plus tard | Réserve d'énergie activable pour limiter les skills coûteuses. Décision repoussée ; à ré-évaluer après l'équilibrage. |
| **F9 — Journal d'actions (ActionLog)** | ✅ Retenu | Unique sortie du moteur : liste ordonnée et sérialisable (JSON) d'actions (union discriminée exhaustive). Pont moteur→renderer, transport réseau, sauvegarde et replays PvP. |
| **F10 — Playback animé** | ✅ Retenu | Le renderer dépile l'ActionLog action par action (`playNext`), séquence stricte. Permet pause / lecture pas-à-pas / contrôle de vitesse. |
| **F11 — Sprites & animations** | ⏳ Plus tard | États d'anim nommés, idle vivant, assets par clé `gfx`. Reporté : démarrer en placeholders, formaliser plus tard. |
| **F12 — Positionnement 2.5D** | ❌ Écarté (forme actuelle) | Pas la 2.5D type DinoRPG. **Direction visuelle à définir** plus tard — la couche rendu (F12→F14) sera spécifiée selon ce choix esthétique. |
| **F13 — Effets visuels (FX)** | ⏳ Plus tard | Système FX piloté par les actions `fx`/`damage`. Reporté : à caler sur la future direction visuelle. |
| **F14 — Tweens & physique légère** | ✅ Retenu (techniques) | On garde la boîte à outils : tweens indexés sur le delta-time, arcs de saut, easing d'UI, shake de caméra. **Les effets précis (quels mouvements, quel ressenti) seront définis avec la direction visuelle.** |
| **F15 — Composition & rencontres** | ⏳ Plus tard | Construction des camps + tables de spawn pondérées par zone. Reporté. |
| **F16 — Récompenses & issue** | ✅ Retenu | Victoire/défaite/timeout, répartition XP & or, capture éventuelle, level-up, persistance des PV restants. Produit `FightStat[]` cohérent avec le log. |
| **F17 — Invocations** | ✅ Retenu | Skill d'invocation → `manager.addMonster(id, side)` pendant le combat (émet `add`). Compteur limitant le nombre par combattant ; les invoqués entrent dans la file de temps. Se branche sur F6. |
| **F18 — Mode château / PvP** | ❌ Abandonné | Pas de structure défendable. PvP = simple combat d'équipes (asynchrone, voir §6). |
| **F19 — Tests & équilibrage** | ✅ Retenu | Tests unitaires des fonctions pures, snapshots de log (anti-régression en CI), simulation de masse headless (winrates, durée moyenne) pour équilibrer. Bénéfice direct de F1. |
| **F20 — Debug & replay** | ✅ Retenu | Rejeu depuis `{seed, teams}` ou ActionLog exporté, lecteur pas-à-pas, contrôle de vitesse, export/import JSON pour partager un cas de bug. |

**Légende :** ✅ retenu · ⏳ plus tard · ❌ abandonné

### 3.4 Synthèse de la refonte

- **Cœur logique (à construire en priorité)** : F1, F2 (simplifié), F4, F5 (complet), F6, F7, F9 — un combat live déterministe, sans cartes ni éléments, lisible via le journal d'actions.
- **Rendu** : F10 (playback) + F14 (techniques de tween). **Direction visuelle non figée** → F11, F12, F13 reportés et calés sur le futur choix esthétique (F12 écarté sous sa forme 2.5D).
- **Méta** : F16 (récompenses) et F17 (invocations) retenus ; F15 (rencontres) plus tard ; F18 (château) abandonné.
- **Outillage** : F19 (tests/équilibrage) + F20 (debug/replay) retenus pour itérer vite.
- **En attente de décision** : F8 (énergie), F11/F13/F15.

---

## 4. Monstres

### 4.1 Acquisition
- Débloqués en explorant la carte du monde (boss, événements, marchands, capture)
- Chaque monstre appartient à une **espèce/famille** définissant ses stats de base et ses skills innés

### 4.2 Évolution & Spécialisation
- Les monstres gagnent de l'XP en combat et montent de niveau
- La montée de niveau fait croître les stats selon la courbe de l'espèce (`levelup`)
- Seuils de spécialisation : nouvelles capacités, modification des stats

### 4.3 Composition d'équipe
- Le joueur choisit quels monstres aligner dans son équipe
- *(taille d'équipe à valider au prototype)*

---

## 5. Progression PvE & Monde ouvert

### 5.1 Structure de la carte
- Grande carte du monde avec **zones thématiques** distinctes
- Difficulté croissante ou variable selon la zone
- Points d'intérêt : donjons, marchands, événements narratifs, boss de zone

### 5.2 Progression
- Pas de mort permanente : la défaite entraîne une pénalité (perte de ressources, retour au checkpoint), pas un reset total
- Objectifs de zone : vaincre le boss pour débloquer la zone suivante
- **Boss de zone** : récompenses uniques (monstres rares, objets)

### 5.3 Économie de ressources
*(à affiner)*
- **Or** : achat chez les marchands
- **XP** : progression et spécialisation des monstres
- **Fragments rares** : ressource premium pour les spécialisations avancées

---

## 6. PvP

### 6.1 Format
- PvP **asynchrone** : le combat se résout côté serveur à partir des équipes configurées
- Pas d'interaction en temps réel pendant le combat (cohérent avec le moteur déterministe)

### 6.2 Déroulement
1. Le joueur configure son équipe avant le match
2. Le combat se résout côté serveur (seed + équipes)
3. Les deux joueurs peuvent regarder le **replay** (rejeu de l'`ActionLog`)

### 6.3 Structure compétitive
- **Tournois quotidiens** : format principal
- Bracket ou format suisse selon le nombre de participants
- Récompenses à définir
- Restrictions de composition possibles par tournoi

---

## 7. Interface & UX

### 7.1 Inspiration
- **DinoRPG** pour la lisibilité du combat live et l'animation des créatures
- Vue combat : équipe joueur d'un côté, ennemis de l'autre, arène 2.5D
- Adapté Web + Mobile : UI tactile, sessions courtes

### 7.2 Écrans principaux
| Écran | Description |
|-------|-------------|
| Carte du monde | Navigation et exploration des zones |
| Combat | Vue de bataille live (rejeu de l'ActionLog) |
| Gestion d'équipe | Composition, positions |
| Collection | Monstres possédés |
| Monstre | Fiche, stats, éléments, skills, spécialisation |
| PvP Lobby | Inscription aux tournois, config équipe PvP |

---

## 8. Questions de design ouvertes

- [ ] Taille d'équipe (à valider au prototype) — impact direct sur la lisibilité mobile
- [ ] Système d'équipement sur les monstres ?
- [ ] Co-op (exploration à plusieurs) ?
- [ ] Modèle économique (à décider)
- [ ] Univers / lore / setting artistique ?
- [ ] Système de positions (avant/arrière) à conserver ou non ?

---

## 9. Stack technique

| Besoin | Choix recommandé |
|--------|------------------|
| Moteur | TypeScript pur, zéro dépendance, RNG seedé (`mulberry32`) |
| Format d'échange | JSON (union discriminée `Action`) |
| Renderer 2D web/mobile | PixiJS v8 (WebGL/WebGPU, z-sort intégré) |
| Animations créatures | Atlas de sprites (MVP) → Spine/DragonBones (V1) |
| Tests | Vitest (unitaires + snapshots de log) |
| Build/dev | Vite |

---

*Ce document est vivant. Mettre à jour au fur et à mesure des décisions de design.*
