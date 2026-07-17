# Instructions projet — AutoMonster

## Gestion des tâches — `taches.html`

`taches.html` est le tableau de bord des améliorations (source des tâches). Les tâches y sont
stockées dans le bloc `<script type="application/json" id="tasks-data">`. Chaque tâche a :
`id` (T00X), `title`, `status` (backlog/planned/in_progress/done), `priority`, `objectives`,
`plan` (liste d'étapes `{step,done}`), `expected` (critères de « done »), `results`, `log`.

### Commande « plannifie X »
Quand l'utilisateur dit **« plannifie … »** :
1. Poser les questions nécessaires pour cadrer précisément : objectif, critères de « done »
   mesurables, périmètre, contraintes.
2. Rédiger avec lui les `objectives` et un `plan` d'étapes concret, plus les `expected`.
3. Ajouter la tâche (nouvel `id` T00X, `status:"planned"`) dans le bloc JSON de `taches.html`
   en éditant directement le fichier. Confirmer l'id créé.

### Commande « lance tâche T00X » (ou « lance tâche … »)
Quand l'utilisateur dit **« lance tâche … »** :
1. Lire `taches.html`, retrouver la tâche par id/titre, passer son `status` à `in_progress`.
2. Exécuter le plan **en itérant** : implémenter une étape, lancer les tests
   (`engine.test.ts`, build tsc/vite selon le périmètre), corriger, recommencer — jusqu'à ce
   que **tous les `expected` soient satisfaits et les tests verts**. Cocher les étapes (`done:true`)
   au fur et à mesure dans le JSON.
3. Remplir `results` (ce qui a été fait, chiffres/tests) et ajouter une entrée à `log`.
4. Passer `status` à `done` une fois les critères remplis.
5. Appliquer la règle GDD ci-dessous (journal + version) si la session a changé quelque chose.
6. Ne jamais marquer « done » si un test échoue ou si un `expected` n'est pas atteint.

Après toute modif du JSON par Claude, prévenir l'utilisateur de recharger `taches.html`
(bouton ↺). Après édition manuelle dans le dashboard, l'utilisateur exporte et réenregistre
le fichier pour que Claude voie ses changements.

## Règle permanente : tenir le GDD à jour

`GDD.md` est la source de vérité du projet. **À chaque discussion, incrément, amélioration ou développement**, il doit être mis à jour systématiquement, sans qu'on ait à le demander.

### Quand mettre à jour
À la fin de **toute** session qui touche au design, au code ou aux specs :
- nouvelle décision de design (même discutée à l'oral dans le chat)
- feature ajoutée, modifiée ou retirée
- changement de stack, d'architecture ou de système
- prototype ou code livré qui change l'état réel du projet

Si une session ne change rien de substantiel, ne pas modifier le GDD.

### Quoi maintenir dans le GDD
Pour **chaque aspect du jeu**, le GDD doit refléter trois choses distinctes :

1. **Designé** — ce qui est décidé/spécifié (l'intention).
2. **État actuel** — ce qui est *réellement* implémenté dans le projet aujourd'hui (code, prototypes), distinct de ce qui est seulement designé.
3. **Historique** — journal daté des décisions et changements pour cet aspect.

### Comment procéder à chaque fin de session
1. Mettre à jour les sections de design concernées.
2. Mettre à jour la section **« État d'implémentation »** (ce qui est designé vs réellement codé).
3. Ajouter une entrée datée dans le **« Journal de bord »** en tête de changelog (date du jour, aspect concerné, ce qui a changé).
4. Incrémenter le numéro de **Version** en tête de document.
5. Garder le style concis et factuel existant.

### Format d'une entrée de journal
```
### AAAA-MM-JJ — vX.Y
- [Aspect] Ce qui a changé (designé / implémenté / décidé).
```

Ne jamais réécrire l'historique : on ajoute, on ne supprime pas les entrées passées.

## Commande « live » — déploiement systématique

Quand l'utilisateur dit **« live »** (ou « mets ça live », « déploie »), exécuter
**systématiquement et sans redemander** cette routine, dans l'ordre.

**Autonomie totale : ne jamais attendre de validation.** Committer et pousser
soi-même immédiatement dès que c'est possible. Ne rendre la main à l'utilisateur
(commande `git push` à lancer) qu'en cas d'échec d'auth GitHub avéré.

1. **Build + tests** : `cd app/client && npx tsc -b` puis `npx vite build` ; lancer les
   tests moteur (`cd app/client/src/game/engine && npx tsx engine.test.ts`). Ne pas
   continuer si ça échoue — corriger d'abord.
2. **GDD** : appliquer la règle « tenir le GDD à jour » ci-dessus si la session a changé
   quelque chose de substantiel.
3. **Commit** : `git add -A` puis commit avec un message clair
   (`-c user.name="Jeremy" -c user.email="jeremy@enaos.com"`).
4. **Synchro distant** : `git fetch origin` puis `git rebase origin/main`
   (résoudre les conflits en gardant l'état du jeu courant).
5. **Push** : `git push origin main`. Render redéploie automatiquement sur l'URL
   `*.onrender.com` (repo `jfongue/auto-monster`).

### Limite d'environnement (important)
- Le `.git` peut être figé par un `index.lock` mort → le supprimer
  (`rm -f .git/index.lock`, activer la suppression de fichiers si « Operation not
  permitted »). Après ça, commit/rebase fonctionnent.
- **Le `git push` échoue si aucun identifiant GitHub n'est disponible** dans
  l'environnement (proxy en lecture seule, pas de token, SSH bloqué). Dans ce cas :
  faire tout jusqu'à l'étape 4 (commit + rebase → arbre propre, « ahead 1 »), puis
  **donner à l'utilisateur l'unique commande restante** : `git push`. Ne pas prétendre
  avoir poussé si l'auth a échoué.
- Pour un push autonome futur : configurer un credential helper / token GitHub dans
  l'environnement, ou un `~/.git-credentials`.

### Notes prod
- Persistance prod = `DATABASE_URL` (Neon) côté Render ; sinon base mémoire (pg-mem),
  progression perdue au redémarrage.
- `dist/` est gitignoré ; Render le rebuild via `npm run build`.
