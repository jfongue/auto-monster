# Propal — Stats & Talents plus simples, visibles en combat

> Objectif : comprendre / visualiser / **voir les effets pendant le combat**.
> Statut : proposition (pas encore actée dans le GDD).

## Diagnostic (état réel du code)

- **`sta` (stamina) est une stat morte.** Elle est posée sur le `Fighter` (`maxSta`/`sta`) mais **jamais lue** en combat. 1 stat sur 5 ne fait rien → confusion directe.
- **`spd` est opaque.** `timeMultiplier = 50/spd` + esquive cachée (`dodge = 4 + spd/12`). Aucun retour à l'écran : le joueur ne voit ni qui va jouer, ni pourquoi il esquive.
- **Les talents procent en silence.** Seul `frenzy` pose un flag `crit`. `thorns`, `stoneskin`, `swift`, `regen` n'émettent (presque) rien de lisible → l'effet n'est jamais relié à sa cause à l'écran.
- **La fiche = nombres bruts** (`❤️58 ⚔️15 🛡️14 💨30 ⚡32`) : pas d'échelle, pas de rôle.

## Principe directeur

**1 stat = 1 effet = 1 chose visible à l'écran.** Si un effet ne se voit pas pendant le combat, on le supprime ou on le rend visible.

---

## 1. Passer de 5 stats à 4 stats claires

Retirer la stamina (elle ne sert à rien aujourd'hui). Les 4 restantes ont chacune **une manifestation visuelle unique** :

| Stat | Nom joueur | Ce que ça fait | Visible en combat par… |
|------|-----------|----------------|------------------------|
| ❤️ PV | Vie | encaisse | la barre de vie (déjà là) |
| ⚔️ ATK | Force | taille des dégâts | **le chiffre de dégât** (couleur/taille selon coup) |
| 🛡️ DEF | Armure | réduit les dégâts reçus | **chiffre barré / réduit** quand l'armure absorbe |
| 💨 SPD | Vitesse | fréquence d'action + esquive | **jauge d'initiative** (voir §3) |

> Alternative si tu veux garder 5 stats : transformer la stamina en **jauge d'énergie visible** qui se remplit avec le temps et déclenche le **talent inné en version « spéciale »** quand elle est pleine. Ça recycle la stat morte en la rendant la plus spectaculaire du combat. Plus de travail, mais très « juicy ». → à trancher.

## 2. Rendre les talents lisibles (le cœur de la demande)

Aujourd'hui un talent proc sans rien afficher. Ajouter une action au log :

```ts
| { t: "talentProc"; fid: number; talent: string; label: string }
```

Le moteur l'émet quand un talent se déclenche (crit Frénésie, renvoi Épines, absorption Peau de pierre, régén). Le renderer pop un **label flottant** au-dessus du combattant : « ⚡ FRÉNÉSIE », « 🌵 ÉPINES −7 », « 🪨 −15% ».

Chaque talent est décrit de façon homogène : **1 icône · 1 nom-verbe · 1 ligne d'effet · 1 cue combat** (le texte qui pop). Regroupés par les 3 catégories existantes (offensif / défensif / utilitaire).

| Talent | Icône | Effet 1 ligne | Cue à l'écran |
|--------|-------|---------------|----------------|
| Braise | 🔥 | +20% force | (passif, montré sur la fiche) |
| Frénésie | ⚡ | 1 coup/4 frappe fort | « CRIT ! » chiffre gros |
| Peau de pierre | 🪨 | −15% dégâts reçus | « −15% » sur le coup absorbé |
| Épines | 🌵 | renvoie 25% | « ÉPINES −X » sur l'attaquant |
| Vivacité | 💨 | agit +15% souvent | jauge d'initiative plus rapide |
| Régén | 💚 | +4% PV/tour | « +X 💚 » (déjà émis, à styliser) |

## 3. Jauge d'initiative (rend la vitesse visible)

Une **barre ATB** par combattant qui se remplit à la vitesse `spd`. Celui dont la barre est pleine joue. Le joueur *voit* pourquoi un monstre rapide frappe deux fois. C'est le seul ajout renderer un peu structurant, mais c'est ce qui rend la vitesse — la stat la plus abstraite — enfin lisible. Données déjà présentes (`time`/`timeMultiplier`), il suffit de les exposer dans le log.

## 4. Fiche : rôle + barres au lieu de nombres bruts

Remplacer `StatRow` (nombres nus) par :

- **4 barres relatives** (0–100 vs le max du bestiaire) → on lit l'archétype d'un coup d'œil.
- **1 tag de rôle** auto-dérivé des stats : « Bagarreur rapide », « Tank », « Soigneur »…
- **Le talent inné en carte** (icône + ligne d'effet), pas juste un nom.

---

## Impact technique (estimation)

| Item | Où | Ampleur |
|------|-----|---------|
| Retirer `sta` | `types.ts`, `fighter.ts`, `data.ts`, `StatRow` | S (mécanique morte) |
| `talentProc` dans l'ActionLog + émissions | `types.ts`, `combat.ts`, `talents.ts` | M |
| Pop labels talents | `CombatView.tsx` | M |
| Jauge d'initiative | `CombatView.tsx` (+ expose `time`) | M |
| Fiche barres + rôle | `shared.tsx` | S |

Moteur reste déterministe ; on **ajoute** des actions au log (rétro-compatible avec le renderer qui ignore l'inconnu). Tests moteur à compléter (émission des procs).

## Décisions à trancher

1. **Stamina** : la retirer (4 stats, simple) **ou** la transformer en jauge d'énergie → spéciale ? (reco : retirer d'abord, garder l'énergie comme évolution).
2. Jauge d'initiative : oui / plus tard ?
3. Périmètre 1er jet : je propose **§1 + §2 + §4** d'abord (gros gain lisibilité, coût contenu), §3 juste après.
