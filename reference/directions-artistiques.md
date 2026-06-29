# Directions artistiques — AutoMonster (créatures de combat)

> Cadrage entre les deux pôles existants : sprites pixel chibi actuels (`sprites/*.png`, ~200px)
> ↔ références peintes `reference/lumentale/` (fakemon digital painting, poses dynamiques).
> Objectif : illustrations 2D lisibles et dynamiques pour le combat live.

## Note capacité
Aucun générateur text-to-image (skill ou connecteur MCP) n'est disponible dans cet
environnement. Ce doc sert de brief : à confier à un illustrateur, à un modèle IA dédié
(Midjourney/SDXL/Niji), ou à produire en vectoriel.

---

## DA-A — Pixel HD dynamique
- **Idée** : prolonge tes sprites actuels, mais résolution montée (~64–96px), plus de détail.
- **Rendu** : palette limitée saturée, dithering léger, rim-light, contour sélectif sombre.
- **Combat** : poses d'action, squash & stretch, 2–4 frames (idle / attaque / hit).
- **Palette** : nuit `#1c2230`, braise `#d44b2a`, orange `#ff8a3c`, or `#ffd34d`, blanc.
- **Combat 4/5 · Coût 4/5** (frames = travail). Continuité maximale avec l'existant.

## DA-B — Fakemon peint (style Lumentale)
- **Idée** : viser la fidélité des refs Lumentale — le « wow ».
- **Rendu** : digital painting, volumes, rim/ambient light, FX élémentaires, sans contour dur.
- **Combat** : poses 3/4 dynamiques, énergie, effets de souffle/éclair peints.
- **Palette** : riche et contrastée par espèce/élément.
- **Combat 5/5 · Coût 1/5**. Le plus cher : illustrateur ou pipeline IA + retouche.

## DA-C — Cel-shading anime (recommandé)
- **Idée** : meilleur ratio impact/coût pour un auto-battler lisible.
- **Rendu** : aplats + 2 tons d'ombre, gros contour propre, highlights nets, FX cartoon.
- **Combat** : très lisible même petit ; vectorisable et animable au rig (bones).
- **Palette** : contour `#321a10`, base `#ff7a36`, ombre `#b73c1f`, or `#ffcf4a`.
- **Combat 5/5 · Coût 3/5**. Style « moderne mobile » cohérent et tenable.

## DA-D — Flat vectoriel
- **Idée** : style Supercell / Archero, formes plates.
- **Rendu** : aplats, ombres minimales, contour fin ou nul, formes géométriques claires.
- **Combat** : lisibilité maximale, scalable à l'infini, anim par déformation (skew/scale).
- **Palette** : froid `#2a2f3a`, orange `#ff8b4a`, or `#ffd86a`, cyan `#4fb0c4`.
- **Combat 5/5 · Coût 5/5**. Le moins coûteux et le plus rapide à itérer.

## DA-E — Gouache storybook
- **Idée** : charme illustré, ambiance chaleureuse.
- **Rendu** : textures peintes douces, contours irréguliers, grain papier.
- **Combat** : superbe en fiches/hub, moins « punchy » dans l'action rapide.
- **Palette** : prune `#2d2438`, terracotta `#e8895f`, miel `#f2c878`, parchemin `#f3ead6`.
- **Combat 3/5 · Coût 2/5**. Plutôt pour l'habillage que pour les sprites de combat.

---

## Reco
- **Cohérence + budget réaliste** → **DA-C (cel-shading)** comme base de combat, éventuellement
  **DA-D (flat)** si production très contrainte.
- **DA-B** comme cible « hero art » (écran de capture, fiches plein écran) si budget illustration.
- La DA app actuelle (fantasy : nuit/or/parchemin/braise, cf. GDD v0.9) s'accorde le mieux
  avec **C** et **E**.

## Prochaine étape possible
Choisir 1 DA → produire un sheet de 3–4 créatures types (feu/eau/plante/électrique) en pose
de combat pour valider avant de refaire tout le bestiaire.
