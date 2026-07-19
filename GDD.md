# Game Design Document — AutoMonster

> Version 0.64 — Document de référence du projet
> Refonte : abandon du système de cartes, passage à un combat de **monstres en live**.
> **v0.49 (designé) : refonte du modèle AM autour de Traits (cartes d'action), Rang + HP + Stamina, barre sociale, combat en page plein écran.** Voir §4 et le journal.
> **v0.50 : T006 livré** — fondation Traits (`engine/traits.ts`).
> **v0.51 : T007 livré** — Character porte Rang/Stamina, formule de dégâts flat sans ATK/DEF en mode Traits (`combatOptsFor`). L'UI (barres atk/def/spd, choix de branche) reste en place jusqu'à T008 : voir §0.bis.
> **v0.52 : T004 livré** — nouvel éditeur de bestiaire (Rang/HP/Stamina/pool de Traits/départ), réaccessible depuis le menu ☰.
> **v0.53 : T008 livré** — draft de level-up (Traits), choix de branche retiré du jeu réel, fiche AM basculée sur Rang/HP/Stamina/Traits équipés. **Gap connu** : le combat interactif joué (`liveEngine.ts`) n'est pas encore piloté par les Traits (T012, backlog).
> **v0.54 : T010 livré** — structure de budget de rang (2v2 derrière un flag OFF). Le moteur LIVE réel reste 1v1 en dur ; activer le 2v2 demandera un travail moteur dédié (au-delà du flag).
> **v0.55 : T003 livré** — mini-menu d'interaction à icônes dans la House (clic-armé + drag&drop), sur les 3 interactions réelles (caresser/coacher/observer) + potions.
> **v0.56 : T005 livré** — combat en page plein écran (flex-fill, plus de scroll mobile attendu). Vérification par calcul CSS, pas de capture réelle (Playwright bloqué par le réseau du bac à sable) — à confirmer visuellement.
> **v0.57 : T009 livré** — barre sociale (`Character.social`, affinité étendue caresser/coacher/observer/jouets/coups), item Jouet (boutique + mini-menu + fiche), hooks combat (participation + coups encaissés). **Scope limité** : les duels d'arène n'alimentent pas la barre ; pas de migration rétroactive des affinités jouets/coups sur les AM déjà existants (neutre par défaut).
> **v0.58 : T011 livré** — tous les dialogues scriptés restants retirés (PNJ mentor/lore décoratifs supprimés ; PNJ de service marchand/soin/ranch passés du chat plein écran à des boutons d'action directs dans l'écran de zone). L'onboarding, déjà sans réplique scriptée, n'a pas été modifié (confirmé hors scope avec l'utilisateur). **Toutes les tâches planifiées (T003-T011) sont désormais livrées** ; reste T012 (backlog, rebrancher le combat interactif sur les Traits).
> **v0.59 : T012 livré** — le combat interactif réellement joué (`renderer/liveEngine.ts`) reflète enfin les Traits équipés (kit + bonus passif + mode Traits flat sans ATK/DEF), via un nouveau module pur partagé `engine/passiveBonus.ts` et `traits.ts::resolveCombatConfig`. Fallback legacy intact si <3 Traits actifs équipés. **Avec ce livrable, T003 à T012 sont tous faits** — plus aucune tâche planifiée ou backlog en attente sur ce cycle.
> **v0.60 : polish visuel hors-plan (retour de test utilisateur)** — l'écran de combat s'étirait en pleine largeur sur desktop (aucune contrainte de largeur depuis le passage plein écran de T005), perçu comme « pas centré »/FX mal placés une fois l'arène très large et les combattants écartés vers les bords. `.combat-fs-body`/`.live-combat` plafonnés à 460px de large (centré). AM de la House également réduit : `.house-critter` passait de 26% du conteneur (jusqu'à ~166px) à un `clamp` aligné sur l'échelle du sprite en combat (~46-66px) ; override `.house.focused` corrigé au passage (20% serait devenu plus gros que le mode normal après la réduction).
> **v0.61 : polish hors-plan (retour utilisateur)** — dernier vestige de l'ancien modèle atk/def/spd retiré de l'UI (`StatRow`/`RoleTag`, `shared.tsx`), qui restait volontairement en place depuis T007 (v0.51) en attendant T008 : carte starter de l'onboarding, liste d'équipe (inventaire), révélation de capture rare, et l'étape « Sa fiche » de l'onboarding (qui expliquait encore Force/Armure/Vitesse). Remplacé par `RankStatLine` (Rang/HP/Stamina, cohérent avec `AmDetails` depuis T008) ; l'étape « Sa fiche » explique désormais Rang/HP/Stamina + le Trait de départ de l'espèce.
> **v0.62 : audit UX/UI/lisibilité/responsive/technique + lot de polish** — audit complet du front puis batch d'améliorations : back navigateur ne peut plus abandonner un combat par erreur, touche Échap ferme menu/modals, feedback (toasts) sur achats/soins/location, 3 icônes SVG (rang/stamina/jouet) remplaçant les emojis hétérogènes des zones chiffrées, cibles tactiles agrandies (header 40px, sélecteur d'AM 28px), lisibilité (`--faint` foncé, tags/PV 10→11px), `role=dialog`/`aria-modal` sur les modals, `alt` corrects, % de complétion affiché sur la carte du monde, code mort supprimé (`CombatView.tsx` + CSS `.tuto-bubble`), factorisation (`toastQuests`), import inutilisé retiré.
> **v0.63 : re-skin combat en DA claire + refonte no-scroll (retour utilisateur)** — le combat quitte son ancien thème sombre isolé pour la DA claire du reste du jeu (`live-combat.css` : arène = carte blanche/gris clair, textes foncés, accents indigo ; `.combat-fullscreen` fond clair). Toute l'app est désormais **no-scroll** : `.game-shell` verrouillé à `100dvh` (`overflow:hidden`), header fixe (`flex:none`), et une zone `.game-main` (nouveau `<main>` dans `GamePage`) absorbe seule le scroll — les vues de jeu tiennent à l'écran, seules les listes longues scrollent en interne.
>
> **v0.64 : test headless réel (Playwright) + no-scroll 100% + fix cartes sombres** — mise en place d'un vrai harnais de test headless multi-résolution (le Chromium de Playwright a pu être installé, seule `libXdamage` manquait → stub compilé). Audit automatique de 5 vues × 4 résolutions (mobile 360/390/412 + desktop) : **20/20 sans aucun scroll de page ni débordement horizontal**. Bug révélé et corrigé : `.card` était défini deux fois (règle sombre de `index.css`/thème login qui l'emportait) → cartes de zone/boutique en fond sombre ; règle du jeu re-scopée `.game-shell .card` + tokens `--card/--border/--muted` re-scopés clairs. Vue de zone restructurée pour tenir à l'écran (en-tête fixe, cartes combat/services en scroll interne borné). Re-skin combat clair et alignement des FX vérifiés sur captures réelles.
>
> **Ce document est tenu à jour systématiquement** (voir `CLAUDE.md`). Pour chaque aspect : ce qui est *designé*, son *état d'implémentation*, et l'*historique* des changements.

---

## 0. Journal de bord

> Une entrée par session ayant changé le design, le code ou les specs. La plus récente en haut. On n'efface jamais les entrées passées.

### 2026-07-19 — v0.64
- [Test/Infra] Demande utilisateur : « fait un headless test compte pour check tout le problème de mise en page et fait en sorte d'être 100% no scroll (pc et mobile) ». Un vrai test headless a enfin pu être monté (limite historique levée) : le CDN de Playwright est autorisé (contrairement à celui de puppeteer, 403), le Chromium s'est installé, il ne manquait qu'une lib système (`libXdamage.so.1`, apt bloqué en 403 arm64) → **stub compilé** (`gcc`, 4 symboles vides, jamais appelés en headless sans X) + `LD_LIBRARY_PATH`. Harnais (`/tmp`, hors repo) : API (`pg-mem`) + `vite preview` d'un build, compte de test via `/api/auth/register`, état « started » injecté via `/api/game/state` (complété par `migrate`), parcours des vues et mesure de `docScrollY`/`docScrollX`/scroll de `.game-main` + éléments débordant horizontalement, à 360/390/412/1280. **Résultat final : 20/20 OK** (5 vues × 4 résolutions), aucun scroll de page, aucun débordement horizontal. Captures réelles du combat re-skinné (mobile + desktop) confirmant DA claire + alignement des combattants sous leurs plaques.
- [Bug/Cartes] Le test a révélé un vrai bug : `.card` était défini **deux fois** — `index.css` (thème sombre des pages login/`:root`, `background: var(--card)` = `#1d212b`, `border: var(--border)` sombre) et `game.css` (clair). En dev, la règle sombre l'emportait (ordre de cascade) → les cartes de zone/boutique/combat s'affichaient en **fond navy** avec en-têtes illisibles. Fix : règle du jeu re-scopée `.game-shell .card` (spécificité 0,2,0 > 0,1,0, gagne toujours dans le jeu, dev comme prod) + `--card:#fff`, `--border:var(--line)`, `--muted:var(--dim)` re-scopés sur `.game-shell` (ceinture+bretelles pour les autres classes concurrentes de `index.css`).
- [Responsive/No-scroll] Renforcement du no-scroll v0.63 pour atteindre 0 scroll partout : `.game-main > *` (vue de route active) remplit toute la hauteur (`flex:1;min-height:0`) ; hub en colonne pleine hauteur (team-strip/back fixes, carte du monde et vue de zone en `flex:1`) ; carte du monde centrée verticalement, `.world-canvas` plafonnée à 100% ; **vue de zone** = en-tête (retour + hero) fixe et `.zone-cols` (cartes combat/services) en **scroll interne borné** (`flex:1;overflow-y:auto`) — la page ne scrolle jamais, seul le contenu de zone défile si nécessaire ; compaction mobile (`≤560px` : paddings/tailles réduits sur hub, hero, team-strip, screen). Avant fix, la zone débordait de +225 à +554px selon l'écran ; après, 0.
- **Vérification** : audit headless 20/20 (mesures programmatiques) + captures visuelles (cartes désormais claires, combat clair aligné). Build vite OK. Aucun changement TS cette session (CSS + GDD uniquement), moteur intact.

### 2026-07-19 — v0.63
- [Combat/UI] Retour utilisateur (capture) : « combat pas bien aligné » + « repense le skin du combat pour qu'il respecte la DA claire du reste du jeu ». Le combat (`live-combat.css`) portait depuis l'origine un **thème sombre local** (fond `#0d0f14`, panneaux `#171a22`) hérité du proto `combat-live-proto.html`, en rupture avec la DA claire du reste de l'app. Décision actée avec l'utilisateur : **carte claire intégrée** (même DA que le reste). Refonte de `live-combat.css` : bloc de variables basculé en clair (aligné sur `game.css` — `--panel #fff`, `--panel-2 #f4f5f7`, `--ink #1a1c22`, accents indigo/or/émeraude foncés lisibles) ; arène = carte blanche→gris clair avec ombre douce et coins arrondis 20px ; sol, barres HP (`--panel-2` + bordure claire), pips d'énergie et boucliers (vide clair `#dfe3ea`), floaters (couleurs foncées + halo blanc au lieu du texte clair sur ombre noire), overlay de fin (fond clair translucide, titre `--ink`), onde de choc (`--burst` au lieu du blanc invisible sur clair), bouton d'action sélectionné (fond teinté clair au lieu de `#252a3a`) — tous re-contrastés pour fond clair. `game.css` : `.combat-fullscreen` fond dégradé clair (au lieu de `#0d0f14`), `.combat-head` texte `--ink`. Alignement : `.arena` passe de `justify-content:space-between` à `space-evenly` (combattants moins collés aux bords, paire plus équilibrée), `--line-y`/`--float-y` ajustés.
- [Combat/Alignement/Moteur] Retour utilisateur : « regarde le positionnement dans `liveEngine.ts` ». Diagnostic : le mouvement des sprites (dash/clash) est calculé dynamiquement (`getBoundingClientRect` → `contact`/`clashReach`), donc robuste ; **mais les FX d'impact étaient ancrés à des `%` codés en dur** — `dirFlash` (flash directionnel du perdant) et `bigImpact`/`shockwave` (onde de choc) utilisaient `26%`/`74%`, alors que les combattants ne sont pas à ces positions fixes (leur emplacement dépend du layout flex de l'arène) → l'explosion/l'onde tombait à côté du monstre, d'où l'impression de « pas bien aligné ». Fix : nouvel helper `spriteXPct(side)` qui calcule la position horizontale RÉELLE du centre du sprite en % de l'arène (`getBoundingClientRect`, repli sur 26/74% si l'arène n'est pas encore mesurée), utilisé par `dirFlash` et `bigImpact`. Les FX d'impact tombent désormais exactement sur le combattant, quel que soit le layout (`space-between`/`space-evenly`). Seul changement moteur : le placement des FX ; **aucune modification de la logique de combat** (ticks, dégâts, RNG), donc `engine.test.ts` inchangé.
- [App/Responsive] Retour utilisateur : « repense tout le jeu pour qu'il soit no scroll ». Périmètre acté : **vues de jeu sans scroll + scroll interne pour les listes longues**. `game.css` : `.game-shell` passe de `min-height:100vh` à `height:100dvh` + `overflow:hidden` (l'app ne scrolle plus jamais globalement) ; header `.mini-top` en `flex:0 0 auto` (fixe) ; nouveau conteneur `.game-main` (`flex:1;min-height:0;overflow-y:auto`) qui absorbe seul le scroll — les vues (House/carte/zone/boutique/arène) tiennent à l'écran, seules les listes trop longues font apparaître une barre interne. `GamePage.tsx` : les 4 blocs de route enveloppés dans un `<main className="game-main">` (les overlays `position:fixed` — combat, fiche AM, modals, menu, toasts — restent hors de ce flux, inchangés). L'onboarding (`.onboard`) conserve son propre scroll interne au besoin (`.game-shell > .onboard`).
- **Vérification** : `tsc -b` propre, `vite build` OK, `engine.test.ts` 132/132 (aucun changement moteur). Vérification visuelle réelle impossible dans le bac à sable (pas de navigateur graphique) — re-skin et no-scroll basés sur lecture précise du CSS/box-model, **à confirmer en jeu** (notamment le rendu clair des FX de combat et l'absence de contenu coupé sur petits écrans).

### 2026-07-18 — v0.62
- [UX/UI/A11y/Technique] Demande utilisateur : « gros audit UX, UI, visuel, lisibilité et responsive + améliore grandement l'état du jeu » (cible mobile + desktop, autonomie totale). Audit complet du front (10 composants React + les 3 CSS) via sous-agent, puis lot d'améliorations à fort impact, sans changement moteur :
  - **UX/robustesse** : le bouton retour navigateur/Android pouvait **abandonner un combat en cours** (le combat est un modal `{k:"combat"}`, et `onPop` fermait tout modal) — court-circuitait la confirmation du bouton « Abandonner ». Corrigé : `onPop` ignore désormais le pop quand un combat est ouvert (seule sortie = bouton dédié). Ajout d'un handler **Échap** global (ferme menu puis modals non-combat).
  - **Feedback** : achats/soins/location (`buyPotion`/`buyToy`/`healAllTeam`/`rent`) n'affichaient **aucun retour** → ajout de toasts. Factorisation du toast de quêtes complétées en `toastQuests()` (4 duplications supprimées). Import `moodOf` inutilisé retiré.
  - **Cohérence visuelle** : 3 nouvelles icônes SVG (`toy`/`rank`/`stamina`, `icons.tsx` + classes `.ico-*`) remplaçant les emojis 🧸/🏅/⚡ hétérogènes (rendu OS-dépendant) dans toutes les zones « chiffrées » : bourse header, `RankStatLine` (`shared.tsx`), fiche `AmDetails`, onboarding, boutique.
  - **Lisibilité** : `--faint` foncé `#868b96 → #6f7581` (contraste AA sur petit texte) ; `.hp-num.sm` 10→11px, `.hp-num` 11→12px, tags `rare/boss/rent` 10→11px.
  - **Cibles tactiles** : boutons du header 38→40px (mobile 34→36) ; `.house-dot` (sélecteur d'AM) passait d'une pastille de 9px non-cliquable au doigt à une **zone tactile de 28px** avec pastille visible centrée de 10px (`::before`).
  - **A11y** : `role="dialog"` + `aria-modal` sur `ModalShell`, le menu hamburger, la page de combat plein écran et le journal du jour. `alt` corrigés (`alt="ennemi"`/`alt=""` → nom d'espèce sur le sprite ennemi et le monstre loué).
  - **Info** : le % de complétion de zone (CSS `.zpct` présent mais **jamais rendu**) est désormais affiché sous le nom des zones à anneau sur la carte du monde.
  - **Nettoyage** : `renderer/CombatView.tsx` (362 lignes, plus importé nulle part — remplacé par `LiveCombat` de longue date) supprimé, ainsi que le CSS `.tuto-bubble*` mort qui n'était utilisé que par lui (58 → 57 modules au build).
- **Vérification** : `tsc -b` propre ; `vite build` OK (vers `outDir` temporaire, le vrai `dist/` non-videable dans le bac à sable — limite connue) ; suite complète verte, **373 tests** (`engine` 132, `traits` 84, `live` 30, `draft` 58, `budget` 12, `passiveBonus` 24, `social` 17, `daily.smoke` 16). Aucun changement moteur, tous les tests inchangés. Vérification visuelle réelle non possible (pas de navigateur graphique dans le bac à sable) — corrections basées sur lecture précise du CSS/DOM, à confirmer en jeu.

### 2026-07-18 — v0.61
- [Stats/UI] Retour utilisateur : « j'ai demandé à changer le combat et les stats et il y a encore les stats ». Investigation : T007 (v0.51) avait explicitement et volontairement laissé en place les barres atk/def/spd (`StatRow`/`RoleTag`, `game/shared.tsx`) en attendant T008 ; T008 (v0.53) a bien basculé la fiche AM (`AmDetails.tsx`) sur Rang/HP/Stamina/Traits équipés, mais **4 autres emplacements** de `GamePage.tsx` n'avaient jamais été repris et affichaient toujours les vieilles barres Force/Armure/Vitesse : la carte de choix du starter (onboarding étape 0), l'étape « Sa fiche » de l'onboarding (`STAT_CARDS` Force/Armure/Vitesse + `RoleTag` Rapide/Cogneur/Tank/Polyvalent — expliquait encore l'ancien système au nouveau joueur), la liste d'équipe de l'inventaire, et la révélation de capture rare. Fix : `shared.tsx` — `StatRow`/`RoleTag`/`roleOf` (et leurs tables `STAT_REF`/`STAT_META`) supprimés, remplacés par un unique `RankStatLine` compact (🏅 Rang · ❤ HP · ⚡ Stamina, classe CSS `.statgrid` déjà présente mais inutilisée). `GamePage.tsx` : les 3 usages de `StatRow` basculés sur `RankStatLine` ; l'étape « Sa fiche » de l'onboarding explique désormais Rang/HP/Stamina (au lieu de Force/Armure/Vitesse) et affiche en plus une carte dédiée au **Trait de départ** de l'espèce (`ACTIVE_TRAITS[sp.startTrait]`) — cohérent avec le fait que le combat est piloté par les Traits depuis T007/T012. Le badge de rôle (`RoleTag`) sous le nom de l'espèce est remplacé par un badge « 🏅 Rang X ». Aucun changement moteur — purement UI, `Character.stats.{atk,def,spd}` reste en place en interne (legacy `engine/combat.ts`, non affiché). **Vérification** : `tsc -b` propre, `vite build --emptyOutDir=false` OK (le `rm`/`emptyDir` par défaut de `dist/` échouait en `EPERM` dans le bac à sable — contournement en désactivant le nettoyage préalable, sans impact sur le contenu buildé), suite `engine.test.ts` inchangée verte (132/132).

### 2026-07-18 — v0.60
- [Combat/House] Retour de test utilisateur (« combat pas centré, FX mal placés » + « fenêtre de combat trop large » + « AM trop gros dans la House »). Diagnostic : depuis le passage plein écran (T005/v0.56), `.combat-fs-body .live-combat` n'avait **aucune** contrainte de largeur (`width:100%` sur un conteneur `position:fixed;inset:0`) — sur un écran large, l'arène s'étirait bord à bord, les deux combattants (`justify-content:space-between`) se retrouvaient loin l'un de l'autre et les FX ancrés au centre géométrique de l'arène (`--line-y`/`left:50%` dans `live-combat.css`) paraissaient décorrélés des sprites. Fix : `.combat-fs-body` centre désormais son contenu (`justify-content:center`) et `.live-combat` est plafonné à `max-width:460px` — l'arène retrouve une taille de jeu compacte et proportionnée quelle que soit la largeur d'écran. Séparément, `House.tsx`/`game.css` : `.house-critter` occupait 26% du conteneur (jusqu'à ~166px sur desktop, bien plus gros que le sprite en combat qui est un `clamp(48px,7vw,60px)` fixe) → remplacé par `clamp(46px,13%,66px)`, à l'échelle du combat ; `.house.focused .house-critter` (fiche ouverte) corrigé en cohérence (`clamp(38px,10%,52px)`, toujours plus petit que le mode normal, sinon la réduction ci-dessus l'aurait rendu paradoxalement plus gros que hors-focus). Pas de changement moteur/logique de jeu. **Vérification** : `tsc -b` propre, `vite build` OK (build vers un `outDir` temporaire, le vrai `dist/` du repo n'a pas pu être vidé dans le bac à sable — limite d'environnement déjà connue, cf `CLAUDE.md`), suite de tests moteur inchangée verte (132/132 `engine.test.ts`). Pas de capture d'écran réelle (pas de navigateur graphique disponible dans le bac à sable) — correction basée sur lecture précise du CSS/DOM, à confirmer visuellement par l'utilisateur en jeu.

### 2026-07-18 — v0.59
- [Combat/T012] Le combat interactif réellement joué (`renderer/liveEngine.ts` + `LiveCombat.tsx`) est rebranché sur les Traits équipés — jusqu'ici il construisait toujours son kit via `kitFor(espèce)` et ignorait `activeTraits`/`passiveTrait`, un écart connu depuis T008 (voir ligne T008/Traits, §0.bis). Filet de sécurité d'abord : `liveEngine.ts` n'a aucun test automatisé (DOM impératif) et le plan imposait d'extraire la logique de résolution en fonctions pures avant d'y toucher. Nouveau module `engine/passiveBonus.ts` (aucun DOM, aucun état) : type `PassiveBonus`, `defOf` (DEF mitigante, 0 en mode Traits), et les application pures des passifs (`applyAtkMultPassive`/`applyCritPassive`/`rollDodgePassive`/`applyDmgTakenMultPassive`/`lifestealAmount`/`regenAmount`). `engine/live.ts` (`autoSim`) et `renderer/liveEngine.ts` importent désormais ces MÊMES fonctions — une seule formule, plus de duplication à la main entre le simulateur headless et le moteur interactif. Nouveau `traits.ts::resolveCombatConfig(c)` : jamais `undefined` (contrat pratique pour un consommateur DOM), même règle de fallback que `combatOptsFor` (<3 Traits actifs équipés → kit fixe + aucun bonus + `traitMode=false`, comportement 100% legacy). Dans `liveEngine.ts` : kit/bonus/traitMode résolus une fois à la création du combat ; `P.atk=1` appliqué en mode Traits à chaque `reset()` ; les 3 points de calcul de dégâts (`eStrikeDmg`, `playerAtkDmg`, `animCounterBurst`) passent par `defOf()` ; passifs branchés (esquive totale + Peau de pierre sur les dégâts subis, calculés une seule fois par tick et réutilisés partout y compris le clash ; Frénésie + Braise sur les dégâts infligés ; vol de vie sur les 3 points d'impact joueur→ennemi ; régénération en fin de tick). Petit polish : `applyDamage` affiche « ESQUIVE » plutôt que « -0 » sur un coup totalement évité. `LiveCombat.tsx` corrigé pour résoudre le même kit que le moteur (sinon la classe CSS/texte de playstyle affichés avant combat pouvaient ne pas correspondre au combat réellement joué). **Vérification des 4 mécaniques spéciales (garde/combo/poison/esquive) pilotées par des Traits custom** : pas de navigateur disponible dans le bac à sable (Playwright bloqué, limite déjà rencontrée à T005) → vérifiée via `autoSim` headless avec des kits Traits reproduisant chaque special (20 seeds chacun, tous terminent, majoritairement décisifs) — proxy raisonnable puisque `liveEngine.ts` consomme exactement le même `resolveCombatConfig`/`kitFromActiveTraits` que ce test exerce ; un contrôle visuel réel en jeu reste recommandé dès qu'un joueur aura équipé 3 Traits actifs. Fallback <3 Traits (l'immense majorité des saves actuelles, un seul Trait de départ depuis T008) vérifié inchangé. Tests : nouveau `passiveBonus.test.ts` (24/24), `traits.test.ts` étendu 68→84/84, reste de la suite inchangée verte (`budget` 12, `draft` 58, `live` 30, `engine` 132, `social` 17, `daily.smoke` 16). `tsc -b` propre, `vite build` OK. **Avec ce livrable, la série T003-T012 est intégralement terminée.**

### 2026-07-18 — v0.58
- [Dialogues/T011] Retrait des derniers dialogues scriptés (§4.7). Recensement : l'onboarding (`Onboarding` dans `GamePage.tsx`) ne contenait déjà aucune réplique scriptée (juste des panneaux d'UI directe) — confirmé avec l'utilisateur, laissé inchangé. Les PNJ de zone (`ZONES` dans `engine/data.ts`) se répartissaient en deux familles : PNJ de service (`role: merchant/healer/ranch`, actions réelles) et PNJ décoratifs (`role: mentor/lore` — Sylve, Nima ×2, Orn-lore, le guetteur des Cimes — dont les répliques d'ambiance `Npc.lines` n'étaient déjà affichées nulle part, un clic ouvrant un panneau de chat vide). Décision validée avec l'utilisateur : PNJ décoratifs **supprimés entièrement** (ZONES nettoyées, `NpcRole` réduit à merchant/healer/ranch, `Npc.lines` retiré du type) ; PNJ de service **conservés mais sans mise en scène** — leurs actions (potion, soin d'équipe, location) deviennent des boutons directs dans une nouvelle carte « Services » de `ZoneScreen`, sans plus passer par un clic sur portrait ni par le composant `NpcChat` (`.de-overlay` plein écran), désormais supprimé avec son modal `{k:"chat"}` et le handler `openChat`/`onOpenChat`. CSS mort retiré (`.de-overlay/.de-panel/.de-side/.de-emoji/.de-name/.de-title/.de-close`, `.npc-strip/.npc-chip`) ; `.de-actions/.de-action/.de-a-price` conservés et réutilisés tels quels. Aucun changement moteur. `tsc -b` propre, `vite build` OK, suite de tests inchangée verte (`budget` 12, `draft` 58, `traits` 68, `live` 30, `engine` 132, `social` 17, `daily.smoke` 16). **Avec ce livrable, T003 à T011 (toutes les tâches planifiées de cette série) sont désormais faites** ; il ne reste que T012 (backlog, priorité haute : rebrancher `liveEngine.ts` sur les Traits).

### 2026-07-18 — v0.57
- [Social/T009] Barre sociale par AM (§4.6) : `Character.social` (0-100, défaut 50) + `Personality.affinity` étendu de 3 à 5 dimensions (`SocialSource` = caresser/coacher/observer/jouets/coups, `types.ts`/`data.ts`). `progression.ts` : `interact()` calcule désormais un `socialDelta` en plus du `moodDelta` — caresser monte toujours la barre (plus fort si aimé, jamais de baisse contrairement à l'humeur), coacher monte/baisse selon l'affinité (comme avant pour l'humeur), observer laisse la barre inchangée et remplace son texte par un indice généré (`affinityHint` : choisit la dimension d'affinité la plus marquée de l'individu et phrase en conséquence, ex. « X n'est pas spécialement fan des caresses »). Nouveau `giveToy()` (jouet = objet consommable, toujours +, magnitude selon affinité) et `registerCombatSocial(c, dmgTakenFrac)` (participation à un combat réel = gain fixe `COMBAT_SOCIAL_GAIN=2` systématique ; coups encaissés = delta signé selon `affinity.coups × dmgTakenFrac × COUPS_SOCIAL_SCALE=18`), branché dans `onCombatFinish` (`GamePage.tsx`) sur tout combat réel (forêt/zone), gagné ou perdu. Nouvel objet **Jouet** : `GameState.toys`, boutique (`TOY_PRICE=12`), utilisable depuis le mini-menu House (T003) et le bloc Interagir de la fiche (`AmDetails.tsx`). UI : barre « Lien » (dégradé rose/violet) sous l'humeur dans `AmHeroInfo`, libellés Complice/Attaché·e/Neutre/Distant·e/Méfiant·e (`socialLabel`). **Scope volontairement limité, acté** : les duels d'arène (`finishDuel`) n'alimentent pas la barre sociale (combats réels uniquement) ; les AM créés avant cette tâche ont `affinity.jouets`/`coups` neutres (0, via les valeurs par défaut) tant qu'ils ne sont pas recréés — pas de migration rétroactive de personnalité (dégradation gracieuse assumée plutôt qu'une migration hors scope). Nouveau `social.test.ts` (17/17) ; suite existante inchangée verte (`budget` 12, `draft` 58, `traits` 68, `live` 30, `engine` 132, `daily.smoke` 16). `tsc -b` propre, `vite build` OK.

### 2026-07-18 — v0.56
- [Combat/T005] Le combat LIVE quitte le système de modal centré (`.overlay`+`.combat-wrap`) pour une page plein écran dédiée `.combat-fullscreen` (`position:fixed;inset:0`, `100dvh`, flex column, safe-area insets, fond sombre en dur). `GamePage.tsx` : le rendu reste `modal.k==="combat"` (pas une route séparée) — le handler `popstate` générique déjà en place (ferme tout modal ouvert au back Android/navigateur, toujours une entrée d'historique maintenue) couvrait déjà ce besoin, ajouter un second mécanisme de pushState dédié aurait fait doublon. `live-combat.css` converti en layout flex-fill : `.live-combat`/`.lc-wrap` en `height:100%`, `.lc-top`/`.controls` en `flex:0 0 auto` (taille naturelle), `.arena` passe d'un aspect-ratio fixe (300-470px) à `flex:1 1 auto` avec un plancher réduit (120-150px) — l'arène absorbe tout l'espace restant, ne peut jamais pousser le contenu hors viewport. `LiveCombat.tsx`/`liveEngine.ts` (JS impératif DOM) non touchés, volontairement (cf T012). **Limite de vérification assumée** : pas de capture d'écran réelle à 360/390/412px possible — Playwright/Chromium n'a pas pu être téléchargé dans le bac à sable (réseau restreint). Vérifié par calcul du box-model CSS (chrome fixe ≈270px vs 550-900px de hauteur de viewport portrait réaliste) ; un contrôle visuel sur appareil réel reste recommandé. Aucun changement moteur ; tests inchangés (`live.test.ts` 30/30 + suite complète). Build tsc + vite OK.

### 2026-07-18 — v0.55
- [House/T003] Mini-menu d'interaction à icônes ajouté à `House.tsx` : bouton toggle « 🧰 Interagir » ouvrant un panneau en slide+fade sous `.house-room` (masqué en focus). Cartes générées depuis `INTERACT_LABELS` (caresser/coacher/observer) + une carte Potion. Deux modes : clic-armé (sélectionner une carte puis cliquer le compagnon) et drag&drop (carte déposée sur le compagnon) — même effet dans les deux cas (`applyQuickAction`). Cooldowns (`interactReadyIn`) et indisponibilité (potions à 0, PV pleins) grisent la carte ; tooltip au survol + bandeau de rappel quand une action est armée. **Ajustement de scope acté avec l'utilisateur** : le ticket mentionnait « Nourrir/Jouer », qui ne correspondent à aucune interaction du modèle actuel ni de T009 (Caresser/Coacher/Combattre/Coups/Jouets/Observer) — le mini-menu utilise donc les 3 interactions réelles + potions plutôt que d'inventer une mécanique non spécifiée. Aucun changement moteur ; build tsc + vite OK, tests inchangés/verts.

### 2026-07-17 — v0.54
- [Équipe/T010] `engine/data.ts` : `ENABLE_2V2` (false), `RANK_BUDGET` (4), `teamRankSum()`/`canAlignTeam()` — règle générale (somme des rangs alignés <= 4, au plus 2 AM si le flag est actif, 1 sinon). Comme tout le monde est rang 1 (`DEFAULT_RANK`) et qu'un seul AM combat aujourd'hui, la règle est toujours respectée : aucune régression 1v1. **Précision actée** : l'affirmation du plan initial (« teamA/teamB déjà tableaux ») est vraie pour `engine/combat.ts` (legacy) mais **pas** pour le moteur LIVE réellement joué (`live.ts`/`autoSim` + `renderer/liveEngine.ts`), structurellement 1v1 (un seul Fighter par camp, codé en dur). Activer réellement le 2v2 demandera un travail moteur dédié, pas seulement lever le flag — à anticiper si/quand `ENABLE_2V2` passe à `true`. Tests : `budget.test.ts` 12/12 (nouveau). Build tsc + vite OK.

### 2026-07-17 — v0.53
- [Progression/T008] Nouveau `engine/draft.ts` : `generateDraft` (tirage de 2-3 cartes à chaque niveau — améliorer un Trait possédé pondéré par rareté de palier (palier 2 ×10, palier 3 ×3), acquérir un nouveau Trait du pool de l'espèce, ou une 2e amélioration **seulement si ≥3 Traits non-maxés** sinon remplacée par une nouvelle carte), `applyDraftChoice`, `draftLabel`. `Character.traitPoints` (types.ts) banque 1 crédit de draft par niveau gagné (`addXp`). `makeCharacter` équipe désormais 1 Trait actif de départ (`ensureTraits`/`startTraitFor`, traits.ts) — niveau 1 = un seul actif, conforme GDD 4.3. **Migration des saves antérieures à T008** : bootstrap discret via `ensureTraits` appelé dans `addXp`, dès qu'un Character sans Trait gagne de l'XP. **Décision actée avec l'utilisateur** : le choix de branche (niveau 3) est retiré du flow de jeu réel, remplacé par le draft de Traits (`chooseBranch`/`needsBranchChoice`/`BranchModal` conservés uniquement pour `engine/combat.ts` legacy et ses 132 tests). Nouveau `LevelUpDraft.tsx` (modal de choix, réaffiché en boucle si plusieurs niveaux gagnés d'un coup), branché dans `GamePage.tsx` (chaîné après reward/capture, comme l'était le choix de branche). `AmDetails.tsx` : bloc « Caractéristiques » bascule sur Rang/HP/Stamina ; nouveau bloc « Traits équipés » (remplace le bloc Spécialisation) affichant les 3 actifs + le passif avec leur niveau. **Gap assumé et documenté** : le combat **interactif** réellement joué (`renderer/liveEngine.ts`, moteur DOM séparé d'`autoSim`, sans tests automatisés) n'a pas été rebranché sur les Traits — il continue d'utiliser `kitFor(espèce)`. Le joueur voit et choisit désormais de vrais Traits, mais ils n'affectent pas encore le combat qu'il joue interactivement. Tâche dédiée créée pour ça : **T012** (backlog, avec sa propre stratégie de test à définir avant d'y toucher — fichier volumineux sans filet). Tests : `draft.test.ts` 58/58 (nouveau), `traits.test.ts` 68/68, `live.test.ts` 30/30, `engine.test.ts` 132/132, `daily.smoke.ts` 16/16. Build tsc + vite OK.

### 2026-07-17 — v0.52
- [Bestiaire/T004] `SpeciesDef` étendu (`rank`, `baseHp`, `baseStamina`, `traitPool`, `startTrait` — optionnels, repli sur l'existant si absents). `SpeciesEditor.tsx` refondu : édition Rang/HP/Stamina par espèce + panneau dépliable listant les 12 Traits actifs et 20 passifs du catalogue (T006) en chips cliquables (pool par espèce) + sélecteur de Trait de départ (limité aux actifs du pool). Valeurs par défaut dérivées de l'existant (kit LIVE actuel + talentPool + inné) pour ne rien casser sur les 44 espèces (vérifié par script ponctuel : 44/44 OK). Persistance : aucun changement serveur — `/api/species-overrides` stockait déjà un patch JSON libre par espèce. Éditeur **réaccessible depuis le menu ☰** (« 🧬 Éditeur de bestiaire »), il était orphelin/non routé depuis v0.21. Tests moteur inchangés : `traits.test.ts` 68/68, `live.test.ts` 30/30, `engine.test.ts` 132/132, `daily.smoke.ts` 16/16. Build tsc + vite OK.

### 2026-07-17 — v0.51
- [Stats/T007] Character porte désormais `rank` (défaut 1) et `stamina` (défaut 4, `progression.ts` : `DEFAULT_RANK`/`DEFAULT_STAMINA`, posés par `makeCharacter`/`makeLeveledCharacter`/`makeEnemy`). `live.ts` `mkFighter` dérive l'énergie de départ de `stamina` (repli sur `spd/12` si absent — Character legacy). Nouvelle formule de dégâts en mode Traits (`AutoSimOpts.traitMode`) : décision de design actée avec l'utilisateur — **« le move offensif détermine les dégâts, plus de principe de défense »** : ATK du joueur neutralisée, DEF des deux côtés sans effet (`defOf()`), testé explicitement (DEF adverse ×∞ → dégâts identiques). `traits.ts` : `ACTIVE_TRAITS` recalibré en puissance **flat absolue** (`FLAT_REFERENCE`, ex. Frappe=20, Griffe=9, Curée=16, calibrés au point de référence niv.5 vs NME niv.4) au lieu de l'ancien multiplicateur d'ATK hérité des kits. Nouveau `combatOptsFor(Character)` : point d'entrée unique du combat réel (résout kit + bonus passif + `traitMode` si 3 Traits actifs équipés, sinon `undefined` → fallback `autoSim` legacy inchangé). **Scope confirmé avec l'utilisateur** : `engine/combat.ts` (moteur legacy F2-F16, branches, 132 tests) **non touché**, conservé tel quel. **Décision assumée** : l'UI (barres de stats atk/def/spd, bloc de choix de branche niveau 3) **n'a pas été retirée** — elle reste la seule information de combat exploitable tant que T008 (draft de level-up) ne fait pas réellement porter des Traits aux Character du jeu joué ; retirer ces éléments maintenant aurait été une régression d'information sans contrepartie. À rouvrir/retirer lors de T008. Tests : `traits.test.ts` 68/68 (nouveau, +8 tests T007), `live.test.ts` 30/30, `engine.test.ts` 132/132, `daily.smoke.ts` 16/16 — tous inchangés. Build tsc + vite OK.

### 2026-07-17 — v0.50
- [Traits/T006] Implémenté la fondation du modèle Traits : `engine/traits.ts` (type `TraitDef`, catalogues `ACTIVE_TRAITS`/`PASSIVE_TRAITS` convertis depuis `live.ts` KITS et `talents.ts` TALENTS, paliers 1→3 scalés), `kitFromActiveTraits`/`resolveActiveKit`, `passiveBonusOf`. `autoSim` (live.ts) accepte désormais des `AutoSimOpts` optionnelles (`kit`, `passiveBonus`) pour piloter un combat depuis des Traits équipés, sans changer son comportement par défaut. `Character.activeTraits`/`passiveTrait` ajoutés (optionnels, types.ts). Couche strictement additive : zéro régression, tous les tests existants restent verts. Nouveau `traits.test.ts` (60/60). `live.test.ts` 30/30, `engine.test.ts` 132/132 inchangés. Build tsc + vite OK (EPERM sur `dist/` = limite de montage connue, build validé dans `/tmp`).

### 2026-07-17 — v0.49 (design only — non implémenté)
- [Refonte AM de base] **Nouveau modèle d'Auto Monster décidé** (voir §4 réécrit). Résumé :
  - **Stats réduites à 3** : **Rang** (1→5, 1 partout pour l'instant), **HP** (~30-50 au niv 1),
    **Stamina** (3-4 au niv 1). **Retrait total** de Force/Attaque, Armure/Défense, Vitesse : tout
    passe désormais par les **Traits**. **Retrait de la spécialisation** (branches) : tout passe par
    les Traits.
  - **Traits = cartes d'action** de l'AM. Il en équipe **3 actives + 1 passive**. Chaque Trait a un
    **niveau 1→3** (plus le niveau visé est haut, plus il est rare à l'apparition). Au niv 1, l'AM
    n'a **qu'un Trait** (attaque simple) et doit **vite atteindre le niv 3**.
  - **Montée de niveau = draft de choix** : à chaque niveau, choix parmi {améliorer une carte
    (1→3, pondéré par rareté du palier), acquérir une nouvelle carte du **pool de l'espèce**,
    améliorer une autre carte s'il en a ≥3 non-maxées — sinon remplacé par un autre choix de carte}.
  - **Origine des Traits** : réutilisation de l'existant — les **actions de kit LIVE** (`live.ts`
    KITS : Coup/Garde/Décharge, Griffe/Brasier/Curée, etc.) deviennent les **Traits actifs**, les
    **talents passifs** (`talents.ts` : Braise, Frénésie, Peau de pierre, Régén, Ponction…)
    deviennent les **Traits passifs**. Niveaux 1→3 = mise à l'échelle de leur puissance/effet.
  - **2 AM jouables** avec **budget de Rang = 4** (2+2, 3+1, ou un seul rang 4). Pour l'instant :
    tout le monde **rang 1**, **2v2 pas encore actif** (structure posée, activée plus tard).
  - **Barre sociale** par AM : montée/baisse via **caresser, coacher, combattre, prendre des coups,
    donner des jouets** ; l'action **observer** donne des **indices** (« XXX n'est pas spécialement
    fan des caresses »). Remplace/étend le système mood+interactions actuel.
  - **Retrait de tous les dialogues** pour l'instant.
  - **Combat en page plein écran** (plus de modal pop-up par-dessus le hub) : page **clean, sans
    scroll** sur mobile.
  - **Nouvel éditeur de bestiaire** pour éditer Rang/HP/Stamina/pool de Traits par espèce.
- **Statut** : entièrement **designé, rien codé**. Découpé en tâches T004→T011 dans `taches.html`.

### 2026-07-17 — v0.48
- [Home / House — pièce edge-to-edge + fondu] **House élargie** (max-width 480 → 640, 720 en
  focus inchangé) ; `.house-room` perd son padding horizontal hérité et s'étire jusqu'aux bords
  réels de l'écran sur mobile (ciblé Samsung A37, ~360-412px CSS) — les blocs internes
  (`house-below`, `house-focus`) reprennent leur propre respiration horizontale. Le **fondu
  latéral** vers le fond de page passe d'un `mask-image` 2 points (linéaire) à un dégradé à
  paliers (transparent → 50 % → opaque, plus feutré).
- [Home / Quêtes] **Rappel des quêtes du jour retiré de la House** (pilule `house-quests`
  supprimée) : le Journal du jour reste accessible uniquement via l'icône 📅 du header. Plumbing
  associé nettoyé côté `House.tsx`/`GamePage.tsx` (`quests`, `onOpenDaily`, `questGlance`,
  `QuestGlance`).
- [Fiches AM — surnom] **Renommage des AM** : bouton crayon + édition inline du nom (`c.name`)
  dans `AmHeroInfo` (fiche House en focus et fiche plein écran `AmPage`), 18 caractères max. La
  **mention de l'espèce reste toujours affichée séparément** juste en-dessous (inchangée, déjà
  distincte du nom). Nouvelle icône `edit` (`icons.tsx`). Build tsc + vite OK ; tests moteur
  verts (132/0).

### 2026-07-17 — v0.47
- [House/UX] Fix hover du compagnon dans la House : le `button:hover` global appliquait
  `translateY(-2px)`, écrasant le `translateX(-50%)` de centrage → le sprite se décalait au
  survol. Override `.house-critter:hover/:active` conservant `translateX(-50%)` (game.css).

### 2026-07-17 — v0.46
- [Campagne] **Ennemis de la campagne solo = les 4 NME de planche 4.** Les encounters de la
  Vallée Sauvage passent de `sprigling/murkwisp/cobbleback/murkwisp` à `waxwick` (N.1),
  `spinepuff` (N.2), `beetlorn` (N.3), `meteorb` (N.4) — rampe de difficulté croissante,
  descriptions mises à jour. Boss des Cimes (`gravelmaw`) inchangé. Murkwisp & co. ne sont
  plus jamais rencontrés (les combats sont à ennemi fixe via `enemySpecies`, pas de spawn
  aléatoire). tsc + tests verts (132/0, 30/0).

### 2026-07-17 — v0.45
- [Home / House — polish déplacement & pièce] Retours joueur sur la House :
  - **Hover désactivé** sur le compagnon (suppression du `scale(1.05)` au survol qui faisait
    « glisser » le sprite).
  - **Pièce élargie** (`.house` max-width 440 → 480, padding latéral réduit) pour mieux coller à
    une largeur mobile ; **bornes d'errance étendues** (`X_MIN/X_MAX` 18–78 → 13–87) pour que l'AM
    puisse approcher les bords gauche/droit.
  - **Bords gauche/droit en fondu** vers le fond du site : `.house-room` perd sa bordure/ombre au
    profit d'un `mask-image` horizontal (transparent → opaque 9 %–91 % → transparent).
  - **Rythme de déplacement ralenti** : marche 0.9–1.7 s → 1.5–2.4 s, pauses 0.6–3.2 s → 2.8–6.5 s,
    transition CSS `left/bottom` 1.3 s → 1.6 s.

### 2026-07-17 — v0.44
- [Home / House — **focus in-place** (T002)] **Le clic sur l'AM n'ouvre plus la fiche en page
  séparée (modal `amPage`)** : la House passe en état local `focused` (aucun `pushState`, aucune
  navigation). L'AM glisse en douceur en haut à gauche (transitions CSS `left/bottom/width`),
  l'errance et les émotes se **figent** pendant le focus, les éléments de base (`house-below` :
  carte d'id, points d'équipe, quêtes, sorties) fondent (`opacity` + repli), la pièce se compacte,
  et la **fiche apparaît en fade-in** autour du compagnon (identité + stats/talents/spécialisation/
  soins/interactions + espèce + historique). **Clic hors de l'AM** (fond de la pièce) ou bouton ✕ :
  fade-out, réactivation de l'errance, retour smooth à la House de base. Le panneau reste monté le
  temps du fade-out (`rendered` + `FOCUS_OUT_MS`).
- [Refactor] Contenu de la fiche extrait dans **`game/AmDetails.tsx`** (`AmHeroInfo`, `AmDetails`
  + sous-composants `HealControls`/`TalentChips`/`BranchBlock`/`InteractButtons`, `STAT_LABELS`,
  `fmtDate`, `HIST_ICON`) — réutilisé par le focus House **et** par la fiche plein écran `AmPage`
  (conservée pour l'ouverture depuis l'équipe/l'inventaire). `House` reçoit de nouvelles props
  (`gold`, `potions`, `onToggleHeal/onPotion/onFull/onInteract/onChooseBranch`) ; `onOpenSheet`
  n'est plus utilisé depuis la House. Build tsc + vite OK ; tests moteur verts (engine 132/0).

### 2026-07-16 — v0.43
- [Bestiaire] **Reclassement planche 4** (`sprites/planche 4.png`, 9 espèces, ordre de lecture 3×3).
  Numéros 3, 5, 7, 8 restent des **NME** (`kind: "bestiole"`) : `meteorb`, `beetlorn`, `waxwick`,
  `spinepuff`. Les 5 autres deviennent des **AM jouables** (`kind: "automonster"`,
  `wildEncounterable: false`) : `snailorn` (1), `axolotine` (2), `bellwisp` (4), `thicket` (6),
  `bannertail` (9). Roster jouable : **4 → 9 AM**. Ces 5 nouveaux AM n'ont pas encore d'inné /
  palette de talents / branches ni de kit LIVE dédié → repli auto sur le kit Poofowl (jouables mais
  génériques). Build + tsc + tests verts (engine 132/0, live 30/0).

### 2026-07-15 — v0.42
- [Combat LIVE — **INTÉGRÉ AU JEU** : le proto devient le combat réel de l'app, partout]
  - **Pivot de design majeur assumé** : l'ancien combat (replay automatique d'un `ActionLog`
    pré-calculé, « le combat se joue seul ») est remplacé PARTOUT par le **combat LIVE interactif**
    du proto (`combat-live-proto.html`). Le joueur pilote son AM en temps réel (ticks 2 s,
    énergie, garde/parade, décharge, clash, garde tardive, contre-attaque). Le tuto d'onboarding
    est réécrit en conséquence (« tu pilotes », plus « tout est automatique »).
  - **Nouveau moteur data-driven** `engine/live.ts` (pur, testé) : formule de dégâts dérivée des
    stats (`hitDmg(power, atk, def)` → scale avec le niveau), kits par AM, comportements par NME,
    et un **simulateur headless** `autoSim` pour les tests. 30/30 checks (`live.test.ts`).
  - **Un kit de gameplay V1 DISTINCT par AM jouable** (feeling volontairement différent) :
    - **Poofowl** — *garde & parade* : Coup / Garde (2 boucliers) / Décharge. Pare → réserve →
      décharge. Le contre-puncheur (kit de référence du proto).
    - **Emberpup** — *combo ramp* : Griffe / Brasier (brûlure) / Curée. Combo ×1→×4 qui monte,
      **aucune garde**, se casse si on encaisse. Tout en agression, fragile.
    - **Fungoot** — *poison* : Crachat (poison empilable) / Spores (défense qui empoisonne
      l'attaquant) / Frappe. L'usure lente, punit qui le touche.
    - **Haloux** — *esquive & riposte* : Frappe / Esquive (parade parfaite → riposte immédiate) /
      Riposte (décharge). Glass cannon au timing.
  - **3 NME possibles, comportements radicalement différents** (réduction demandée) :
    - **Sprigling** — rythme lisible (petit, petit, GROS coup), apprends la cadence.
    - **Cobbleback** — tortue : se protège puis **charge un slam massif** (exposée pendant la
      charge → frappe-la), **punit l'avidité/la passivité**.
    - **Murkwisp** — **feinte** : télégraphie un gros coup puis l'annule ~40% du temps, punit la
      garde panique. Le boss `gravelmaw` réutilise le comportement Cobbleback (alias).
    - La carte n'utilise plus que ces 3 espèces (Squawklet retiré des combats : `windy`→Murkwisp).
  - **Renderer** `renderer/LiveCombat.tsx` + `renderer/liveEngine.ts` (+ `live-combat.css` scopée
    `.live-combat`, keyframes préfixées `lc_`) : port fidèle du proto (DOM, télégraphe, juice,
    fenêtres d'input), généralisé aux 4 kits et 3 comportements, monté dans React via refs.
  - **Câblage GamePage** : `CombatCtx` porte désormais `player`/`enemy`/`seed` (plus de `result`
    pré-calculé) ; `onCombatFinish`/`finishDuel` consomment un `LiveResult`
    (`winner`, `pLifeLeft`, `eLifeLeft`, `pDamageDealt`) issu du combat joué en direct. Les
    récompenses/PV persistés/vie de boss en découlent. `CombatView.tsx` (replay) orphelin, conservé.
  - Vérif : `tsc -b` OK, `vite build` OK (51 modules), moteur live 30/30, moteur déterministe
    132/132. Rendu navigateur non capturé (chromium absent du sandbox), validation logique + build.

### 2026-07-15 — v0.41
- [Combat LIVE — proto v2.12 : confort mobile, bouton Charger, boucliers de garde, barre non linéaire]
  - **Confort mobile** : `touch-action:manipulation` + `-webkit-tap-highlight-color:transparent`
    + `user-select:none` sur les boutons (spam sans délai ni surbrillance grise), hover neutralisé
    sur écran tactile (`@media (hover:none)`).
  - **4e bouton « Charger »** : action par défaut désormais **matérialisée** par un bouton dédié,
    plus petit, en rangée sous les 3 actions (`.chargewrap`/`.act.wait.chargebtn`), **sélectionné
    par défaut** (`queued='wait'` à chaque tick). Raccourci clavier `4`.
  - **Re-clic = plus d'annulation** : `queue()` fixe simplement `queued=id` (spam autorisé).
    Revenir à Charger = cliquer sur le bouton Charger.
  - **Garde = 2 boucliers** (remplace le badge « N tours ») : 2 icônes bouclier (clip-path).
    Chaque tick, un bouclier disparaît (`vanish`, montée + fondu). À l'**activation** (parade d'un
    coup), les restants **sautent** (`bvanish`, pop + fondu) et la garde est consommée
    (`guardConsumed`). Sélectionner une attaque fait **sauter** les boucliers (`shieldJump`) pour
    signaler qu'ils vont tomber.
  - **Champ de protection persistant** (`#fieldP`, halo pulsé) affiché tant que `P.guard.hold>0`
    — ne disparaît plus après 700 ms.
  - **Barre de tick non linéaire** : `linear` → `cubic-bezier(.2,.55,.35,1)` (décélère vers la
    fin pour les actions de dernière minute), **même durée totale** (`TICK_MS`).
  - Vérif : `node --check` du script OK, 0 référence `.turns` résiduelle. Rendu navigateur non
    capturé (chromium absent du sandbox), validation logique manuelle.
  - **Arène fluide** : hauteur fixe 330 px → `aspect-ratio` (23/9, 2.6/1 ≥900 px, 16/11 ≤560 px)
    avec `min/max-height`. Fighters, nameplate, paddings, sprites et tailles de FX passés en
    `clamp()`. Breakpoints mobile (≤560/≤380 px) pour boutons, header, overlay.
  - **FX ancrés sur la position RÉELLE des sprites** : nouvelle fonction `layout()` mesure le
    centre des créatures et pose `--line-y` (clash/spark/onde) et `--float-y` (floaters) —
    recalcul au load/resize/start. Fin des % arbitraires (63–66 %) qui plaçaient les effets
    au-dessus des monstres.
  - **Floaters ré-ancrés** : partent du haut du sprite (`bottom:var(--float-y)`) au lieu du haut
    de la colonne (bug « -20 » en haut à gauche corrigé).
  - **Portée d'attaque dynamique** : `CONTACT/CONTACT_BIG` fixes (300/340) → fonction `contact(side)`
    calculée depuis l'écart réel entre combattants → l'attaquant atteint toujours l'adversaire
    quelle que soit la largeur. `shield-fx`/`shadow` recentrés sur le sprite.
  - Vérif : `node --check` du script OK, CSS équilibré (245/245). Rendu live non re-testé en
    navigateur (file:// bloqué par l'outil), validation géométrique manuelle.

### 2026-07-15 — v0.39
- [Combat LIVE — proto v2.10 : correctifs feedback]
  - **FX de clash abaissés** au niveau des créatures (spark 64 %, anneau 63 %, onde 66 % —
    étaient ~44/48 %, trop haut).
  - **Badge de durée sur la garde** : à la sélection affiche « 🛡 2 tours », puis « 🛡 1 tour »
    tant que la garde reste active (halo bouclier persistant sur le bouton).
  - **Feedback de charge de la décharge rétabli** : régression de la v2.9 (dépendance à
    `@property`/transition CSS). Remplacé par une **montée d'anneau pilotée en JS** (`addStored`
    anime `--p` via requestAnimationFrame, easeInOut 550 ms) + pulse du bouton (`.charging`) +
    libellé « +N décharge ». `renderButtons` n'écrase plus `--p` pendant l'animation.
  - **Floaters lisibles** : centrés + `white-space:nowrap` ; libellés texte (PARADE, +N
    décharge…) en pastille sombre (`.floater.txt`) → plus de texte coupé/mal placé.
  - Vérif jsdom : jauge 0→40 progressive, badge garde 2→1, aucun bug.

### 2026-07-15 — v0.38
- [Combat LIVE — proto v2.9 : fenêtre de garde élargie, FX de gains, éco parade]
  - **Fenêtre de garde tardive élargie** : reste ouverte pendant **tout le déplacement de
    l'ennemi** (windup + approche entière), fermeture juste avant la frappe (`raceLate(appr)`).
  - **Parade parfaite = +1 énergie net** (au lieu du remboursement complexe) : `lateAbsorb`
    ne déduit plus de coût, la régen de fin de résolution donne le +1.
  - **FX de gain d'énergie** : `renderFighter` réutilise les pips ; les crans **nouvellement
    gagnés** passent en **vert** avec un pop (`.pip.gain`) + floater « +N ⚡ » (`energyGainFx`),
    déclenché à la régen de fin de résolution (charge / parade parfaite).
  - **Jauge de décharge progressive + FX** : anneau `--p` rendu **animable** via `@property`
    (transition .55 s) — les boutons/pips ne sont plus reconstruits à chaque render mais mis
    à jour en place. À la défense, `addStored` fait monter la jauge progressivement + **pulse**
    du bouton (`.charging`) + floater « +N décharge ».
  - **Coût de la décharge repositionné** : pastille centrée en haut du bouton (au lieu du coin,
    qui chevauchait l'anneau), avec liseré couleur burst.
  - Vérif jsdom : parade en cours de déplacement (0 dégât, réserve +9 → jauge 30 %, énergie
    +1 net), FX crans verts à la charge (1 cran `.gain`), aucun bug.

### 2026-07-15 — v0.37
- [Combat LIVE — proto v2.8 : garde tardive « triche », fade menu, grosses attaques exagérées]
  - **Garde tardive (« triche »)** : quand l'ennemi frappe **et que le joueur n'a pas
    attaqué**, il peut encore lever la garde **jusqu'à la moitié du mouvement d'approche**
    de l'ennemi. Fenêtre ouverte pendant windup + 1re moitié de l'approche (`openLateGuard`/
    `raceLate`/`triggerLateGuard`). Réussite = **parade parfaite** (`lateAbsorb` : 0 dégât,
    réserve +150 %, coût de garde −2 énergie, FX bouclier + « PARADE ! » + anneau). Passé le
    délai, la fenêtre se ferme (`closeLateGuard`) et le coup part.
  - **Fade-out du menu** : `.btns.locked` (opacité .28 + grayscale + pointer-events none)
    dès qu'on ne peut plus changer d'action ; le menu **reste visible pendant la fenêtre de
    garde tardive** (seule la Garde reste active et mise en avant).
  - **Grosses attaques exagérées + FX** : `strikeLand` sépare gros/petit. Big = charge,
    windup marqué, **grand arc** (apex 122), **traînée de vitesse** (`.dashP/.dashE`),
    et impact spectaculaire `bigImpact` (flash blanc → éclat orienté vers le perdant, spark,
    **onde de choc** `#shock` positionnée, anneau, gros shake, floater 💥). Petites attaques
    gardent un impact sobre → contraste net de puissance.
  - Vérif jsdom : parade tardive (hp intacte, réserve +9, énergie −2), coup encaissé sans
    garde (60→40), menu locked correct (input/fenêtre = visible, sinon estompé), gros FX sans erreur.

### 2026-07-15 — v0.36
- [Combat LIVE — proto v2.7 : boutons refaits, arcs, repos -1]
  - **Boutons refondus** : passage à **3 boutons** (Coup / Garde / Décharge) — le bouton
    « Charger » est retiré (ne rien faire = charger par défaut, inchangé côté résolution).
    Nouveau style : accent de couleur par type (`--accent`), pastille d'icône ronde, barre
    d'accent en haut, hover surélevé avec halo coloré, badge de coût. Grille 3 colonnes.
    Raccourcis clavier réduits à 1/2/3.
  - **Repos (énergie pleine 2 ticks)** : retire désormais **-1 énergie** au lieu de vider
    toute la barre (`f.nrj = max(0, nrj-1)`). Contretemps léger plutôt que punitif.
  - **Déplacement en ARC** pour les attaques (`moveXY`/`arcTo`) : bond montée→apex→chute.
    **Grand arc** (apex ~76 px) pour les grosses attaques = impression de puissance ;
    **petit arc** (~26 px) pour les attaques normales.
  - **Cue ennemi grosse attaque** télégraphiée **500 ms plus tôt** (fenêtre de réaction
    allongée sur les gros coups) : `revealIn -= 500` si `type==='big'`.
  - Vérif jsdom : 3 boutons, repos 4→3, arcs (grand/petit) sans erreur.

### 2026-07-15 — v0.35
- [Combat LIVE — proto v2.6 : jauge décharge en anneau + clash à tension]
  - **Jauge de décharge** retirée de l'arène → **anneau circulaire autour du bouton
    « Décharge »** (conic-gradient masqué, rempli par la variable `--p` 0..100 ; classe
    `full` + glow quand la réserve est pleine). Code `store gauge` supprimé de `render()`,
    bloc HTML `#storeP/#sfillP` retiré.
  - **Emoji mouton retiré** du nom de Poofowl.
  - **Clash refondu pour la tension** : les deux créatures se **rejoignent au centre sans
    échanger de place** (distance calculée dynamiquement via `clashReach()` sur les rects
    des `.fighter`, arrêt face à face) → **FX de clash** (spark + flash + shake + vibration
    `fx-hit` des deux) → **suspense** → **attaque simultanée** (thrust) → résolution :
    - **Égalité** (ratio < 1,5) : **PARADE** — anneau doré central (`#clashring`), flash or,
      floater « PARADE », rebond symétrique.
    - **Gagnant** (ratio ≥ 1,5) : le gagnant **enfonce** sa frappe, le perdant est **projeté
      vers son bord** avec **éclat directionnel orienté vers lui** (`dirFlash`) + gros shake +
      dégâts → on lit immédiatement qui gagne.
  - Nouveaux FX : `#clashring` (anneau), `dirFlash()` (éclat orienté), `ring()`.
  - Vérif jsdom : render sans erreur (store retiré), clash gagnant + égalité OK, `--p` 0→100.

### 2026-07-15 — v0.34
- [Combat LIVE — proto v2.5 : rythme + cue tardive + clash épuré]
  - **Durée de tick : 4 s → 2 s** (`TICK_MS=2000`). Combat plus nerveux.
  - **Cue ennemi révélée tardivement** : au début du tick l'ennemi reste **neutre (idle)**,
    il ne montre plus son intention immédiatement. Son aura de télégraphe (`tg-*`/`armed-*`)
    apparaît via `showEnemyCue`, planifiée **entre 1000 ms et 100 ms avant la fin du tick**
    (`revealIn = TICK_MS - (100 + rand*900)`, `cueTimer`). Nettoyé dans `reset`/`endGame`.
    → fenêtre de réaction courte et variable pour le joueur.
  - **Clash simplifié** : windup → **les deux avancent et se percutent au milieu** (accél.
    `EASE_HIT`) → collision (spark/shake) → **suspense** au contact → **égalité** (rebond)
    ou **break** (le plus fort passe, l'autre repoussé). Suppression du double arrêt+thrust.
  - Vérif jsdom : tick 2 s OK, boutons `ON`, cue neutre à t=60 ms puis `tg-*` ~1,5 s ;
    `animClash`/`animShieldAbsorb`/attaques sans erreur.

### 2026-07-15 — v0.33
- [Combat LIVE — proto v2.4 : vraies attaques + clash figé au milieu]
  - **Séquence d'attaque en 6 temps** (`attackSeq`) partagée par joueur/ennemi : windup →
    course (décélération) → **ARRÊT NET juste avant le coup** (temps mort) → **frappe**
    (thrust rapide `EASE_HIT` + pose d'attaque `strikePose` : inclinaison/étirement vers la
    cible, flip préservé) → impact → recul. Plus de simple translation + dégât.
  - **Clash** : les deux courent jusqu'au **milieu**, s'**arrêtent net face à face** (temps
    mort ~340 ms), puis se percutent simultanément au centre ; suspense au contact avant
    résolution (repoussé / rebond). Easings dédiés : `EASE_STOP` (arrêt) / `EASE_HIT` (percussion).
  - `animShieldAbsorb` aligné sur le même schéma (course → stop → frappe sur le bouclier).
  - Vérif jsdom : `animClash`, `animShieldAbsorb`, attaques joueur/ennemi exécutées sans
    erreur ; boucle de ticks OK, boutons `ON`.

### 2026-07-15 — v0.32
- [Combat LIVE — proto v2.3 : vie & fluidité]
  - **Vrai fix « boutons bloqués après le 1er tick »** : dans `startTick()`, `render()`
    était appelé **avant** `phase='input'` → les boutons étaient (re)dessinés en état
    `resolve` (désactivés) et jamais rafraîchis jusqu'au tick suivant. Au 1er tick ça
    marchait car `start()` avait déjà mis `phase='input'`. Corrigé : `phase='input'`
    (puis `settle`) **avant** `render()`. Confirmé en jsdom : boutons `ON` aux ticks 1→4.
  - **Idle animations distinctes par créature** (designé + implémenté) : Poofowl =
    respiration/dandinement moelleux (`idleP`, 2,3 s) ; Sprigling = balancement de plante
    + respiration verticale plus lente (`idleE`, 2,9 s). Boucles CSS sur `.sprite`.
  - **Anticipation sur choix d'action** : quand le joueur met une action en file, l'idle
    devient une **pose d'intention** avant résolution — `aim-peck` (penché, prêt à bondir),
    `aim-guard` (se ramasse + halo bouclier), `aim-burst` (tremble + montée d'énergie),
    `aim-wait` (respiration ample). Reset propre à la résolution.
  - **Course au contact** : lunges rallongés (`CONTACT` 300 / `CONTACT_BIG` 340 px) avec
    **windup** (repli d'anticipation) avant le dash ; clash avec pré-repli symétrique.
  - **Fix technique du mouvement** : le déplacement inline (`transform`) était écrasé par
    l'origine « animation » des classes idle/télégraphe. `moveSprite` force désormais
    `animation:none` inline pendant le dash ; `settle()` rend la main aux boucles CSS
    à la fin de chaque anim → l'ennemi se déplace vraiment lors de ses frappes.
  - **Télégraphe ennemi = son idle vivant** : `tg-small/tg-big` animés (prépa qui respire
    et se gonfle), `armed-*` (vibration/menace) redéfinis après `tg` pour gagner la cascade.
  - Vérif : syntaxe OK (`node --check`) + harness jsdom (ticks 1→4, attaque incluse), aucun blocage.

### 2026-07-14 — v0.31
- [Combat LIVE — proto v2.2 : fix blocage + sprites /4 + télégraphe épuré]
  - **Vrai fix du blocage au tick 2** : `classList.add('armed', '')` passait un **token vide** (attaque « small ») → `SyntaxError` non catchée dans la chaîne async → la boucle mourait, phase figée en `resolve`. Reproduit et confirmé via harness **jsdom headless**. Corrigé.
  - **Barre de charge de l'ennemi supprimée** (la « 2e barre jaune » au-dessus du NME). Le télégraphe passe désormais **uniquement par l'aura du sprite** : `tg-small` (halo ambre) / `tg-big` (rouge + grossit) en prépa, + `armed-*` (pulsation/menace) au tick de frappe.
  - **Sprites réduits ~/4** (34×46 px), ombres/halo de garde/repos ajustés ; déplacement de clash rallongé (270 px/côté) pour que les mini-sprites se rejoignent au centre.
  - Vérif : enchaînement des ticks 1→6 (grosse attaque incluse) sans erreur (jsdom), syntaxe OK.
- [Combat LIVE — proto v2.1 : correctifs feel] Retours de test sur `combat-live-proto.html`.
  - **Bug corrigé** : la boucle bloquait au tick 2 (double chemin de résolution clic/timer). Réécrite en boucle unique `startTick → onTickEnd → resolve → startTick`.
  - **Clic = mise en FILE** : cliquer une action la sélectionne (surlignage ✓) mais la **résolution attend la fin du tick** (plus de résolution immédiate). Re-clic = désélection.
  - **Tick allongé à 4 s**.
  - **Facing corrigé** : Poofowl regarde à gauche dans le sprite source → il est désormais **flippé** (le joueur, à gauche) pour faire face à l'ennemi ; Sprigling (à droite) non flippé. Les deux se regardent enfin.
  - **Sprites plus petits** (88px) ; **barres de vie compactes** (7px) repositionnées juste au-dessus de chaque sprite ; pips/jauges réduits en conséquence.
  - **Petit FX + anim par move** : charge (bob + ⚡), garde (halo bleu + anneau), attaque (hop + fx-hit sur la cible), décharge (wind-up doré). Déplacements d'attaque raccourcis ; clash gardé ample (collision au centre + suspense).
- [Combat LIVE — proto v2 : temps réel, visuel-first] Itération du banc d'essai `combat-live-proto.html` suite au test joueur.
  - **Temps réel** : écran de départ (« Prêt ? »), la clock **avance seule** (~2,4 s/tick, barre de compte à rebours). Ne rien faire = **charger** (défaut). Cliquer une action = la jouer immédiatement ce tick.
  - **Éco d'énergie resserrée** : **attaquer ne régénère PAS** l'énergie du tick (seuls charger/garder donnent +1). **Garde plus chère** (coût 2). **Réserve de décharge plafonnée** (STORE_MAX = 30) avec jauge qui vire au **rouge** en approchant du max et **bouton qui brille** à plein.
  - **État « repos »** : rester à énergie pleine 2 ticks d'affilée → **décharge totale à 0** (cue visuel : sprite qui s'affaisse + 💤 + pips qui clignotent). Punit l'accumulation passive.
  - **Télégraphe 100% visuel, sans texte** : l'ennemi attaque **toujours avec 1 tick de prépa**. Jauge de charge au-dessus de lui + aura (**ambre** = petit coup, **rouge + grossit + tremble** = grosse attaque à parer). Aucun texte de combat, aucun log.
  - **Animations longues** : vrais déplacements (aller/impact/retour), wind-up de la décharge, et **clash chorégraphié** (les deux avancent → collision + étincelle → **suspense** → break d'un côté ou égalité/rebond).
  - **Divers** : sprites qui se font face ; **Recommencer** réinitialise aussi l'état visuel des sprites (rotation K.O., filtres). Logique éco/repos vérifiée en headless (9/9), résolution clash/garde (13/13).
- [Combat — EXPÉRIMENTATION : refonte vers un combat LIVE tick/énergie] Nouveau prototype de combat **hors app**, isolé dans `combat-live-proto.html` (HTML autonome, sprites embarqués en base64). **Rien n'est intégré au jeu React** — c'est un banc d'essai pour valider le feel avant décision d'intégration. Le combat déterministe actuel (`game/engine/combat.ts`) reste la référence en prod.
  - **Designé (ruleset) :**
    - Combat en **ticks** (pas de temps réel pur) : chaque tick commence par **+1 énergie à tous** (barre max = **4**), l'ennemi **télégraphie** son action du tick, le joueur **choisit UNE action** (offensive OU défensive OU charger), puis **tout se résout en fin de tick**. Auto-avance si rien à faire, pause dès qu'il y a un choix.
    - **Ordre de résolution :** priorité > défenses > attaques.
    - **Clash** (deux attaques le même tick) : si ratio de dégâts ≥ 1.5 → le plus fort touche, l'autre encaisse ; sinon **dégâts annulés**. (Prévu plus tard : un AM spécialiste du clash gagnant systématiquement.)
    - **Défense :** coûte 1 tick pour armer, tient **X ticks** en attendant une attaque. **PARFAIT** si frappé pile au tick d'armement (bonus + **remboursement d'énergie**). Attaquer annule/consomme la garde. Coût d'énergie croissant avec la durée (les parfaits remboursent).
    - **Multi-tick :** certaines attaques ont un **windup** (charge télégraphiée sur un tick avant de frapper → l'attaquant est à découvert pendant la charge). Prévu aussi : moves avec ticks de récup.
  - **Designé (3 starters, identités) :**
    - **Poofowl 🐑 (shield-burst)** — *Garde* absorbe le coup dans une **réserve**, puis *Décharge* renvoie 8 + toute la réserve. Boucle : encaisser le gros coup en garde parfaite → décharger.
    - **Emberpup 🔥 (combo ramp)** — charger sa barre puis attaquer **plusieurs ticks d'affilée** avec dégâts **croissants (×1,×2,×3,×4)**. Drawback : un move raté (défense forcée / clash perdu) **casse le combo** + **1 tick de récup**.
    - **Haloux 🕊️ (esquive-riposte)** — lecture du télégraphe : *Esquive* parfaite → annule + **charge de riposte** + énergie rendue ; *Riposte* = gros coup conditionné à la charge.
  - **Designé (roster NME) :** **Sprigling** (« petit, petit, GROS coup » — slam télégraphié à esquiver/absorber), **Cobbleback** (turtle lent qui charge un coup massif multi-tick, punit l'avidité), **Murkwisp** (feinte : télégraphie un gros coup puis parfois l'annule pour punir la défense panique).
  - **État d'implémentation :** prototype jouable = **1 duel Poofowl 🐑 vs Sprigling** (medium/tactique, HP 60 vs 65). Implémenté : boucle de tick, énergie +1/tick, télégraphe d'intention, garde/garde parfaite + réserve, décharge, clash, windup du slam, juice (lunge/shake/floaters/bannières PARFAIT/CLASH), log, raccourcis clavier 1-4. Non implémenté (designé seulement) : Emberpup, Haloux, Cobbleback, Murkwisp, moves à priorité, AM spécialiste clash, ticks de récup génériques. Logique vérifiée par port headless (13/13 checks).
- [DA — « prototype gris » + lisibilité + House refondue + onboarding/carte allégés] Deuxième vague de polish demandée par le joueur.
  - **Palette prototype** : fond de page passé d'un lavande bleuté à un **gris neutre clair** (`--bg #eceef1`), surfaces/lignes désaturées. **Contrastes texte renforcés** : `--ink #1a1c22`, `--ink-2 #383c45`, `--dim #565b66`, `--faint #868b96` ; accents *foncés pour rester lisibles comme texte* (`--acc`, `--gold`, `--green`, `--red`). Fonds décoratifs colorés retirés : **carte du monde** (radial teal/indigo + grille pointillée → surface unie) et **salle de combat** (halo violet → dégradé gris neutre).
  - **House — clic AM « débuggé »** : suppression du **zoom en place + volet coulissant** (animations `flex-basis`/`white-space` sources de bugs de layout). Nouvelle interaction simple : la pièce affiche le compagnon qui erre (errance + émotes conservées), **un clic ouvre directement la fiche** (`onOpenSheet`). Sous la pièce : carte d'identité cliquable (nom + niveau + PV), points de sélection d'équipe, rappel de quêtes, 3 sorties. Halo/ombre au sol neutralisés. Supprimé : `house-stage/panel/open`, `house-critter-anim/zoomed/walking`, `houseHop`, `house-back/caption/exit-btn`.
  - **Onboarding allégé** : copie fortement raccourcie à chaque étape (leads, cartes de stats « À 0, K.O. » / « Dégâts infligés », carte de talent, boucle « Explore → Or & XP → Renforce-toi », bouton « Adopter X »). **Bulles du combat guidé** raccourcies (ordre du tour, talent, fin).
  - **Carte du monde minimalisée** : en-tête « Carte du monde » retiré, **« % exploré » retiré** sous chaque zone (l'anneau suffit), **orbes épurés** (surface unie légèrement teintée, bord fin, ombre douce ; halos colorés retirés).
  - **Réduction de texte continue** : méta de progression de zone (`{%}` + « Plus que N » / « ✦ Zone suivante ouverte »), modals de récompense/duel condensés (dégâts en icônes), fiche AM (`Humeur : X`, `XP x/n`, « Espèce », bloc *Interagir* sans sous-titre), bestiaire sans phrase d'intro.
- [Tests] `tsc -b` OK, `vite build` OK (50 modules, outDir temporaire), moteur **132 ok / 0 échec** (front pur).

### 2026-07-12 — v0.26
- [DA — refonte « moins de texte + icônes SVG », pass responsive] Vague de nettoyage transversale demandée par le joueur : **plus minimaliste, plus clean, expliquer par l'icône plutôt que par le texte**.
  - **Système d'icônes SVG** : nouveau `game/icons.tsx` — composant `<Icon name=… />`, set de ~35 icônes *line* mono-trait (`currentColor`, viewBox 24, stroke arrondi) : hp/atk/def/spd, gold/potion, map/arena/shop/journal/bestiary/team, heal/pause/play/flee, back/close/menu/power/reset, lock/warn/star/levelup/boss/check/gift, plus/return/chat/home. Les axes de stats portent leur couleur (`--ico-hp` rouge, atk orange, def bleu, spd teal ; or/potion). **Décision** : remplacer uniquement les emojis *chrome* (stats, monnaie, navigation, actions, en-têtes, tags système). Les emojis de **contenu** sont conservés (émotes de la House, PNJ, personnalité, icônes de zones sur la carte, pops de statut ☠️/🔥 en combat, titres expressifs de modals 🎉/💀/🏆, micro-copy des toasts).
  - **Réduction de texte** : suppression des sous-titres/hints explicatifs redondants — `team-strip-sub` (« clique un compagnon… »), `world-sub` (« clique une zone… »), `exit-sub` des 3 sorties de la House (Explorer/Arène/Boutique désormais icône + label seul), prose du havre de paix, hints raccourcis (boss, K.O., arène). Libellés de boutons de soin compactés (icône + valeur, détail en `title`).
  - **`roleOf`** renvoie désormais `{ icon, label }` ; nouveau `RoleTag` (icône d'axe + libellé) remplace la chaîne emoji « 💨 Rapide ».
  - **Responsive (desktop ↔ mobile)** : carte du monde plus aérée sous 680px (canvas plus haut, orbes/labels réduits → plus de chevauchement des 3 zones) ; en-tête sans débordement < 420px (bourse et boutons réduits) ; en-tête de combat qui *wrap* (nom tronqué, contrôles de vitesse repliables) ; salle de combat plus compacte < 560px ; `heal-row` sur une ligne, pleine largeur < 360px.
- [Tests] `tsc -b` OK, `vite build` OK (50 modules, vérifié via outDir temporaire — `dist/` monté non inscriptible), moteur **132 ok / 0 échec** (front pur, moteur non touché).

### 2026-07-12 — v0.25
- [DA — fond global `.game-shell`] **Simplification du fond de page principal** : suppression des deux radial-gradients colorés (indigo/teal) superposés au linear-gradient, remplacés par un **gris uni** (`var(--bg)`, `#f2f4fb`). Jugé « immonde » par le joueur ; le fond de page est désormais plat, sans halo décoratif.

### 2026-07-12 — v0.25
- [Polish — grosse vague UX/Flow/UI/Visuel (P0)] Passage de polish transversal après audit des 4 axes.
  - **Combat / juice** : screen-shake de la salle à chaque impact (`sk`/`sk-big` sur crit), squash & stretch (`fLunge` sur l'attaquant, `fHurt` recul de la cible), **traînée « chip damage »** sur les barres de PV (couche `hpbar-trail` qui rattrape en retard → on lit l'ampleur d'un coup), crit revalorisé (pop doré 30px arqué `floatUpCrit` + caption « Coup critique ! » + « ✦ »), chute au K.O. (`koFall`), petit shake sur les ticks de statut.
  - **Flow / navigation** : bouton **Abandonner** dans l'entête de combat (confirm, aucun gain/perte) → plus d'écran borgne ; **gestion du back navigateur/Android** (`popstate` + `history.pushState`) : ferme le modal ouvert, puis le menu, puis remonte à la maison, sans jamais quitter l'app. Confirm ajouté sur « Recommencer » de la bannière zones pacifiées (perte totale).
  - **UI / a11y** : `:focus-visible` **global** (anneau indigo sur boutons/liens/champs) → navigation clavier enfin visible ; `aria-label` sur les ✕ (menu, chat, Modal générique). Bug CSS corrigé : `.branch-*` utilisait `var(--border)`/`var(--accent)` inexistants → remplacés par `--line`/`--acc` (bordures/couleurs des branches enfin rendues).
  - **Home / ambiance** : le compagnon **respire au repos** (`houseBreath` idle permanent), **réagit au clic** (rebond joyeux `houseCheer` + émote flottante ❤️/✨/🎵) et lâche une **émote spontanée** toutes les ~11–22 s → sensation de vie ; corps isolé dans `.hc-body` pour ne pas entrer en conflit avec le flip/zoom/marche.
- [Tests] `tsc -b` OK, `vite build` OK (49 modules), moteur **132 ok / 0 échec** (inchangé — polish purement front, moteur non touché).

### 2026-07-12 — v0.24
- [Auto Monsters — refonte identités & branches] **Chaque AM jouable a désormais un playstyle clair + 2 branches de spécialisation cohérentes**, choisies par le joueur à un palier (`BRANCH_CHOICE_LEVEL = 3`, irréversible), dont les talents se débloquent par niveaux (core au niv 3, upgrade au niv 6). Pas de changement de forme (décision : branches = ensembles de talents uniquement).
  - **Emberpup** 🔥 (agressif) → **Frénésie** (critiques → *Fournaise* : chaque crit augmente durablement la Force) | **Brasier** (*Embrasement* : brûlure DoT → *Pyromane* : +35% dégâts sur cible en feu).
  - **Fungoot** 🍄 (poison) → **Spores défensives** (*Spores* : empoisonne l'attaquant quand touché → *Peau de pierre*) | **Virulence** (*Inoculation* : empoisonne la cible → *Virulence* : +35% dégâts sur cible empoisonnée).
  - **Poofowl** 🐑 (survie) → **Rempart** (*Peau de pierre* → *Second souffle* : régén ×2 sous 40% PV) | **Draineur** (*Ponction* : vol de vie 30% → *Sangsue* : 55%).
  - **Haloux** 🕊️ (esquive, inné passé de `swift` à **`evasion`** +16% esquive) → **Riposte** (contre à l'esquive → *Contre parfait* : ripostes critiques) | **Élan** (esquive → +Force stacking → *Danse du vent* : esquive → +esquive/+vitesse).
- [Moteur — F7 statuts implémenté] **Altérations sur la durée** (`poison`/`burn`) : `StatusEntry` sur le `Fighter`, dégâts appliqués au **début du tour de la victime** (actions `status` + `statusTick`), retrait auto à expiration, mortelles. Généralisation du **critique** (`critChance`/`critMult` au lieu du hard-code Frénésie), **amplification vs statut** (`ampVsStatus`), **vol de vie** (`lifesteal`), **rage au crit** (`rageOnCrit`), **régén conditionnelle** (`regenLowMult`), **riposte/élan à l'esquive** (`onDodge`, flags `riposte`/`riposteCrit`/`dodgeAtkGain`/`dodgeSnowball`). Déterminisme préservé (même seed → même log).
- [Data/Modèle] `SpeciesDef.branches?` (type `BranchDef` : id/nom/icône/desc + `tiers` niveau→talent) ; `Character.branch` ; helpers `branchesOf`/`branchDef`/`activeTalents`/`needsBranchChoice` (data) et `chooseBranch` (progression). 14 talents (dont 12 nouveaux : evasion, fournaise, embrasement, pyromane, spores, inoculation, virulence, secondwind, ponction, sangsue, riposte, contreParfait, elan, danse).
- [UI] **Modal de choix de branche** (au palier via l'écran de récompense, ou depuis la fiche AM), **bloc « Spécialisation »** sur la fiche (voie choisie + talents débloqués/verrouillés par palier), rendu `status`/`statusTick` dans `CombatView` (pop rouge `-X ☠️/🔥`, labels de branche).
- [Tests] `engine.test.ts` : **+27 checks** (branches, déblocage par niveau, statuts poison/brûlure en combat, riposte/élan/vol de vie, amplification, déterminisme). **132 ok / 0 échec** (105 → 132). `tsc -b` OK, `vite build` OK (bundle émis).

### 2026-07-12 — v0.23
- [Onboarding — refonte] **Abandon du dialogue Disco Elysium (mentor Sylve)** au profit d'un **wizard plein écran en 4 étapes** avec barre de progression (pastilles), une action/concept par écran : **(1) Choisis ton monstre** (3 starters, tag de rôle + barres de stats + talent inné, phrase-clé « ton monstre se bat tout seul »), **(2) Sa fiche** (zoom sur le choix, 4 cartouches ❤️⚔️🛡️💨 avec valeur + explication, encart talent inné « se déclenche seul »), **(3) Ton premier combat** (combat guidé réel contre un ennemi débilité, seed fixe, vitesse ×1), **(4) Ta maison** (rappel du pilier « stratégie = préparation » + schéma de boucle Explorer→Or/XP→Renforcer, puis adoption).
- [Combat — mode tutorial] **`CombatView` accepte `tutorial?: boolean`** : le playback se **met en pause automatiquement** aux jalons pédagogiques avec une **bulle explicative** (bouton « Compris → ») — (a) 1er `goto` : « à qui le tour ? » (rôle de la Vitesse), (b) 1er `talentProc` : « un talent s'est déclenché seul », (c) `finish` : « tu n'as rien piloté, tout se joue avant ». Rétro-compatible (hors tutorial, comportement inchangé). `.combat-arena` passé en `position: relative` pour l'overlay de bulle.
- [Code] `Onboarding` réécrit dans `GamePage.tsx` (steps 0–3, combat calculé via `runCombat` seed 424242 vs `makeTutorialEnemy` = sprigling débilité). Styles `.de-*` (dialogue) remplacés par `.ob-*` + `.tuto-bubble-*` dans `game.css` ; `.starter-*` conservés. Mentor Sylve/`npc.lines` plus utilisés par l'onboarding.
- [Build/Tests] `tsc -b` OK, `vite build` OK (49 modules, bundle émis — vérifié via outDir temporaire, `dist/` monté non inscriptible depuis le sandbox). Moteur : 105 ok / 0 échec.

### 2026-07-12 — v0.22
- [Home / House — visuel] **Refonte du fond de la pièce.** Suppression de la « boîte grise » (`--surface-2` + bordure + ligne de sol 1px + fenêtre grise en boîte) jugée peu lisible. La pièce a désormais un **fond transparent = prolongement seamless de la couleur de la page/house** (fond uni, plus de rupture de teinte ni de cadre). Deux éléments existants recyclés en pur décor lumineux (sans toucher `House.tsx`) : `house-floor-line` → **ombre douce au sol** large (radial-gradient flou) qui ancre le compagnon quelle que soit sa profondeur ; `house-window` → **halo lumineux ambiant** (radial violet/indigo flou) qui donne du volume. L'ombre propre du compagnon (`house-critter-shadow`) reste le repère de contact principal.
- [Lisibilité — contraste] **`--dim` foncé de `#838aac` à `#6b7098`** : le texte secondaire (légendes, sous-titres de sorties, `muted`, niveaux) était sous le seuil WCAG AA sur blanc (~3.4:1) ; il passe désormais AA (~4.8:1 sur blanc). Palette et hiérarchie visuelle préservées.
- [Tests] `tsc -b` OK, `vite build` OK (bundle émis), moteur 105 ok / 0 échec.

### 2026-07-12 — v0.21
- [UX — boucle raccourcie] **Chemin House→combat aplati** : le sous-menu « 🚪 Sortir » est supprimé — les 3 sorties (🗺️ Explorer / 🏟️ Arène / 🏪 Boutique) sont affichées **directement** sur la House. Le **fade artificiel de 480 ms** à l'entrée d'une zone est retiré (entrée immédiate). La **pick-list « Choisis ton AM » est masquée quand l'équipe n'a qu'un seul combattant** (zone et arène : le seul AM est envoyé d'office, sa fiche PV reste visible).
- [Quêtes — auto-claim] **Les quêtes du jour sont auto-réclamées** : à la complétion, l'or/les potions sont **crédités immédiatement** (`bumpQuest` applique la récompense et marque `claimed`), toast « ✅ … +30💰 ! ». Plus de bouton de claim dans le Journal (les quêtes finies affichent « ✓ +X💰 ») ; `claimQuest` supprimé. Le bonus quotidien, lui, reste à réclamer (rituel volontaire).
- [Quêtes — visibilité] **Rappel des quêtes sur la House** : pilule compacte (`house-quests`) sous le compagnon montrant la progression des quêtes non finies (« ⚔️ 2/3 · 💞 1/3 ») ; clic → ouvre le Journal 📅. Disparaît quand tout est fait.
- [Nettoyage — client joueur] **Éditeur d'espèces retiré de l'UI** (entrée du menu ☰ + modal supprimés ; `SpeciesEditor.tsx` et l'API `species_overrides` restent en place, outil de dev à réexposer si besoin). **`BuildFooter` (hash git/auteur/date) supprimé** du client.
- [Tests] `daily.smoke.ts` adapté à l'auto-claim (16 checks ok). Moteur : 105 ok / 0 échec. `tsc -b` + `vite build` OK.

### 2026-07-12 — v0.20
- [Stats] **Passage de 5 à 4 stats** : la **stamina (`sta`) est retirée** partout (type `Stats`, `data.ts`, `progression`, `fighter`, `Fighter` runtime, Éditeur d'espèces, fiches). Elle était **jamais lue en combat** (stat morte) — F8 « énergie » abandonné sous cette forme. Les 4 stats restantes (❤️ Vie, ⚔️ Force, 🛡️ Armure, 💨 Vitesse) ont chacune un effet visible.
- [Combat — lisibilité] **Nouvelle action `talentProc` dans l'ActionLog** émise par le moteur quand un talent se déclenche : **Frénésie** (« FRÉNÉSIE ! » au crit), **Peau de pierre** (« 🪨 −15% »), **Épines** (« 🌵 −X » sur la cible), **Régén** (« +X 💚 »). Le renderer (`CombatView`) pop un **label flottant violet** au-dessus du combattant → l'effet est enfin relié à sa cause à l'écran. Rétro-compatible (le renderer ignore l'inconnu).
- [Fiche/UX] **`StatRow` refondu en barres étiquetées + tag de rôle** (💨 Rapide / ⚔️ Cogneur / 🛡️ Tank / ⚖️ Polyvalent) déduit des stats. **Talents affichés avec icône + infobulle** homogène (icône · catégorie — effet) partout : liste de la fiche (`TalentList`), chip du talent inné (avec ligne d'effet visible), pastilles colorées par catégorie (offensif/défensif/utilitaire).
- [Talents] `TalentDef` enrichi : `icon` + `desc` clarifiée (phrase d'effet lisible). Helpers `talentIcon`, `talentTooltip`, `CATEGORY_LABEL`.
- [Tests] Moteur : 105 ok / 0 échec (inchangé). `tsc -b` OK, `vite build` OK (bundle émis).

### 2026-07-12 — v0.19
- [Boucle quotidienne] **Nouveau pilier « revenir tous les jours »** (state v6) : **bonus quotidien** à la connexion (or croissant avec le **streak** de jours consécutifs, +1 potion tous les 3 jours), **3 quêtes du jour** (gagner 3 combats, 3 interactions, gagner 1 duel d'arène) avec récompenses à réclamer, reset au changement de jour. Nouveau **Journal du jour** (modal 📅, s'ouvre seul la 1re fois de la journée, pastille rouge quand quelque chose est réclamable).
- [Repos hors-ligne] Les AM **récupèrent PV et humeur avec le temps réel d'absence** (`applyOfflineRest` : PV 0→max en ~6 h, humeur qui dérive vers 60, rien sous 10 min). Toast de bienvenue « tes AM se sont reposés » au retour. `lastSeen` estampillé à chaque sauvegarde.
- [Social / Arène] **Arène des Dresseurs** (duels asynchrones) : nouvel endpoint `GET /api/arena/opponents` (instantané du meilleur AM des autres joueurs), écran Arène accessible depuis la House (Sortir → 🏟️ Arène). Duels **amicaux** (PV non persistés), max **3 victoires récompensées/jour** (+20💰), rival bot « Nova » généré au niveau du joueur si aucun autre joueur n'existe.
- [UI/UX] **Header enrichi** : porte-monnaie (💰/🧪) toujours visible + bouton 📅 Journal avec pastille ; bourse dupliquée retirée de la House. **Système de toasts** (quête accomplie, bonus réclamé, repos) en bas d'écran. House : 3 sorties (Explorer / Arène / Boutique), empilées sous 390 px.
- [Tests] Nouveau `daily.smoke.ts` (15 checks : streak continu/cassé, claim/double-claim de quêtes, repos hors-ligne, compteur de duels). Moteur : 105 ok / 0 échec inchangé.

### 2026-07-11 — v0.18
- [Robustesse / Onboarding] **Correctif page blanche** : `GamePage` affichait une House vide (retourne `null` faute de personnage actif) quand `started=true` mais l'équipe était vide (état incohérent, ex. reset interrompu) — header + footer visibles, aucun contenu. La condition d'affichage de l'Onboarding est étendue de `!gs.started` à `!gs.started || gs.team.length === 0` : toute équipe vide retombe désormais sur le choix du 1er AM au lieu d'un écran blanc.

### 2026-07-11 — v0.17
- [Navigation] Bouton de sortie de la House renommé **« Explorer le monde »** (icône 🗺️, ex-« Forêt »), sous-titre « Carte du monde ».
- [Rencontres sauvages] **Suppression du choix d'ennemi** dans l'écran de zone : la rencontre non nettoyée est présentée automatiquement, **ennemi centré** (`enemy-preview.centered`, sprite agrandi). **Retrait de la ligne « Butin »** affichée avant combat (le choix de l'AM à envoyer combattre est conservé).
- [Bandeau équipe] **Rendu plus lisible comme « notre équipe »** : encadré distinct (carte avec bordure/fond, cohérent avec le reste de l'UI), titre **« 🛡️ TON ÉQUIPE »** + sous-titre, à la place d'un simple libellé au-dessus de la grille de compagnons.
- [Zones / PNJ] **Retrait des dialogues scriptés** façon Disco Elysium (répliques `npc.lines`) dans les zones. Les portraits + actions fonctionnelles restent accessibles (achat de potion, soin complet de l'équipe, location/retour d'un monstre au ranch), simplement sans texte de dialogue.
- [Carte du monde] **Avatar joueur remplacé par une mini image de l'AM en tête d'équipe** : `player-pin` passe d'un emoji 🧍 à un `<img>` du sprite du 1er AM de l'équipe.
- [Combat] **Refonte visuelle complète de l'arène**, façon House élargie : grande salle (fond dégradé, ligne de sol, fenêtre décorative) à la place de la mise en page en 2 colonnes + « VS ». Les deux combattants ont une position de repos fixe et **se font face** (sprite ennemi retourné pour regarder vers la gauche). À l'assaut : **déplacement jusqu'à l'adversaire** (action `goto`), impact avec bulle de dégâts (ou mention d'esquive), puis **retour à sa zone** (action `return`). `combat-wrap` élargi (980px → 1200px). Note : seule l'**esquive** existe côté moteur aujourd'hui — pas de mécanique de « blocage » implémentée (à spécifier si voulue).

### 2026-07-11 — v0.16
- [Menu ☰ / Compte] **Bouton « Réinitialiser le compte »** dans le menu hamburger : confirmation (`window.confirm`) puis appel de `resetGame()` (déjà existant) — remet l'état à `freshState()` (équipe, or, zones, progression effacés) et repasse par l'**Onboarding** (choix du 1er AM) puisque `started` redevient `false`. Distinct de la Déconnexion (qui ne touche pas à la progression).

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
| **Combat LIVE (v0.42)** | Oui (§3) | ✅ **Combat réel du jeu, partout** : `engine/live.ts` (moteur data-driven pur + `autoSim` headless, 30/30) + `renderer/LiveCombat.tsx`/`liveEngine.ts`/`live-combat.css`. Interactif temps réel (ticks 2 s, énergie, garde/parade, décharge, clash, garde tardive, contre-attaque). **4 kits AM distincts** (Poofowl garde • Emberpup combo • Fungoot poison • Haloux esquive) et **3 NME** (Sprigling rythme • Cobbleback tank/slam • Murkwisp feinte ; boss = alias Cobbleback). |
| Moteur de combat déterministe / ActionLog | Oui (§3.1, legacy) | ✅ `engine/combat.ts` (déterministe, testé 132/132) — **plus branché à l'UI** depuis v0.42, conservé pour tests/daily |
| Renderer replay (legacy) | Oui (§9) | 🟡 `CombatView.tsx` (rejoue l'ActionLog, ×1/2/4) — **orphelin depuis v0.42** (remplacé par LiveCombat), conservé au cas où |
| Monstres / espèces / variations | Oui (§4) | ✅ 3 starters (**Poofowl, Fungoot, Emberpup**) + 1 rare (**Haloux**) + **44 espèces** (1 historique = boss `gravelmaw` + 43 importées des planches). **9 AM jouables** (v0.43 : +5 de planche 4 — snailorn, axolotine, bellwisp, thicket, bannertail). **4 AM historiques ont une identité + 2 branches** (talents par palier) ; **les 5 nouveaux AM n'ont pas encore d'inné/talents/branches ni kit LIVE dédié** (repli kit Poofowl) ; variations régionales/spéciales toujours non implémentées |
| Branches de spécialisation | Oui (§4.2/4.3, v0.24) — **retiré du jeu réel en v0.53 (T008)**, remplacé par le draft de Traits | 🟡 **legacy uniquement** : `SpeciesDef.branches`/`activeTalents`/`needsBranchChoice`/`chooseBranch` conservés dans le code (utilisés par `engine/combat.ts` et ses 132 tests) mais **plus jamais déclenchés par le flow de jeu réel** depuis T008 — la fiche AM n'affiche plus de bloc Spécialisation |
| Statuts & altérations (F7) | Oui (§3.3 F7, v0.24) | ✅ **Poison & Brûlure** (DoT) implémentés : ticks au début du tour de la victime, actions `status`/`statusTick`, retrait auto ; amplification de dégâts vs cible affligée |
| Bestiaire éditable / PvE sauvage | Oui (§4.1) | ✅ Champ `wildEncounterable` et `kind` éditables par espèce (`species_overrides`). **v0.52 (T004) : Éditeur de bestiaire réaccessible depuis le menu ☰** — refondu pour le nouveau modèle (Rang/HP/Stamina/pool de Traits actifs+passifs/Trait de départ, `SpeciesEditor.tsx`), remplace l'ancien éditeur atk/def/spd resté orphelin depuis v0.21 |
| Carte / exploration (« Explorer le monde ») | Oui (§5) | ✅ **Carte du monde à 3 zones** (Clairière / Vallée / Cimes), accessible via le bouton **🗺️ Explorer** de la House (v0.21 : plus de sous-menu « Sortir », entrée de zone immédiate sans fade) ; anneaux de complétion, déblocage à 75%. **v0.17 :** avatar joueur = mini sprite de l'AM en tête d'équipe (plus d'emoji 🧍) |
| Complétion & déblocage de zone | Oui (§5) | ✅ `zoneProgress` (victoires cumulées) ; 75% débloque la zone suivante ; boss vaincu → zone pacifiée (`bossDefeated`) |
| Rencontres sauvages (zone) | Oui (§5) | ✅ **v0.17 :** plus de choix d'ennemi — la rencontre non nettoyée est présentée automatiquement, ennemi centré, sans ligne de butin ; choix de l'AM à envoyer conservé |
| Bestiaire (pokédex) | Oui (§4) | ✅ `BestiaryModal` : toutes espèces, silhouette verrouillée, rencontre enregistrée (`recordBestiary`) |
| Boutique / Centre de soin / Ranch | Oui (§5) | ✅ Soin/ranch accessibles via les **portraits PNJ** des zones (actions directes, **sans dialogue scripté depuis v0.17**) ; **Boutique** dispose en plus d'une **page dédiée minimale** accessible depuis la House (achat de potion) |
| Home / House | Oui (§7) | ✅ **Header minimal** (logo + hamburger) + **House** : compagnon miniature en marche aléatoire (pauses variables, profondeur, orientation selon le sens). **v0.44 : clic AM = focus in-place** (état local `focused`, sans navigation ni `pushState`) — l'AM glisse en haut à gauche, la fiche (identité + Rang/HP/Stamina/Traits/soins/interactions + espèce + historique, via `AmDetails`) fade-in autour de lui, le reste fond ; clic dehors = retour smooth. Fiche plein écran `AmPage` conservée pour l'ouverture depuis l'équipe/inventaire. Sortie vers **Explorer le monde**/Boutique. **v0.48 :** pièce élargie et **edge-to-edge sur mobile**. **v0.55 (T003) : mini-menu d'interaction** (bouton « 🧰 Interagir », panneau slide+fade sous la pièce, clic-armé + drag&drop sur le compagnon, cooldowns/potions) — accès rapide aux 3 interactions + potion sans ouvrir la fiche |
| Bandeau équipe (hub) | Oui (§7) | ✅ **v0.17 :** encadré distinct (« 🛡️ TON ÉQUIPE ») pour bien identifier le bandeau comme la propre équipe du joueur, plutôt qu'un simple titre au-dessus de la grille |
| Onboarding | Oui (§7) | ✅ **Wizard 4 étapes** (v0.23) : choix du monstre → lecture de fiche (**v0.61 : Rang/HP/Stamina + Trait de départ expliqués**, plus l'ancien Force/Armure/Vitesse) → **combat guidé** (**v0.42 : `LiveCombat tutorial`, combat interactif** vs Sprigling ; « tu pilotes ») → hub/boucle → adoption |
| Réinitialisation du compte | Oui (§7) | ✅ Bouton **« ♻️ Réinitialiser le compte »** dans le menu ☰ (confirmation) → efface la progression et relance l'Onboarding |
| Progression / level-up | Oui (§4.3) | ✅ **v0.53 (T008) : draft de Traits à chaque niveau** (`engine/draft.ts`, `LevelUpDraft.tsx`) — remplace le talent inné + branche choisie (v0.24, désormais legacy, voir ligne Branches). Stats HP toujours auto par niveau (`levelDelta`/`addXp`) ; Rang/Stamina fixes (T007) |
| Stats & talents lisibles (v0.20, **remplacé v0.51-0.61**) | Oui | ✅ Modèle Rang/HP/Stamina + Traits (T007/T008) partout dans l'UI depuis v0.61 (`RankStatLine`, `shared.tsx`) — l'ancien affichage 4 stats (atk/def/spd) en barres + tag de rôle (`StatRow`/`RoleTag`) est **retiré du code**. Talents (inné/branche legacy) toujours avec **icône + infobulle** ; **labels flottants de talent en combat** (`talentProc`) |
| Soin | Oui (§5.3) | ✅ **Régén continue temps réel** (5 s test) + potion + soin complet payant |
| Inventaire | Oui (§4.5) | ✅ Modal inventaire : **soin uniquement** (boost payant retiré v0.9) |
| Caractère / interactions | Oui (§4.6) | ✅ Personnalité par individu + humeur (combat) + caresser/coacher/observer (`progression.interact`) + **barre sociale (T009)**, voir ligne dédiée ci-dessous |
| Fiches AM | Oui (§7) | ✅ **Page plein écran** : date de capture, descriptif d'espèce, historique, stats, talents, soins, interactions. **v0.48 : surnom éditable** (crayon → input inline, 18 car. max) dans `AmHeroInfo`, partagé par la fiche House (focus in-place) et `AmPage` ; l'espèce reste affichée séparément, non affectée par le surnom |
| Direction artistique | Oui (§7) | ✅ **Thème CLAIR moderne** (indigo/violet + émeraude, surfaces blanches, Space Grotesk/Inter) + **transitions animées** entre vues. **v0.26 :** pass minimaliste — **icônes SVG line** (`game/icons.tsx`, `<Icon>`) à la place des emojis *chrome*, texte explicatif superflu retiré (emojis de contenu conservés) |
| Responsive / mobile | Oui (§7) | ✅ **Mobile-first** : header wrap, arène `clamp()`, hub/carte/page AM repliés 1 col, scroll tactile. **v0.26 :** carte du monde aérée < 680px, header sans débordement < 420px, en-tête de combat repliable, `heal-row` pleine largeur < 360px (breakpoints 900/680/560/420/360) |
| Boucle quotidienne (bonus + streak + quêtes) | Oui (v0.19) | ✅ state v6 : `dailyDay`/`dailyStreak`/`quests`, Journal du jour (`Daily.tsx`), auto-ouverture 1×/jour. **v0.21 :** quêtes **auto-réclamées** à la complétion (toast avec récompense). **v0.48 :** rappel de progression retiré de la House (accès Journal uniquement via le header 📅). Testé (`daily.smoke.ts`, 16 checks) |
| Repos hors-ligne (PV/humeur temps réel) | Oui (v0.19) | ✅ `applyOfflineRest` (PV max en ~6 h, humeur → 60), toast de retour |
| PvP | Oui (§6) | 🟡 **Arène de duels asynchrones** (`Arena.tsx` + `GET /api/arena/opponents`) : duel amical vs le meilleur AM d'un autre joueur (ou bot Nova), 3 victoires récompensées/jour. Pas encore de PvP synchrone/classé ni de liste d'amis |
| UI / écrans | Oui (§7) | ✅ **Page unique (hub + modals + page AM)**, `GamePage.tsx` ; header avec bourse permanente + Journal 📅 ; toasts de feedback |
| **Refonte modèle AM (v0.49)** | Oui (§4 réécrit) | ✅ **T006+T007+T004+T008+T010+T003+T005+T009+T011+T012 livrés — série intégralement terminée.** Les Character possèdent de vrais Traits équipés, le draft fonctionne (fiche + niveau), et depuis T012 le combat interactif réellement joué (`liveEngine.ts`) reflète enfin ces Traits (voir ligne T012 ci-dessous). |
| **Barre sociale (T009, v0.57)** | Oui (§4.6) | ✅ `Character.social` (0-100) + `Personality.affinity` étendu (caresser/coacher/observer/jouets/coups). `progression.ts` : `interact()` calcule un `socialDelta` en plus de l'humeur, `giveToy()` (nouvel objet consommable, boutique `TOY_PRICE=12`), `registerCombatSocial()` (participation flat + coups encaissés signés selon affinité), branché dans `onCombatFinish` (GamePage.tsx). UI : barre « Lien » sous l'humeur (`AmHeroInfo`), carte Jouet dans le mini-menu House et le bloc Interagir de la fiche. **Limites** : duels d'arène non alimentés (scope restreint aux combats réels) ; AM déjà existants = affinité jouets/coups neutre (0) tant qu'ils ne sont pas recréés. Tests : `social.test.ts` (17/17, nouveau), suite existante inchangée verte. |
| **Retrait des dialogues (T011, v0.58)** | Oui (§4.7) | ✅ PNJ décoratifs (mentor/lore) supprimés des zones ; PNJ de service (marchand/soin/ranch) toujours présents mais sans chat ni portrait cliquable — actions en boutons directs dans une carte « Services » de `ZoneScreen`. `NpcChat`, le modal `{k:"chat"}` et `Npc.lines` supprimés du code. Onboarding inchangé (déjà sans dialogue scripté). Aucun changement moteur ; build + suite de tests inchangée verte. |
| **Combat interactif rebranché sur les Traits (T012, v0.59)** | Oui (§4.2) | ✅ `renderer/liveEngine.ts` + `LiveCombat.tsx` résolvent désormais kit/bonus passif/mode Traits via `traits.ts::resolveCombatConfig` (jamais `undefined`, fallback kit fixe si <3 Traits actifs équipés). Formules partagées avec `autoSim` via le nouveau module pur `engine/passiveBonus.ts` (`defOf`, application des passifs) — zéro duplication à la main. Passifs branchés dans le moteur interactif : esquive totale, réduction de dégâts, critique, bonus d'ATK, vol de vie, régénération. Vérification des 4 kits spéciaux (garde/combo/poison/esquive) faite via `autoSim` headless (pas de navigateur disponible) plutôt qu'en jeu réel — contrôle visuel recommandé dès qu'un joueur équipe 3 Traits actifs. Tests : `passiveBonus.test.ts` 24/24 (nouveau), `traits.test.ts` 68→84/84. |
| **Budget de rang / 2v2 (T010, v0.54)** | Oui (§4.5) | 🟡 `ENABLE_2V2=false`, `RANK_BUDGET=4`, `teamRankSum`/`canAlignTeam` (data.ts) — règle testée (`budget.test.ts` 12/12), sans effet visible aujourd'hui (tout le monde rang 1, 1 seul AM aligné). **Le moteur LIVE réel (`live.ts`/`liveEngine.ts`) est 1v1 en dur** : activer le 2v2 demandera un travail moteur dédié, pas seulement lever le flag. |
| **Level-up par draft de Traits (T008, v0.53)** | Oui (§4.3) | ✅ `engine/draft.ts` (`generateDraft`/`applyDraftChoice`/`draftLabel`) + `LevelUpDraft.tsx`. `Character.traitPoints` banque 1 crédit/niveau (`addXp`) ; `makeCharacter` équipe 1 Trait actif de départ (`ensureTraits`) ; migration discrète des saves antérieures. **Choix de branche retiré du jeu réel** (conservé en legacy pour `engine/combat.ts`). `AmDetails.tsx` affiche Rang/HP/Stamina + Traits équipés (remplace les barres atk/def/spd et le bloc Spécialisation) — **les autres emplacements UI (onboarding, inventaire, capture) gardaient encore l'ancien affichage, comblé en v0.61**. **Gap combat comblé par T012 (v0.59)** : le combat interactif réellement joué (`liveEngine.ts`) construisait alors son kit via `kitFor(espèce)` et ignorait les Traits équipés — voir la ligne T012 ci-dessus pour la résolution. Tests (à cette date) : `draft.test.ts` 58/58, `traits.test.ts` 68/68, `live.test.ts` 30/30, `engine.test.ts` 132/132, `daily.smoke.ts` 16/16. |
| **Traits — fondation (T006, v0.50)** | Oui (§4.2) | ✅ `engine/traits.ts` : type `TraitDef` (actif/passif, 3 paliers) + catalogues `ACTIVE_TRAITS` (12 actions des 4 kits LIVE → peck/guard/burst, claw/ember/rush, spit/spores/bash, strike/dodge/riposte) et `PASSIVE_TRAITS` (20 talents → Traits passifs). `kitFromActiveTraits`/`resolveActiveKit` construisent un kit LIVE depuis 3 Traits actifs équipés ; `passiveBonusOf` calcule un bonus passif (atk/crit/esquive/vol de vie/régén/réduction dégâts). Couche **strictement additive** : `Character.activeTraits`/`passiveTrait` (types.ts) sont optionnels — sans eux, `autoSim` se comporte exactement comme avant. |
| **Stats Rang/HP/Stamina + formule flat (T007, v0.51)** | Oui (§4.1/4.2) | ✅ `Character.rank`/`stamina` (types.ts, défauts posés par `progression.ts`). `live.ts` `mkFighter` dérive l'énergie de départ de `stamina`. Nouvelle `AutoSimOpts.traitMode` : dégâts = puissance **flat** du Trait, ATK/DEF sans effet des deux côtés (« le move offensif détermine les dégâts, plus de principe de défense » — décision actée avec l'utilisateur). `traits.ts` `ACTIVE_TRAITS` recalibré en valeurs flat absolues (`FLAT_REFERENCE`). Nouveau `combatOptsFor(Character)` = point d'entrée combat réel (undefined si pas de Traits équipés → fallback legacy). **Scope** : `engine/combat.ts` (legacy, 132 tests) non touché ; **l'UI (barres atk/def/spd, choix de branche niv.3) n'avait volontairement pas été retirée à l'époque** — elle est restée la seule information affichée jusqu'à ce que T008 attribue de vrais Traits aux Character, puis **entièrement retirée en v0.61** (voir ligne « Stats & talents lisibles » et le journal v0.61). Tests : `traits.test.ts` (68/68), `live.test.ts` (30/30), `engine.test.ts` (132/132), `daily.smoke.ts` (16/16) — tous inchangés/verts. |
| Combat plein écran (T005, v0.56) | Oui (§3, §7) | ✅ `.combat-fullscreen` (position fixed, 100dvh, flex column, safe-area insets) remplace le modal centré. `live-combat.css` en flex-fill (arène `flex:1`, plancher 120-150px) : plus de scroll attendu, header/HUD compacts. Back Android/navigateur géré par le handler `popstate` générique existant (pas de route séparée). **Vérifié par calcul CSS uniquement** (pas de capture d'écran réelle — Playwright/Chromium bloqué par le réseau du bac à sable) ; contrôle visuel sur appareil réel recommandé. |

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

### 3.0 État v0.42 — le combat LIVE interactif est le combat réel (partout)

**Depuis v0.42, le combat du jeu est le combat LIVE interactif** (issu de `combat-live-proto.html`),
et non plus le replay automatique d'un `ActionLog` déterministe (§3.1, désormais *legacy*, conservé
pour les tests). Le joueur **pilote** son AM en temps réel.

Modèle : combat en **ticks de 2 s**. Chaque tick, tout le monde regagne **+1 énergie** (sauf si on a
attaqué), l'ennemi **télégraphie** son intention (aura ambre = petit coup / rouge = gros coup), le
joueur choisit **une action** (offensive / défensive / décharge) ou laisse **Charger** (défaut) ;
tout se résout en fin de tick. Mécaniques : **garde à boucliers** (parade → réserve de décharge),
**garde tardive** (« triche » jusqu'à mi-mouvement ennemi), **contre-attaque** (fenêtre 500 ms post-
parade), **clash** (deux attaques le même tick → le plus fort touche si ratio ≥ 1,5, sinon annulé),
**repos** (plein 2 ticks → −1 énergie).

**Chaque AM jouable a un kit V1 au feeling volontairement distinct** (`engine/live.ts → KITS`) :

| AM | Style (`special`) | Boutons (1/2/3 + Charger) | Identité |
|----|-------------------|---------------------------|----------|
| **Poofowl** | garde | Coup · Garde (2 boucliers) · Décharge | Contre-puncheur : pare, stocke, décharge |
| **Emberpup** | combo | Griffe · Brasier (brûlure) · Curée | Agression : combo ×1→×4, aucune garde, fragile |
| **Fungoot** | poison | Crachat (poison) · Spores (empoisonne l'attaquant) · Frappe | Usure : DoT empilable, punit le contact |
| **Haloux** | dodge | Frappe · Esquive (parfaite → riposte) · Riposte | Glass cannon au timing |

**3 NME possibles seulement, comportements radicalement différents** (`engine/live.ts → BEHAVIORS`) :

| NME | Comportement | Ce qu'il apprend au joueur |
|-----|--------------|----------------------------|
| **Sprigling** | rythme : petit, petit, GROS coup | lire la cadence, parer le gros coup |
| **Cobbleback** | tortue : se protège puis charge un slam massif (exposée pendant la charge) | punir la charge, ne pas rester passif (avidité punie) |
| **Murkwisp** | feinte : télégraphie un gros coup, l'annule ~40% | ne pas paniquer/gaspiller sa garde |

Le boss `gravelmaw` réutilise le comportement **Cobbleback** (alias). Dégâts dérivés des stats
(`hitDmg(power, atk, def)`) → tout scale avec le niveau. Moteur pur testé en headless
(`live.test.ts`, `autoSim`, 30/30).

### 3.1 Principe directeur — moteur / renderer *(legacy ActionLog)*

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
| **F2 — Modèle de données** | ✅ Retenu (simplifié) | Principe 3 niveaux conservé : `SpeciesDef` (bestiaire statique) → `Character` (monstre possédé, persisté, plat) → `Fighter` (runtime, dérivé à l'init, jeté en fin de combat). **Sans système d'éléments** : 4 stats génériques (HP / attaque / défense / vitesse — stamina retirée en v0.20) au lieu des vecteurs élémentaires. Détail du modèle auto monster : voir §4. |
| **F3 — Système d'éléments** | ❌ Abandonné | Pas de forces/faiblesses élémentaires. Dégâts basés uniquement sur les stats génériques. |
| **F4 — Tour chronométrique** | ✅ Retenu | File temporelle : agit le `Fighter` au `time` minimum, puis `time += base × timeMultiplier` (dérivé de la vitesse). Pas de multiplicateurs par élément (F3 abandonné). Garde-fous anti-combat-infini (limite de tours). |
| **F5 — Résolution des dégâts** | ✅ Retenu (complet) | Fonction pure `resolveAttack(attacker, target, attack, rng)` : score attaque vs défense, aléa borné (~±30%), planchers, esquive, immunités. Inclut le point d'accroche `hooks.defenses` (callbacks défensifs : bouclier, renvoi, réduction…) pour l'extensibilité via F6. Sans calcul élémentaire. |
| **F6 — Skills par hooks** | ✅ Retenu | Une skill = une fonction qui mute le `Fighter` ou enregistre un hook (`events` probabilistes au tour, `attacks` spéciales, `defenses`, `afterAttack`, `onKill`, `onLost`). Triés par `priority`, tirés par `proba` (RNG seedé). Ajouter une skill = 1 fichier, sans toucher à la boucle. Champ `elt` du SkillDef retiré (pas d'éléments). |
| **F7 — Statuts & altérations** | ✅ Retenu | `StatusInfo` avec `duration`, `onApply/onTick/onRemove`. Poison, bouclier, buff/debuff, intangible… Effets périodiques au fil du temps, retrait auto à expiration. Émet `status`/`noStatus` dans le log. |
| **F8 — Système d'énergie** | ❌ Abandonné (v0.20) | La **stamina** n'était jamais lue en combat → retirée. On passe à **4 stats** (§4.1). Une jauge d'énergie visible pilotant une « spéciale » pourra être réintroduite plus tard comme mécanique à part entière. |
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

> **Refonte v0.49 (designé, non implémenté).** Les sections 4.1→4.6 ci-dessous décrivent le
> **nouveau modèle**. L'ancien modèle (4 stats HP/atk/def/spd, branches de spécialisation, montée
> de stats automatique) reste **l'état réellement implémenté** tant que les tâches T004→T011 ne
> sont pas livrées — voir §0.bis.

### 4.1 Espèce — `SpeciesDef` (nouveau modèle)

Définition statique partagée par tous les monstres d'une même famille.

| Champ | Description |
|-------|-------------|
| **nom** | Identité de l'espèce. |
| **rang de base** | **1→5**. Représente la puissance/coût d'alignement de l'espèce. **Pour l'instant : 1 partout.** Sert au **budget de rang** en équipe (voir 4.5). |
| **HP de base** | Points de vie au niveau 1 : **~30-50**. |
| **stamina de base** | Ressource dépensée par les Traits actifs en combat : **3-4** au niveau 1. |
| **pool de Traits** | L'ensemble des **Traits** (cartes actives + passives) que les membres de l'espèce peuvent piocher/améliorer en montant de niveau (voir 4.4 et 4.3). |
| **Trait de départ** | Le Trait actif possédé dès le niveau 1 (par défaut une **attaque simple**). |

**Ce qui disparaît vs l'ancien modèle** : plus de **Force/Attaque**, **Armure/Défense**, ni
**Vitesse** en tant que stats — **tout le comportement de combat vit dans les Traits**. Plus de
**branches de spécialisation** : la personnalisation passe **entièrement par le choix des Traits**.

### 4.2 Traits — les cartes d'action de l'AM

Un **Trait** est une **carte** : soit une **action active** jouable en combat, soit un **effet
passif**. Un AM **équipe 3 Traits actifs + 1 Trait passif**.

| Aspect | Détail |
|--------|--------|
| **Type** | **Actif** (action jouée en combat, coûte de la stamina) ou **Passif** (effet permanent). |
| **Niveau** | **1 → 3.** Plus le niveau est élevé, plus l'effet est fort **et plus il est rare à l'apparition** dans les choix de level-up. |
| **Slots** | **3 actifs + 1 passif** équipés au maximum. |
| **Origine des données (v0.49)** | Réutilisation de l'existant : les **actions de kit LIVE** (`live.ts` → KITS : Coup, Garde, Décharge, Griffe, Brasier, Curée, Crachat, Spores, Frappe, Esquive, Riposte…) deviennent les **Traits actifs** ; les **talents** (`talents.ts` : Braise, Frénésie, Peau de pierre, Épines, Régén, Ponction, Élan…) deviennent les **Traits passifs**. Le niveau 1→3 d'un Trait = mise à l'échelle de sa puissance/effet (power, coût, dégâts de DoT, %). |

### 4.3 Character — instance possédée & montée de niveau (nouveau modèle)

Monstre concret détenu par le joueur, persisté et **plat**. Référence une espèce.

- **Stats persistées** : rang, HP (max + courant), stamina, niveau, XP, **Traits équipés** (actifs
  + passif) avec leur niveau, barre sociale, historique.
- **Niveau 1** : l'AM n'a **qu'un seul Trait actif** (attaque simple, niv 1). Objectif de design :
  **atteindre vite le niveau 3** pour disposer de ses 3 slots actifs.
- **Montée de niveau = draft de choix.** À chaque niveau, on propose un petit tirage d'options :
  1. **Améliorer un Trait** possédé (niv 1→2→3). Pondération : plus le palier visé est haut, moins
     il a de chances d'apparaître.
  2. **Acquérir un nouveau Trait** tiré du **pool de l'espèce** (si un slot est libre).
  3. **Améliorer un autre Trait** — cette option n'est proposée **que si l'AM possède au moins 3
     Traits non encore au niveau max** ; sinon ce slot d'option est remplacé par **un autre choix
     de nouvelle carte**.
- **HP / stamina** montent aussi avec le niveau (courbe à caler au proto).
- **Plus de montée de stats atk/def/spd** ni de choix de branche : supprimés.

### 4.4 Pool de Traits par espèce

Chaque espèce définit **quels Traits** ses membres peuvent piocher/améliorer (actifs + passifs) et
**lequel est le Trait de départ**. C'est ce pool qui donne l'identité de l'espèce (là où l'ancien
modèle utilisait l'inné + les 2 branches). Éditable via le **nouvel éditeur de bestiaire** (T004).

### 4.5 Équipe & budget de rang

- On alignera **2 AM**, dans la limite d'un **budget de rang = 4** : `2+2`, `3+1`, ou un seul AM de
  rang `4`. La somme des rangs des AM alignés ne dépasse jamais 4.
- **État actuel du design** : tous les AM sont **rang 1**, et le **2v2 n'est pas encore actif** —
  on joue encore 1 AM. La structure (champ rang, contrôle de budget) est posée dès maintenant pour
  activer le 2v2 plus tard sans refonte.

### 4.6 Barre sociale & interactions

Chaque AM possède une **barre sociale** (lien/affinité avec le joueur). Elle **monte ou baisse**
selon les interactions :

| Action | Effet sur la barre sociale |
|--------|----------------------------|
| **Caresser** | Monte (selon les goûts de l'individu). |
| **Coacher** | Monte/baisse selon l'individu. |
| **Combattre** (l'emmener au combat) | Monte. |
| **Prendre des coups** (encaisser en combat) | Peut faire monter/baisser. |
| **Donner des jouets** | Monte. |
| **Observer** | Ne change pas la barre : **donne des indices** sur les goûts de l'individu (« XXX n'est pas spécialement fan des caresses »). |

Chaque individu a des **préférences propres** (comme l'affinité actuelle) : la même action n'a pas
le même effet d'un AM à l'autre — c'est ce que l'action **observer** révèle progressivement.

**État actuel (T009 livré)** : `Character.social` (0-100, défaut 50) ; `Personality.affinity`
étendu à 5 dimensions (caresser/coacher/observer/jouets/coups). Caresser et Jouets montent
toujours (magnitude selon l'affinité) ; Coacher et Coups (encaissés en combat) montent ou
baissent selon l'individu ; Combattre (participation, tout combat réel) ajoute un gain fixe
(`COMBAT_SOCIAL_GAIN`) indépendant du résultat ; Observer ne touche pas la barre et génère un
indice textuel (`affinityHint`) sur la dimension d'affinité la plus marquée de l'individu.
Jouets = nouvel objet consommable (boutique, `TOY_PRICE`), utilisable depuis le mini-menu House
et la fiche. Barre visible sous l'humeur (fiche AM). **Limites assumées** : les duels d'arène
n'alimentent pas la barre (scope volontairement restreint aux combats réels) ; les AM déjà
existants avant T009 ont `affinity.jouets`/`coups` neutres (0) tant qu'ils ne sont pas recréés —
pas de migration rétroactive de personnalité.

### 4.7 Dialogues

**Retirés pour l'instant.** Aucune séquence de dialogue scripté (onboarding, PNJ) — les actions
restent directes. À réintroduire éventuellement plus tard.

**État actuel (T011 livré)** : les PNJ purement décoratifs ("mentor" Sylve, "lore" Nima/Orn-lore/
guetteur — répliques d'ambiance jamais affichées, panneau vide au clic) ont été **supprimés**.
Les PNJ de service (marchand/soin/ranch) restent dans les zones qui en ont, mais **sans chat ni
portrait cliquable** : leurs actions (acheter une potion, soigner l'équipe, louer un monstre) sont
des **boutons directs** dans une carte « Services » de l'écran de zone. L'onboarding (choix du
starter → fiche → combat tutoriel → boucle expliquée) ne contenait déjà aucune réplique
scriptée — laissé inchangé.

### 4.8 Acquisition & composition

- Auto monsters débloqués en explorant la carte (boss, événements, marchands, capture).
- Le joueur compose son équipe dans la limite du **budget de rang** (4.5).

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
| **Home / House** *(v0.15, implémenté)* | Écran d'accueil minimaliste : compagnon actif miniature en marche aléatoire (pauses variables, déplacement en profondeur, orientation selon le sens), zoom smooth en place + volet d'info à droite au clic (pas de page séparée). Point d'entrée vers **Explorer le monde**/Boutique via « Sortir » ; menu ☰ (Bestiaire/Équipe/Éditeur d'espèces/Déconnexion) |
| Carte du monde (« Explorer le monde ») *(v0.17 : renommée)* | Navigation et exploration des zones, accessible depuis la House ; avatar joueur = mini sprite de l'AM en tête d'équipe |
| Boutique | Page dédiée minimale (achat de potions), accessible depuis la House |
| Combat *(v0.17, refonte visuelle)* | Vue de bataille live (rejeu de l'ActionLog), grande salle façon House élargie, combattants face à face, déplacement/attaque/retour |
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
