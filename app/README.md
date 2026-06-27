# Auto Battler — App

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

- email : `admin@autobattler.local`
- mot de passe : `admin1234`

(modifiable dans `server/.env`)

## Fonctionnalités du squelette

- Écran de connexion + inscription
- Auth persistante (JWT, mots de passe hashés bcrypt, base SQLite)
- Dashboard vierge avec fiche perso (nom affiché, bio, rôle) éditable
- Déconnexion

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
