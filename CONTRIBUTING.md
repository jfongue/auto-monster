# AutoMonster — Commit & déploiement live

Comment versionner et mettre en ligne proprement. **Une seule branche : `main`.
Tout push sur `main` redéploie automatiquement le site live (Render).**

```
édition du code  →  git commit  →  git push origin main  →  Render rebuild & redémarre  →  live
```

- Repo : https://github.com/jfongue/auto-monster
- Hébergeur : Render (service unique, plan free) — voir `app/DEPLOY.md`
- Base : Neon (Postgres)

---

## 1. Le token GitHub

Le push en HTTPS n'accepte **pas** le mot de passe GitHub : il faut un
**Personal Access Token (PAT)** comme mot de passe.

**Quel token créer** (https://github.com/settings/tokens) — deux options :

| Type | Réglage | Quand |
|------|---------|-------|
| **Classic** (recommandé, simple) | cocher le scope **`repo`** | usage perso rapide |
| **Fine-grained** (plus sûr) | *Only select repositories* → `auto-monster` · Permission **Contents: Read and write** | si tu veux limiter au seul repo |

> ⚠️ Un fine-grained sans **Contents: Read and write** sur ce repo donne une
> erreur `403 Permission denied` même si tu es le propriétaire.

**Règles de sécurité**
- Ne **jamais** committer un token (ni dans le code, ni dans `.env` — `.env` est déjà dans `.gitignore`).
- Si un token est exposé (chat, capture, log) → le **révoquer** et en régénérer un.
- Le token n'est pas dans le repo : il vit dans le trousseau macOS (voir plus bas).

---

## 2. Bien committer

**Ce qui est versionné** : uniquement le code source. Sont exclus via `.gitignore` :
`node_modules/`, `dist/`, `.env`, `*.db`, `.screenshots/`, `*.tsbuildinfo`, `.DS_Store`.
→ Ne force jamais l'ajout de ces fichiers.

**Messages de commit** — style conventionnel, court et factuel :

```
feat: …     nouvelle fonctionnalité
fix: …      correction de bug
chore: …    tâche technique (deps, config)
docs: …     documentation
refactor: … réorganisation sans changement de comportement
```

**Commandes** (depuis la racine du projet) :

```bash
cd "/Users/jeremyfongue/Documents/Claude/Projects/Auto battler"
git status                     # voir ce qui a changé
git add -A                     # tout préparer (les exclus sont ignorés)
git commit -m "feat: ajout de la carte du monde"
```

> Rappel projet : à chaque changement de design/code, mettre `GDD.md` à jour
> (voir `CLAUDE.md`) **avant** de committer.

---

## 3. Pousser en live

```bash
git push origin main
```

Au 1er push, le terminal demande :
- **Username** : `jfongue`
- **Password** : **colle le token** (`ghp_…` ou `github_pat_…`), pas ton mot de passe.

Pour ne plus le retaper (macOS le mémorise dans le trousseau) :

```bash
git config --global credential.helper osxkeychain
```

Render détecte le push et lance automatiquement :
`npm install && npm run build` (build) puis `npm start` (démarrage).
La table et les comptes (admin + compte test) se créent au boot.

**Vérifier le déploiement** (~2-3 min) :
- Ouvrir l'URL live → la landing s'affiche.
- `https://<app>.onrender.com/api/health` → `{"ok":true}`.
- Se connecter avec le compte test `admin` / `admin`.

> Free tier Render : le service s'endort après ~15 min d'inactivité
> (~30 s de réveil au 1er appel). Les données restent (elles sont dans Neon).

---

## 4. Variables d'environnement (Render)

À régler une fois dans Render → onglet *Environment* (jamais dans le code) :

| Clé | Rôle |
|-----|------|
| `DATABASE_URL` | connection string Neon |
| `JWT_SECRET` | secret de signature des tokens (longue chaîne aléatoire) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | compte admin créé au boot |
| `NODE_ENV` | `production` |

En local, laisser `DATABASE_URL` vide → Postgres en mémoire (pg-mem), rien à installer.

---

## 5. Quand Claude pousse à ta place

Claude pousse depuis un clone propre dans son environnement, avec un token que tu
lui fournis (idéalement fine-grained limité à `auto-monster`, à révoquer après).
Conséquence : **ton dépôt local Mac prend du retard sur l'historique** (les fichiers
sont à jour, pas les commits). Pour resynchroniser :

```bash
git pull origin main
```

Le token donné à Claude n'est valable que pour la session (l'environnement est
réinitialisé ensuite) — il faut le redonner à la session suivante.

---

## 6. Dépannage

| Symptôme | Cause / fix |
|----------|-------------|
| `Authentication failed` / `403 denied to jfongue` | token sans scope `repo` (classic) ou sans Contents:write (fine-grained) → recréer le token |
| Push ne redemande pas le token et échoue | trousseau a gardé l'ancien : `printf "protocol=https\nhost=github.com\n\n" \| git credential-osxkeychain erase` puis repush |
| `HEAD.lock: File exists` | `rm -f .git/HEAD.lock .git/index.lock .git/objects/maintenance.lock` |
| Build Render KO (types/Vite manquants) | déjà corrigé : `install:all` utilise `--include=dev` (NODE_ENV=production sinon saute les devDependencies) |
| `Repository not found` | mauvais nom/URL du remote : `git remote set-url origin https://github.com/jfongue/auto-monster.git` |
