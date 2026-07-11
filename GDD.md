# Game Design Document — AutoMonster

> Version 0.15 — Document de référence du projet
> Refonte : abandon du système de cartes, passage à un combat de **monstres en live**.
>
> **Ce document est tenu à jour systématiquement** (voir `CLAUDE.md`). Pour chaque aspect : ce qui est *designé*, son *état d'implémentation*, et l'*historique* des changements.

---

## 0. Journal de bord

> Une entrée par session ayant changé le design, le code ou les specs. La plus récente en haut. On n'efface jamais les entrées passées.

### 2026-07-11 — v0.15
- [Home / House — errance] **Déplacement du compagnon refondu en marche aléatoire organique** : au lieu d'un aller-retour métronomique (setInterval fixe), le compagnon choisit une position cible aléatoire (x horizontal + profondeur), s'y déplace, puis observe une **pause de durée variable** (0.5s à ~3.2s) avant de repartir — via une boucle de `setTimeout` récursifs (marche 0.9–1.7s, pause 0.5–3.2s), suspendue en mode focus.
- [Home / House — profondeur] **Nouvel axe de profondeur** : le compagnon peut aussi s'arrêter plus ou moins « loin » dans la pièce (position verticale `bottom` variable entre l'avant-plan et la ligne de sol), sans changement d'échelle (pas de scale lié à la profondeur, comme demandé).
- [Home / House — orientation] Le compagnon **regarde dans le sens de son déplacement** (flip horizontal du sprite) à chaque nouvelle destination choisie, plutôt qu'au seul rebond contre les bords.
- [Home / House — focus] **Le clic ne remplace plus la pièce par un écran séparé.** La pièce et un **volet d'info à droite** (`house-panel`) coexistent désormais dans une même mise en page (`house-stage`, flex) : au clic, le compagnon **zoome en douceur sur place** (transition `transform: scale()`, ~2.1×, toujours dans la pièce — jamais plein écran, conformément à la règle absolue « sprite miniature ») pendant que le volet glisse depuis la droite (largeur, opacité et translation animées en CSS, léger décalage de timing pour un effet séquencé). Le bas de la House (légende, points d'équipe, bouton Sortir) s'estompe en fondu pendant le focus plutôt que de disparaître brutalement.

### 2026-07-11 — v0.14
- [Espèces] **Retrait des 8 espèces historiques devenues obsolètes** : `flameling`, `aquafi`, `leafkit` (anciens starters), `willowisp` (ancienne rare), `peblix`, `chirple`, `mossprout`, `nimbus` (anciennes bestioles de base). `gravelmaw` (boss) conservé. Sprites conservés sur disque (non supprimés) mais plus référencés comme espèces jouables/rencontrables.
- [Starters] **Nouveaux starters : Poofowl, Fungoot, Emberpup** (promus depuis le bestiaire importé des planches → `kind: "automonster"`, `wildEncounterable: false`), avec talent inné assigné (Poofowl → régénération, Fungoot → épines, Emberpup → braise) et palette de talents. `STARTERS` mis à jour dans `data.ts`.
- [Rare] **Nouvelle récompense rare post-boss : Haloux** (promu automonster, remplace `willowisp`). `RARE_REWARD` mis à jour.
- [Ranch] `RANCH_OFFERS` mis à jour (`emberpup` niveau 4, `haloux` niveau 6) suite au retrait de `leafkit`/`willowisp`.
- [Vallée sauvage] Ennemis des 4 combats de base remplacés par des espèces du bestiaire importé, en gardant la cohérence de flaveur : `mossprout`→`sprigling`, `chirple`→`squawklet`, `peblix`→`cobbleback`, `nimbus`→`murkwisp`.
- [Éditeur d'espèces] **Champ `kind` (Auto Monster / Monstre) rendu éditable** dans l'Éditeur d'espèces (menu ☰), au même titre que nom/stats/rareté/`wildEncounterable`. Le joueur peut désormais reclassifier librement n'importe quelle espèce entre AM jouable et simple monstre sauvage, persisté globalement via `species_overrides` (même mécanisme que les autres champs).
- [Tests/Outils] `engine.test.ts` et `sim.ts` basculés sur les nouveaux starters (`poofowl`/`fungoot`/`emberpup`) à la place des espèces retirées. 105 ok / 0 échec.

### 2026-07-11 — v0.13
- [Bestiaire] **Import des 5 planches fournies (`sprites/planche 0..4.png`) → 43 nouvelles bestioles**, découpées individuellement (script de segmentation par composantes connexes + fusion des particules décoratives au corps le plus proche, fond transparent) et rangées dans `app/client/public/sprites/`. Chaque créature a reçu un nom, des stats de base, une rareté (common/rare) et un tint, ajoutés dans `data.ts` (bloc « Bestiaire étendu »). Le bestiaire passe de 9 à **52 espèces**.
- [Data] **Nouveau champ `wildEncounterable`** sur `SpeciesDef` : détermine si une espèce peut apparaître en rencontre PvE sauvage (Forêt). Valeur par défaut : `true` pour les bestioles communes, `false` pour les auto monsters jouables/rares et les 8 bestioles « rare » nouvellement importées (réservées, à activer manuellement). `wildSpeciesList()` exposé pour lister les espèces activables.
- [Outillage] **Éditeur d'espèces** (menu ☰ → « 🧬 Éditeur d'espèces ») : table éditable (nom, 5 stats, rareté, case `wildEncounterable`) pour toutes les espèces, avec recherche/filtre. Sauvegarde persistée **globalement** (partagée par toutes les parties, pas par joueur) via nouvelle table `species_overrides` (Postgres/pg-mem) + routes `GET/PUT /api/species-overrides`. Application des overrides **en place** sur l'objet `SPECIES` (`applySpeciesOverrides`) au chargement de `GamePage`, pour ne pas avoir à retoucher tous les points de lecture (`SPECIES[id]`) dans le code existant.
- [Home / UX] **Refonte complète de la home, mobile-first et minimaliste.** L'ancienne topbar (logo + or/potions + boutons bestiaire/équipe/déconnexion) est retirée : header réduit à un **logo (haut gauche)** et un **menu hamburger (haut droite)** qui ouvre un panneau latéral (Bestiaire, Équipe, Éditeur d'espèces, Déconnexion).
- [Home / House] **Nouveau cœur de la home : la House** (`House.tsx`). Vue de côté d'une petite pièce ; le compagnon actif (miniature) s'y déplace tout seul par petits allers-retours avec une **animation de sautillement** (`houseHop`/`houseShadow`, ombre qui pulse). **Clic sur le compagnon → focus** : la pièce laisse place à un panneau (sprite + fiche résumée : nom, niveau, PV, XP, stats) avec un **bouton retour** ; un lien ouvre la fiche complète existante (`AmPage`) pour le détail (soins, historique, interactions). Sélecteur de compagnon actif par petits points si l'équipe a plusieurs membres.
- [Home / Navigation] **« 🚪 Sortir »** depuis la House révèle deux choix : **Forêt** (réutilise la carte de zones/combats existante, rebaptisée point d'entrée « Forêt » — aucune perte de fonctionnalité : NPC, ranch, boss, bestiaire restent accessibles depuis les zones) et **Boutique** (nouvelle page dédiée minimale, réutilise l'achat de potion existant, plus besoin de passer par le chat PNJ).
- [Règle absolue — sprites] **Aucun sprite n'est jamais affiché en grand.** Toutes les tailles d'affichage existantes ont été revues à la baisse pour rester "miniature" : fiche AM plein écran (`am-art` 170px → 104px), arène de combat (`fighter-sprite` clamp 130px → 96px max), carte de capture (`amcard-art` 110px → 88px). Nouveaux emplacements (House, focus, éditeur d'espèces) plafonnés dès la conception (respectivement ~80px, ~74px, 26px).
- [Route] `Route` du `GamePage` passe de `map`/`zone` à **`house` / `forest` / `zone` / `shop`** ; `house` est l'écran par défaut à la connexion et après l'onboarding (adoption du 1er AM).
- [Refactor] Composants `HpBar`/`StatRow` extraits dans `game/shared.tsx` (partagés entre `GamePage`, `House`, `SpeciesEditor`) pour éviter les imports circulaires.

### 2026-07-03 — v0.12
- [DA créatures] **Choix exécuté : DA-D (flat vectoriel)** pour un premier prototype de bestiaire, faute de générateur text-to-image dans l'environnement. Livré : `reference/sheet.svg` + `reference/sheet.png` — **planche 5×5 de 25 créatures originales** (chibi, contour épais `#2b2233`, aplats + 1 ombre, joues roses), réparties sur 15 éléments. Générateur procédural reproductible : `outputs/gen_sheet.py` (6 archétypes : blob / quadrupède / oiseau / spectre / serpent / insecte). Noms + pastille couleur d'élément sous chaque case.

### 2026-07-03 — v0.11
- [DA] **Refonte visuelle complète : thème CLAIR moderne** (remplace le thème fantasy sombre). Palette indigo/violet + émeraude, surfaces blanches, ombres douces, typo `Space Grotesk` (titres) + `Inter` (corps). `game.css` entièrement réécrit.
- [Mise en scène] **Machine à vues** dans `GamePage.tsx` (`route` : `map` / `zone` + overlays) avec **transitions animées juicy** entre pages (`viewIn`, `riseIn`, `popIn`, `stagger`, hover-lift des boutons/cartes).
- [Onboarding] **Zone de base + choix du 1er AM en dialogue façon Disco Elysium** (`Onboarding`) : portrait de Sylve (mentor), répliques mises en scène (dont une « pensée »), puis sélection du starter. Remplace l'ancien écran `Adoption`.
- [Monde] **Carte du monde réduite à 3 ZONES** (Clairière du Départ, Vallée Sauvage, Cimes Orageuses) avec anneaux de complétion, badges d'état, chemins pointillés animés, avatar joueur animé. **La carte fade out à l'arrivée** dans une zone (`worldFading`).
- [Progression] **Taux de complétion par zone** (`zoneProgress`, victoires cumulées / `winsToComplete`). **À 75%**, la zone suivante se **débloque** (`registerZoneWin` + `zonesUnlocked`). La Vallée débloque les Cimes.
- [Boss/États de zone] Zone menacée (Cimes) = boss `gravelmaw`. **Boss vaincu → zone pacifiée** (`bossDefeated`) : elle passe en mode paisible avec marchand + PNJ. États : `peaceful` / `exploration` / `threatened` (`zoneMood`).
- [PNJ] **Chat plein écran façon Disco Elysium** (`NpcChat`) pour les lieux à PNJ (marchand/soin/ranch/lore) : portrait + répliques + actions contextuelles (acheter potion, soigner l'équipe, louer/ rendre un monstre).
- [Bestiaire] **Pokédex** (`BestiaryModal`) : grille de toutes les espèces, silhouette verrouillée tant que non rencontrée. Rencontre enregistrée au lancement du combat (`recordBestiary`), + starters/rare/possédés.
- [State] v5 : ajout `playerZone`, `bestiary`, `zoneProgress`, `zonesUnlocked`, `bossDefeated` + helpers (`zoneCompletion`, `zoneMood`, `isZoneUnlocked`, `isZonePacified`, `registerZoneWin`, `recordBestiary`) ; `migrate()` backfill. Moteur de combat/ActionLog **inchangé** (tests 105/0).
- [Data] `data.ts` : type `Zone` + `Npc`, `ZONES`, `ZONE_PATHS`, `MAP_WORLD_W/H`, `START_ZONE`, `zoneById`, `encounterById`. `COMBAT_LOCATIONS`/exports moteur conservés.

### 2026-06-29 — v0.10
- [Responsive] **Passe mobile-first sur tout le jeu.** Breakpoints 900 / 600 / 360 px.
- [Responsive] **Header** : `flex-wrap` + `safe-area-inset` + tailles réduites pour ne plus déborder sur petit écran.
- [Responsive] **Arène de combat** : combattants/sprites passés en `clamp()` (plus de débordement des 180px fixes sur mobile) ; arène et paddings fluides ; overlay/combat en quasi plein écran sous 600px.
- [Responsive] **Hub / carte / page AM** : grilles repliées en 1 colonne, paddings réduits, carte 64vh, scroll tactile (`-webkit-overflow-scrolling`), cibles de boutons agrandies, soins empilés sous 360px.
- [Responsive] Nettoyage des media queries 720px dupliquées (stats AM).

### 2026-06-29 — v0.9
- [Bug] **Glissement des icônes de la carte corrigé.** Le `button:active` global (`translateY(1px)`) écrasait le `transform: translate(-50%,-50%)` des nœuds `.map-loc` → l'icône sautait au clic. Règle CSS dédiée qui fige le transform au survol/clic.
- [DA] **Direction artistique « jeu vidéo fantasy »** sur toute l'app : nouvelle palette (nuit profonde, or, parchemin, émeraude, braise), typo gravée (Cinzel) + corps (Spectral), panneaux à bord doré et reflets, boutons primaires en or martelé.
- [Carte] **Chemins refaits** : routes en **courbes douces** (Bézier quadratique) avec double-trait (ombre large + pointillé doré) au lieu de droites pointillées qui se croisaient. Lien bizarre `shop↔heal` retiré ; arbre village→vallée plus lisible.
- [Équipe] **Bandeau d'équipe déplacé en haut** du hub (`grid-template-areas`).
- [Fiches] **Page AM en plein écran** (remplace la modal fiche) : grande illustration, **date de capture**, **descriptif d'espèce** (`SpeciesDef.desc`), **historique** daté (capture / combats / interactions / level-ups), stats, talents, soins.
- [Économie] **Suppression du boost de stat payant** (`BOOST_COST`/`BOOST_AMOUNT`/`boostStat` retirés). L'inventaire ne fait plus que soigner.
- [Caractère] **Système de personnalité par individu** (`Personality` : archétype + affinités **jitterées** → deux individus de même espèce diffèrent). Humeur `mood` 0..100 (départ 60) qui module **±10% ATK/VIT en combat** (`withMoodBattle`, sans changer les PV persistés).
- [Interactions] **caresser / coacher / observer** (gratuit, cooldown `INTERACT_COOLDOWN_MS` = 8 s test). Issue **aléatoire ± selon l'affinité de l'individu** : caresser → humeur ; coacher → humeur + parfois +stat permanent (ou braquage) ; observer → humeur + léger repos PV. Chaque interaction est journalisée dans l'historique de l'AM.
- [State] v4 : `Character` enrichi (`capturedAt`, `personality`, `mood`, `history`, `lastInteract`) ; `migrate()` backfill les anciens AM sauvegardés.
- [Tests] +10 checks moteur (personnalité unique, cooldown, humeur→combat). 105 ok / 0 échec.

### 2026-06-28 — v0.8
- [UX/Flow] **Analyse headless du live + refonte du layout du hub.** Problème constaté : après un déplacement, le panneau d'interactions (au-dessus de la carte) restait coupé hors écran et la page n'était jamais assez large pour voir panneau + carte ensemble (empilement trop vertical).
- [UX/Flow] **Layout 2 colonnes sur desktop** (≥900px) : panneau d'interactions à gauche (**collant**, scroll interne) ↔ carte à droite, les deux visibles sans scroller ; bandeau d'équipe pleine largeur en dessous.
- [UX/Flow] **Mobile (<900px)** : empilé (panneau → carte → équipe) avec **auto-scroll vers le panneau** à chaque déplacement, pour que les interactions soient immédiatement visibles à l'arrivée.
- [UX/Flow] Clic sur le lieu courant → scroll vers le panneau (raccourci pratique).

### 2026-06-28 — v0.7
- [Carte] **Grande carte explorable** : passage d'une petite carte à une grande toile (`MAP_W`×`MAP_H` = 1280×820) **scrollable**, recentrée automatiquement sur le joueur. Correction du canvas surdimensionné de v0.6 (la fenêtre `.map-viewport` a une hauteur maîtrisée ~56vh).
- [Carte] **Lieux de types variés** (`LocType`) : `combat`, `shop` (boutique), `heal` (centre de soin), `ranch`, `dialogue`. Village (place, boutique, centre de soin, ranch, PNJ) + vallée sauvage (5 combats dont le boss) + PNJ voyageuse. Décor : chemins reliant les lieux (`MAP_PATHS`).
- [Déplacement] **Avatar joueur** positionné sur le lieu courant (`playerLoc`). Clic sur un lieu → **fiche du lieu** (modal) → **validation du déplacement** → l'avatar se déplace (animé) → un **panneau d'interactions s'ouvre au-dessus de la carte** selon le type de lieu.
- [Boutique] Vente de **potions** (`POTION_PRICE` = 15💰).
- [Centre de soin] **Soin complet instantané payant** de toute l'équipe (`HEAL_CENTER_COST` = 25💰).
- [Ranch] **Location d'Auto Monsters** pour X combats (`RANCH_OFFERS`). Le monstre loué est jouable en combat et apparaît dans l'équipe/inventaire (tag « loué · Xc »). À l'épuisement du contrat → **proposition de prolongation** (`RANCH_EXTEND`) ou restitution.
- [State] v3 : ajout `playerLoc` et `rental {char, fightsLeft}` ; `cleared`/`bossLife` basés sur les lieux de combat (`COMBAT_LOCATIONS`). Fonction `migrate()` pour compat anciens états.

### 2026-06-28 — v0.6
- [Flow] **Refonte du flow en page unique (hub)** : plus d'écrans séquentiels (`adoption → map → combat → reward…`). Tout se passe sur la page principale via des modals superposés.
- [Carte] Passage à une **carte à lieux libres** : petite carte avec lieux cliquables dans l'ordre voulu (plus de progression linéaire imposée). State : `cleared[]` + `bossLife{}` (par lieu) à la place de `stepIndex`/`bossLife` unique. Récompense pleine à la 1re victoire, réduite (½ or, ½ XP, 0 potion) en farm.
- [Combat] Le choix de l'AM se fait **au clic du lieu** (modal d'aperçu : ennemi, butin, sélection de l'AM, soin éventuel) puis « Combattre ».
- [Level-up] **Suppression des choix de level-up** (packs de stats + paliers de talents). Les stats montent **automatiquement** à chaque niveau en suivant les stats de base (`levelDelta` ≈ +18% PV / +12% ATK / +10% DEF / +5% VIT / +8% STA de la base, cumulé). Talent **inné** conservé ; plus d'apprentissage de talents pour l'instant.
- [Soin] **Soin progressif = régénération continue temps réel** (0 → PV max en `HEAL_FULL_MS`, **5 s pour le test**, plusieurs heures à terme). Persisté via `healStart` (timestamp) sur le `Character` → continue entre sessions. Toujours dispo : potion (instantané +50%) et soin complet payant (or).
- [Inventaire] Nouvel **inventaire** (modal) : soigner et **booster** une stat de chaque AM contre de l'or (`BOOST_COST` = 20💰, montants par stat dans `BOOST_AMOUNT`).
- [Fiches] **Fiche détaillée** par AM (modal) : stats, talents, XP, et soin en attendant.

### 2026-06-27 — v0.5
- [Projet] Renommage du projet en **AutoMonster** (anciennement « Auto Battler ») dans tout le code et la doc.
- [Nettoyage] Suppression des vieux prototypes `prototype.html`, `prototype2.html`, `prototype3.html`.

### 2026-06-27 — v0.4
- [Process] Ajout de `CLAUDE.md` : le GDD doit être mis à jour à chaque discussion/incrément/dev. Création des sections « Journal de bord » et « État d'implémentation ».

---

## 0.bis État d'implémentation

> Ce qui est **réellement présent dans le projet** aujourd'hui, par opposition à ce qui est seulement designé.

| Aspect | Designé | Implémenté (état réel) |
|--------|---------|------------------------|
| Moteur de combat / ActionLog | Oui (§3.1) | ✅ `app/client/src/game/engine` (déterministe, testé) |
| Renderer (combat) | Oui (§9) | ✅ `CombatView.tsx` (rejoue l'ActionLog, vitesse ×1/2/4) |
| Monstres / espèces / variations | Oui (§4) | ✅ 3 starters (**Poofowl, Fungoot, Emberpup**) + 1 rare (**Haloux**) + **44 espèces** (1 historique = boss `gravelmaw` + 43 importées des planches, dont 4 promues automonster) ; variations non implémentées |
| Bestiaire éditable / PvE sauvage | Oui (§4.1) | ✅ Champ `wildEncounterable` **et `kind` (Auto Monster / Monstre)** éditables par espèce + **Éditeur d'espèces** (menu ☰) persisté globalement (`species_overrides`) |
| Carte / exploration (« Forêt ») | Oui (§5) | ✅ **Carte du monde à 3 zones** (Clairière / Vallée / Cimes), désormais accessible via **Sortir → Forêt** depuis la House ; anneaux de complétion, déblocage à 75%, fade à l'arrivée, avatar animé |
| Complétion & déblocage de zone | Oui (§5) | ✅ `zoneProgress` (victoires cumulées) ; 75% débloque la zone suivante ; boss vaincu → zone pacifiée (`bossDefeated`) |
| Bestiaire (pokédex) | Oui (§4) | ✅ `BestiaryModal` : toutes espèces, silhouette verrouillée, rencontre enregistrée (`recordBestiary`) |
| Boutique / Centre de soin / Ranch | Oui (§5) | ✅ Soin/ranch intégrés au **chat PNJ** (zones) ; **Boutique** dispose en plus d'une **page dédiée minimale** accessible depuis la House (achat de potion) |
| Home / House | Oui (§7) | ✅ **Header minimal** (logo + hamburger) + **House** : compagnon miniature en marche aléatoire (pauses variables, profondeur, orientation selon le sens), **zoom smooth en place au clic** + volet d'info glissant à droite (pas d'écran séparé), sortie vers Forêt/Boutique |
| Onboarding | Oui (§7) | ✅ **Dialogue Disco Elysium** (mentor Sylve) + choix du 1er AM |
| Progression / level-up | Oui (§4.3) | ✅ **Stats auto par niveau** (plus de choix) ; talents innés seuls |
| Soin | Oui (§5.3) | ✅ **Régén continue temps réel** (5 s test) + potion + soin complet payant |
| Inventaire | Oui (§4.5) | ✅ Modal inventaire : **soin uniquement** (boost payant retiré v0.9) |
| Caractère / interactions | Oui (§4.6) | ✅ Personnalité par individu + humeur (combat) + caresser/coacher/observer (`progression.interact`) |
| Fiches AM | Oui (§7) | ✅ **Page plein écran** : date de capture, descriptif d'espèce, historique, stats, talents, soins, interactions |
| Direction artistique | Oui (§7) | ✅ **Thème CLAIR moderne** (indigo/violet + émeraude, surfaces blanches, Space Grotesk/Inter) + **transitions animées** entre vues |
| Responsive / mobile | Oui (§7) | ✅ **Mobile-first** : header wrap, arène `clamp()`, hub/carte/page AM repliés 1 col, scroll tactile (breakpoints 900/600/360) |
| PvP | Oui (§6) | À compléter |
| UI / écrans | Oui (§7) | ✅ **Page unique (hub + modals + page AM)**, `GamePage.tsx` |

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
| **F2 — Modèle de données** | ✅ Retenu (simplifié) | Principe 3 niveaux conservé : `SpeciesDef` (bestiaire statique) → `Character` (monstre possédé, persisté, plat) → `Fighter` (runtime, dérivé à l'init, jeté en fin de combat). **Sans système d'éléments** : 5 stats génériques (HP / attaque / défense / vitesse / stamina) au lieu des vecteurs élémentaires. Détail du modèle auto monster : voir §4. |
| **F3 — Système d'éléments** | ❌ Abandonné | Pas de forces/faiblesses élémentaires. Dégâts basés uniquement sur les stats génériques. |
| **F4 — Tour chronométrique** | ✅ Retenu | File temporelle : agit le `Fighter` au `time` minimum, puis `time += base × timeMultiplier` (dérivé de la vitesse). Pas de multiplicateurs par élément (F3 abandonné). Garde-fous anti-combat-infini (limite de tours). |
| **F5 — Résolution des dégâts** | ✅ Retenu (complet) | Fonction pure `resolveAttack(attacker, target, attack, rng)` : score attaque vs défense, aléa borné (~±30%), planchers, esquive, immunités. Inclut le point d'accroche `hooks.defenses` (callbacks défensifs : bouclier, renvoi, réduction…) pour l'extensibilité via F6. Sans calcul élémentaire. |
| **F6 — Skills par hooks** | ✅ Retenu | Une skill = une fonction qui mute le `Fighter` ou enregistre un hook (`events` probabilistes au tour, `attacks` spéciales, `defenses`, `afterAttack`, `onKill`, `onLost`). Triés par `priority`, tirés par `proba` (RNG seedé). Ajouter une skill = 1 fichier, sans toucher à la boucle. Champ `elt` du SkillDef retiré (pas d'éléments). |
| **F7 — Statuts & altérations** | ✅ Retenu | `StatusInfo` avec `duration`, `onApply/onTick/onRemove`. Poison, bouclier, buff/debuff, intangible… Effets périodiques au fil du temps, retrait auto à expiration. Émet `status`/`noStatus` dans le log. |
| **F8 — Système d'énergie** | ✅ Retenu (stat) | Devient la **stamina**, l'une des 5 stats de base (§4.1). Ressource consommée par les talents/skills coûteux. |
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

## 4. Auto Monsters

Un **auto monster** est la créature jouable du jeu : elle se bat **automatiquement** en combat, le joueur n'agissant qu'à la préparation (composition, niveau, talents). Sa définition suit le modèle **3 niveaux** de F2 :

```
SpeciesDef (bestiaire statique)  →  Character (monstre possédé, persisté, plat)  →  Fighter (runtime, dérivé à l'init)
```

### 4.1 Espèce — `SpeciesDef`

Définition statique partagée par tous les monstres d'une même famille.

| Champ | Description |
|-------|-------------|
| **nom** | Identité de l'espèce. |
| **élément inné** | Talent **signature** inné, partagé par toute l'espèce, qui définit son *playstyle* général. ⚠️ Ce n'est **pas** un type de dégât : aucune force/faiblesse élémentaire (cohérent avec F3 abandonné). C'est un talent de base toujours présent. |
| **stats de base** | 5 stats : **HP**, **attaque**, **défense**, **vitesse**, **stamina**. |
| **palette de talents** | Pool de talents que les membres de l'espèce peuvent **apprendre en évoluant** (pioché aux paliers de niveau, voir 4.3). |

**Stamina** = ressource consommée par les talents/skills (matérialise F8 — l'énergie devient une **stat de base** plutôt qu'un système séparé). La vitesse pilote toujours la file de tour chronométrique (F4).

### 4.2 Variations — `VariationDef`

Une espèce peut exister sous plusieurs variations. Une variation peut modifier les **stats de base**, l'**arbre de niveau** (4.3), la **palette de talents**, voire l'**élément inné**.

| Type | Déclencheur |
|------|-------------|
| **Régionale** | Liée au **lieu** (zone/biome de capture). |
| **Spéciale** | Liée à un **événement** (event temporaire). |
| **Par évolution** | Transformation du `Character` sous **certaines conditions** (niveau, objet, contexte…). |

### 4.3 Character — instance possédée

Monstre concret détenu par le joueur, persisté et **plat**. Référence une espèce + une variation.

- **Expérience / niveau** : monte jusqu'au **niveau 100**.
- **Montée de stats (v0.6, implémenté)** : **automatique, sans choix**. À chaque niveau les stats augmentent en suivant les stats de base (`levelDelta`). Le joueur n'arbitre plus rien au level-up.
- **Boost manuel** : la personnalisation des stats passe désormais par l'**inventaire** (boost d'une stat payé en or), pas par le level-up.
- **Talents** : seul le **talent inné** de l'espèce est actif. (Ancien design — packs de stats au choix + paliers de talent tous les 10 niveaux + amélioration — **abandonné en v0.6** ; à réintroduire éventuellement plus tard.)

### 4.4 Talents

Implémentés comme des **hooks** (F6) ; chaque talent peut avoir plusieurs niveaux d'amélioration. Trois catégories selon la phase de combat concernée :

| Catégorie | Portée |
|-----------|--------|
| **Offensif** | Lié à la **phase d'offense** (attaques, procs au moment de frapper). |
| **Défensif** | Lié à la **phase de défense** (boucliers, renvoi, réduction…). |
| **Utilitaire** | **Tout le reste** (buffs, invocations, soutien, économie de stamina…). |

### 4.5 Acquisition & composition

- Auto monsters débloqués en explorant la carte (boss, événements, marchands, capture).
- Le joueur choisit quels monstres aligner dans son équipe *(taille d'équipe à valider au prototype)*.

---

## 5. Progression PvE & Monde ouvert

### 5.1 Structure de la carte
- Grande carte du monde avec **zones thématiques** distinctes
- **v0.7 (implémenté)** : **grande carte scrollable** (toile 1280×820) avec **avatar joueur** qui se déplace de lieu en lieu (clic → fiche → validation → déplacement → panneau d'interactions au-dessus de la carte). Lieux de types : **combat, boutique, centre de soin, ranch, dialogue**. Village + vallée sauvage (5 combats dont 1 boss). Chemins de décor reliant les lieux.
- Difficulté croissante ou variable selon la zone
- Points d'intérêt : donjons, **marchands (boutique)**, **soin**, **ranch (location)**, événements narratifs (dialogues PNJ), boss de zone

### 5.2 Progression
- Pas de mort permanente : la défaite entraîne une pénalité (perte de ressources), pas un reset total
- **v0.6 (implémenté)** : récompense **pleine à la 1re victoire** d'un lieu, **réduite en farm** (½ or, ½ XP, 0 potion). PV d'un boss **conservés entre tentatives** (`bossLife` par lieu).
- **Boss de zone** : récompenses uniques (monstres rares — capture après 1re victoire)

### 5.3 Économie de ressources & soin
*(à affiner)*
- **Or** : soin complet immédiat, **boost de stat** (inventaire), futurs marchands
- **XP** : progression des monstres (montée de stats auto)
- **Potions** : soin instantané (+50% PV)
- **Soin progressif (v0.6, implémenté)** : régénération **continue en temps réel**, gratuite. 0 → PV max en `HEAL_FULL_MS` (**5 s en test**, plusieurs heures à terme). Persisté (`healStart`), continue hors-session.
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
| **Home / House** *(v0.15, implémenté)* | Écran d'accueil minimaliste : compagnon actif miniature en marche aléatoire (pauses variables, déplacement en profondeur, orientation selon le sens), zoom smooth en place + volet d'info à droite au clic (pas de page séparée). Point d'entrée vers Forêt/Boutique via « Sortir » ; menu ☰ (Bestiaire/Équipe/Éditeur d'espèces/Déconnexion) |
| Carte du monde (« Forêt ») | Navigation et exploration des zones, accessible depuis la House |
| Boutique | Page dédiée minimale (achat de potions), accessible depuis la House |
| Combat | Vue de bataille live (rejeu de l'ActionLog) |
| Gestion d'équipe | Composition, positions |
| Collection | Monstres possédés |
| Monstre | Fiche, stats, éléments, skills, spécialisation |
| Éditeur d'espèces *(v0.13, implémenté, outil de dev)* | Table éditable nom/stats/rareté/`wildEncounterable`, persistée globalement |
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
