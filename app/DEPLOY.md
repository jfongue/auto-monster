# Déploiement — AutoMonster (gratuit, scalable plus tard)

Architecture en ligne : **un seul service Node** (Express sert l'API + le front
React buildé) + **Postgres managé (Neon)** pour la persistance.

- Hébergeur app : **Render** (plan gratuit, upgrade payant plus tard sans rien changer)
- Base : **Neon** (Postgres gratuit, persistant, scalable)
- Une seule URL publique : `https://<ton-app>.onrender.com`

> Note plan gratuit Render : le service s'endort après ~15 min d'inactivité et
> met ~30 s à se réveiller au 1er appel. Les **données restent** (elles sont dans
> Neon, pas sur le disque Render). Passer en payant supprime le sleep.

---

## 1. Mettre le code sur GitHub

Depuis le dossier du projet :

```bash
cd "/Users/jeremyfongue/Documents/Claude/Projects/AutoMonster"
git init
git add .
git commit -m "AutoMonster — squelette auth + déploiement"
```

Crée un repo vide sur https://github.com/new (ex. `automonster`), puis :

```bash
git remote add origin https://github.com/<ton-user>/automonster.git
git branch -M main
git push -u origin main
```

---

## 2. Créer la base Postgres (Neon)

1. https://neon.tech → s'inscrire (gratuit) → **New Project**.
2. Copier la **connection string** (format
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`).
3. La garder pour l'étape suivante.

Le schéma (table `users`) et le compte admin sont créés automatiquement au
1er démarrage du serveur — rien à faire à la main.

---

## 3. Déployer sur Render

1. https://render.com → s'inscrire → **New > Web Service** → connecter le repo GitHub.
2. Réglages :
   - **Root Directory** : `app`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Instance type** : Free
3. **Environment variables** (onglet Environment) :

   | Clé | Valeur |
   |-----|--------|
   | `DATABASE_URL` | la connection string Neon de l'étape 2 |
   | `JWT_SECRET` | une longue chaîne aléatoire |
   | `ADMIN_EMAIL` | ton email admin |
   | `ADMIN_PASSWORD` | un mot de passe admin solide |
   | `NODE_ENV` | `production` |

4. **Create Web Service**. Render build + démarre → URL live affichée.

---

## 4. Vérifier

- Ouvrir `https://<ton-app>.onrender.com` → écran de connexion.
- Se connecter avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- `https://<ton-app>.onrender.com/api/health` doit renvoyer `{"ok":true}`.

---

## Mises à jour

Chaque `git push` sur `main` redéploie automatiquement.

## Local vs prod

- **Local** : `DATABASE_URL` vide → Postgres en mémoire (pg-mem), rien à installer.
- **Prod** : `DATABASE_URL` défini → vraie base Neon.

## Scaler plus tard

- Render : passer l'instance en payant (plus de sleep, plus de RAM/CPU).
- Neon : passer à un plan payant (plus de stockage / compute) — même URL.
