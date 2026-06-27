# AutoMonster — App

Monorepo : `client` (React + Vite + TS) et `server` (Express + SQLite).
Auth JWT + bcrypt. Accessible sur le réseau local (testable sur n'importe quel appareil).

## Démarrage

```bash
cd app
npm install                 # installe concurrently
npm run install:all         # installe client + server
cp server/.env.example server/.env
npm run seed                # crée le compte admin
npm run dev                 # lance server (4000) + client (5173)
```

Ouvre http://localhost:5173 — ou, depuis un autre appareil du réseau,
`http://<ip-de-ta-machine>:5173` (l'adresse est affichée par Vite au démarrage).

## Compte admin par défaut

- email : `admin@automonster.local`
- mot de passe : `admin1234`

(modifiable dans `server/.env`)

## Fonctionnalités

- Écran de connexion + inscription, auth persistante (JWT, bcrypt, Postgres/pg-mem)
- **Boucle de jeu (v1)** : adoption d'un 1er Auto Monster, carte 5 étapes / 5 combats,
  combat live 1v1 (moteur déterministe + rejeu de l'ActionLog), butin (or/potions),
  soins entre combats, montée de niveau (packs de stats, paliers de talent),
  boss coriace en plusieurs parties (interrompu par une égalité, PV conservés),
  puis capture d'un 2e AM rare.
- Progression sauvegardée côté serveur (`/api/game/state`).

### Architecture du jeu (`client/src/game/`)

```
engine/   moteur TS pur, déterministe, headless (zéro DOM)
  rng.ts          mulberry32 (RNG seedé)
  types.ts        SpeciesDef / Character / Fighter / Action (ActionLog F9)
  data.ts         espèces (AM + bestioles), map, loot
  talents.ts      talents = hooks (F6)
  fighter.ts      buildFighter (Character → Fighter)
  combat.ts       resolveAttack (F5) + runCombat (F1/F4) → ActionLog
  progression.ts  XP/niveaux, packs de stats, paliers de talent, ennemis
  engine.test.ts  tests headless (déterminisme, égalité, cohérence)
  sim.ts          simulation de masse (équilibrage)
renderer/
  CombatView.tsx  rejoue l'ActionLog (F10), visuels simplistes
state.ts          état de jeu persisté
GamePage.tsx      orchestration des écrans
```

Le moteur ne touche jamais au DOM : il produit un journal d'actions (`ActionLog`)
que le renderer rejoue. Tout combat est rejouable depuis son seed.

### Tests du moteur

```bash
cd client/src/game/engine
npx tsx engine.test.ts   # tests déterministes
npx tsx sim.ts           # distribution des issues (équilibrage)
```

## Capture headless (pour itérer)

Serveurs lancés, puis :

```bash
node screenshot.mjs   # écrit .screenshots/01-login.png et 02-dashboard.png
```

## Structure

```
app/
  client/   front React/Vite/TS
  server/   API Express + SQLite (data.db généré)
  screenshot.mjs
```

## Mobile

Le front est responsive (viewport mobile). Pour une app native plus tard,
la logique d'auth (`client/src/lib`) est réutilisable côté React Native.
```
