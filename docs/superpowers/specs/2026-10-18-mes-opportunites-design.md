# Freeclutch V2 — « Mes opportunités » : document de conception

Date : 2026-10-18
Statut : validé le 2026-10-18

Ce document complète la conception V1 (`2026-10-17-freeclutch-design.md`) et en reprend toutes les contraintes (stack, conventions de code, sécurité, tests). Les décisions marquées **[choix du rédacteur]** ont été prises pendant la conception et n'ont pas été demandées explicitement par le porteur du projet.

---

## 1. Intention

Le porteur du projet a déjà un robot, le watcher **career-ops**, déployé sur GCP. Il interroge Free-Work 10 fois par jour et poste les nouvelles missions dans un salon Discord. Quand une mission l'intéresse, le porteur clique sur le lien, lit l'annonce sur Free-Work et y postule. C'est tout.

**Le but de la V2 :** remplacer Discord par Freeclutch pour le profil `dev`. Les missions arrivent dans un onglet « Mes opportunités ». Un clic sur « J'ai postulé » les transforme en candidature, et elles rejoignent le suivi existant.

Freeclutch est multi-utilisateur : **chaque utilisateur règle ses propres filtres** dans ses Réglages et ne voit que les missions qui y correspondent.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Recevoir dans Freeclutch toutes les nouvelles missions freelance publiées sur Free-Work, collectées par le watcher.
- Afficher à chaque utilisateur les missions qui passent ses filtres. Sans aucun filtre, toutes les missions s'affichent.
- Laisser chaque utilisateur modifier ses filtres dans Réglages, avec un effet immédiat, sans redéploiement.
- Transformer une mission en candidature pré-remplie en un clic.
- Écarter une mission inintéressante, avec possibilité de revenir sur ce choix.
- Ne plus envoyer le profil `dev` sur Discord.

**Non-objectifs**
- Conserver le profil `cyber` : il n'existe que dans un stash du porteur et disparaît au déploiement (accepté, §4).
- Ajouter d'autres sources que Free-Work (LinkedIn, Collective…).
- Noter les missions avec une IA.
- Envoyer des notifications (e-mail, push, Discord). Le porteur a coupé ses notifications Discord, et l'app mobile viendra plus tard.
- Postuler depuis Freeclutch : la candidature se fait toujours sur Free-Work.

**Anti-objectifs**
- Une panne de Freeclutch ne doit pas faire planter le watcher.
- Le point d'entrée qui reçoit les missions ne doit pas pouvoir être utilisé par quelqu'un d'autre que le watcher.
- Une mission ne doit pas apparaître en double.
- Les filtres d'un utilisateur ne doivent pas influencer ce que voit un autre utilisateur.

## 3. Architecture retenue (validée par le porteur)

```
Free-Work (API publique)
  → watcher career-ops (Cloud Function GCP, 10 passages par jour, AUCUN filtre pour Freeclutch)
  → Freeclutch : POST /api/opportunities/ingest (jeton secret)
  → table commune des missions (stockées une seule fois)
  → chaque utilisateur voit celles qui passent SES filtres (calcul côté Freeclutch)
```

Le watcher devient un simple collecteur. Le filtrage par utilisateur se fait dans Freeclutch, ce qui permet d'ajouter un utilisateur sans rien changer côté GCP.

## 4. Côté watcher (dépôt career-ops, `cloud/free-work-watcher/`)

**Point de départ :** le porteur a mis de côté avec `git stash` ses modifications non commitées qui ajoutaient le profil `cyber` (« pas ma priorité »). La V2 part donc du code commité, qui n'a qu'un seul profil, `dev`. Le stash n'est ni appliqué ni supprimé.

**Conséquence acceptée par le porteur :** la fonction actuellement déployée sur GCP contient le profil `cyber`. Redéployer la V2 depuis le code commité **arrête le flux Discord `cyber`**, et le porteur l'a accepté explicitement.

Après le déploiement, le watcher n'a donc plus aucune destination Discord. Les alertes de panne globale (`postAlert`) n'ont plus de destinataire. Le seul signal de panne devient l'indicateur de fraîcheur de Freeclutch (§5.4), et les journaux GCP.

Changements :
- **Nouvelle destination « Freeclutch »**, à côté de Discord. Il n'existe pas aujourd'hui d'abstraction « destination » ; la créer est laissé au builder (une liste de destinations injectée dans `runScan` est la piste naturelle).
- **Contenu envoyé :**
  - Freeclutch reçoit toutes les missions freelance publiées **au cours des 7 derniers jours** (date de Paris), **avant tout filtre de profil** (décision du porteur).
  - Le premier passage après le déploiement rattrape ainsi la semaine écoulée, et une panne de Freeclutch de moins de 7 jours ne fait perdre aucune mission.
  - Le parcours Discord existant (missions du jour, filtrées par le profil `dev`) n'est plus utilisé.
  - **Volume mesuré le 2026-10-18 :**
    - l'API renvoie 30 missions par page ;
    - Free-Work publie plusieurs centaines de missions freelance par jour, plus de 200 selon le porteur ;
    - 7 jours représentent donc de l'ordre de 1 500 à 3 000 missions, soit 50 à 100 pages.
  - Le plafond de pages de ce parcours est réglable (`FREECLUTCH_MAX_PAGES`, 120 par défaut), et le délai maximal de la fonction passe de 120 s à 300 s. Si le plafond est atteint avant la limite des 7 jours, le watcher le journalise (`console.warn`) avec le nombre de pages lues.
  - Seules les missions non encore envoyées à Freeclutch sont transmises. La mémoire est un nouvel état propre à Freeclutch dans le bucket GCS existant (préfixe `sent-freeclutch`). Elle contient les identifiants Free-Work déjà livrés et conserve au moins 8 jours d'historique, pour couvrir la fenêtre de 7 jours. **[choix du rédacteur]**
  - L'état n'est enregistré qu'après un envoi réussi, comme pour Discord. Grâce à l'enregistrement idempotent côté Freeclutch, un renvoi accidentel ne crée pas de doublon.
- **Discord :** le profil `dev` n'envoie plus sur Discord, et le secret `free-work-discord-webhook` n'est plus monté. **[choix du rédacteur]** Le code Discord est conservé mais devient optionnel : sans webhook configuré, il ne fait rien, et `postAlert` aussi. Le retirer complètement est laissé au builder.
- **Charge utile :** un tableau de missions au format `Mission` existant (`src/free-work.mjs`) : `id, title, url, company, description, rateMin, rateMax, rateLabel, currency, remoteMode, locationLabel, region, country, durationMonths, publishedAt, skills[]`. Ajouter `source: "free-work"`. La description est le texte complet, pas la version tronquée pour Discord.
- **Découpage :** les missions sont envoyées par paquets de 100, en autant de requêtes qu'il le faut. **Le nombre de missions par passage n'est pas limité** : le premier passage, avec le rattrapage de la semaine, peut en compter plusieurs milliers. Chaque paquet réussi est enregistré dans la mémoire avant l'envoi du suivant, pour qu'un échec en cours de route ne fasse renvoyer que les paquets restants. **[choix du rédacteur]**
- **Échec Freeclutch :**
  - les missions ne sont pas marquées comme envoyées, et seront renvoyées au passage suivant **du même jour** ;
  - comme le watcher lit les 7 derniers jours, une panne de moins d'une semaine ne fait perdre aucune mission. L'indicateur de fraîcheur (§5.4) rend la panne visible ;
  - l'erreur est journalisée avec `console.error` ;
  - aucune alerte Discord n'est envoyée.
- **Configuration :**
  - variable `FREECLUTCH_INGEST_URL` (`https://freeclutch.vercel.app/api/opportunities/ingest`) ;
  - secret Secret Manager `freeclutch-ingest-token`, monté en `FREECLUTCH_INGEST_TOKEN` ;
  - les deux sont ajoutés à `deploy.sh` et à `DEPLOIEMENT.md`.
- Le mode test (`dryRun`) existant affiche aussi ce qui serait envoyé à Freeclutch, sans rien envoyer.

## 5. Côté Freeclutch

### 5.1 Point d'entrée `POST /api/opportunities/ingest`
- **Authentification :** `Authorization: Bearer <OPPORTUNITIES_INGEST_TOKEN>` (variable Vercel), comparé en temps constant, sur le modèle du cron de sauvegarde. Réponse 401 sinon. Le proxy ignore déjà `/api/*`.
- **Validation :** le corps est validé avec zod. Au plus 100 missions par requête. Taille de corps raisonnable. Une mission invalide est ignorée et comptée, sans faire échouer les autres.
- **Écriture :**
  - via le client service role ;
  - **upsert idempotent** sur `(source, external_id)`, où `external_id` est l'`id` Free-Work ;
  - un renvoi met à jour la mission sans créer de doublon ni modifier `received_at`.
- **Nettoyage :** à chaque appel, suppression des missions publiées il y a plus de **30 jours**. **[choix du rédacteur]** Pas de nouveau cron : le plan Vercel Hobby en limite le nombre.
- **Réponse :** `{ received, upserted, skippedInvalid, purged }`.

### 5.2 Données
- **`opportunities`**, une table commune à tous les utilisateurs, car ce sont des annonces publiques. Colonnes :
  - `id`, `source`, `external_id`, `url`, `title`, `company`, `description` ;
  - `rate_min`, `rate_max`, `rate_label`, `currency`, `remote_mode` ;
  - `location_label`, `region`, `country`, `duration_months` ;
  - `published_at`, `skills jsonb`, `received_at`.

  Accès en lecture pour tout utilisateur connecté (RLS) ; écriture réservée au service role.
- **`opportunity_decisions`**, une ligne par utilisateur et par mission décidée :
  - `user_id`, `opportunity_id` (`on delete cascade`) ;
  - `decision` (`applied` | `dismissed`) ;
  - `job_application_id` (nullable, renseigné quand la décision est `applied`) ;
  - `decided_at`.

  Clé unique `(user_id, opportunity_id)`. RLS par utilisateur, et clé étrangère composite vers `job_applications(user_id, id)` comme dans le reste du schéma.
- **Filtres** de chaque utilisateur, dans une table dédiée `opportunity_filters` avec une clé unique `(user_id, source)` (voir §5.5) :
  - `include_keywords text[]` (au moins un doit être présent) ;
  - `always_exclude_keywords text[]` (exclusions dures, jamais rattrapées : « stage », « alternance »…) ;
  - `rescuable_exclude_keywords text[]` (technos exclues, sauf rattrapage : « java », « .net »…) ;
  - `rescue_keywords text[]` (mots de rattrapage : « react », « next.js »…) ;
  - `rate_floor_full_remote int`, `rate_floor_hybrid int`, `rate_floor_onsite int` (nullable : vide = pas de minimum) ;
  - `regions text[]`.
- `opportunities_last_viewed_at` sur le profil, pour le badge « nouveau ». Il servira aussi aux futures notifications de l'app mobile. **[choix du rédacteur]**

### 5.3 Règles de filtrage (calculées côté Freeclutch, par utilisateur)
Elles reprennent la logique de `filters.mjs`, rattrapage compris (décision du porteur : « le marché est trop compliqué ») :
- **Texte examiné :** le titre de la mission, comme le profil `dev` actuel. **[choix du rédacteur]** Ajouter les compétences provoque de fausses exclusions, d'après le commentaire de `filters.mjs`.
- **Correspondance des mots-clés :** mot entier, insensible à la casse et aux accents. Elle reprend `buildKeywordMatcher`, avec ses lookarounds Unicode, pour éviter que « java » attrape « javascript » ou que « ia » attrape « spécialiste ».
- **Mots-clés à inclure :** si la liste n'est pas vide, la mission doit en contenir au moins un.
- **Exclusions dures :** si la mission en contient une, elle est écartée, sans rattrapage possible.
- **Exclusions rattrapables :** si la mission en contient une, elle est écartée, **sauf** si elle contient aussi un mot de rattrapage. Exemple : « Dev Fullstack React / Java », avec « java » en exclusion rattrapable et « react » en rattrapage, est gardée.
- **Ordre d'évaluation**, identique au watcher : inclusion, puis exclusions dures, puis exclusions rattrapables avec le rattrapage, puis TJM, puis régions.
- **TJM minimum :**
  - le TJM pris en compte est le haut de la fourchette ;
  - un TJM non communiqué passe toujours ;
  - le plancher appliqué dépend de `remote_mode`, et un mode inconnu prend le plancher le plus strict des trois renseignés ;
  - un plancher vide n'est pas appliqué.
- **Régions :** si la liste n'est pas vide, la mission doit être en full remote, ou l'une des régions saisies doit correspondre à la mission. Une mission sans région ni lieu passe, comme dans le watcher.
  - **[choix du rédacteur]** « Correspondre » veut dire que la région saisie, une fois normalisée (casse et accents ignorés), est égale au champ `region` de la mission ou contenue dans son `location_label`. Ainsi « Paris » et « Île-de-France » marchent tous les deux pour une mission à « Paris, Île-de-France ».
  - Le champ de saisie propose en suggestion les régions déjà reçues.
  - **[choix du rédacteur]** Il n'y a pas de filtre par pays, contrairement au watcher qui limite à la France. Free-Work publie très peu de missions à l'étranger, et le filtre « régions » suffit à les écarter.
- **Aucun filtre renseigné :** toutes les missions s'affichent (demande explicite du porteur).

### 5.4 Page « Mes opportunités » (`/opportunites`, nouvel onglet de la navigation)
Disposition validée sur maquette.
- **Trois onglets :**
  - **À traiter :** missions qui passent les filtres, sans décision, publiées **cette semaine** (7 derniers jours, demande du porteur). Les onglets « Postulées » et « Ignorées » gardent l'historique sur 30 jours ;
  - **Postulées** ;
  - **Ignorées.**
- **Tri :** date de publication décroissante. **[choix du rédacteur]** Le tri Discord par TJM décroissant reste possible en option, à la discrétion du builder.
- **Carte :**
  - titre, entreprise, TJM (`rate_label`, sinon fourchette, sinon « Non communiqué »), présentiel, lieu, durée, heure ou date de publication, début de description dépliable ;
  - badge « nouveau » si la mission est arrivée après la dernière visite.
- **Boutons :**
  - **« Voir sur Free-Work »** : lien externe (`target="_blank" rel="noopener noreferrer"`, http et https uniquement).
  - **« J'ai postulé »** : crée la candidature et la décision `applied`, puis affiche un lien « Voir la candidature ». La mission passe dans « Postulées ». La candidature créée contient :
    - le titre de la mission ;
    - la source « Free-Work » ;
    - le lien de l'annonce ;
    - le texte de l'annonce (la description) ;
    - l'intermédiaire = l'entreprise Free-Work ;
    - le TJM affiché = le haut de la fourchette ;
    - le lieu et le présentiel (libellé) ;
    - la durée (« N mois ») ;
    - la stack, tirée des compétences (catégorie « Autre », origine « annonce ») ;
    - la date de candidature = aujourd'hui (Paris) ;
    - le statut Postulé.
  - **« Pas intéressé »** : décision `dismissed`.
  - Dans « Ignorées » : **« Remettre »**, qui supprime la décision.
  - Dans « Postulées » : un lien vers la candidature.
- **Visite de la page :** elle met à jour `opportunities_last_viewed_at`.
- **Indicateur de fraîcheur** **[choix du rédacteur]** : en haut de la page, « Dernière réception il y a X », calculé à partir du `received_at` le plus récent.
  - Il passe en avertissement si rien n'est arrivé depuis plus de 4 heures entre 9h et 22h (heure de Paris).
  - C'est le seul signal de panne côté porteur : il a coupé les notifications Discord, et le watcher n'a plus de destination Discord pour ses alertes de panne globale.
- **Navigation :** le compteur « À traiter » s'affiche à côté de l'onglet. **[choix du rédacteur]**

### 5.5 Réglages → Opportunités → page « Free-Work »
- **Une page de réglages dédiée à la source Free-Work** (demande du porteur, pour pouvoir industrialiser plus tard).
  - Les filtres sont rangés **par utilisateur et par source** (`source = 'free-work'`) : une future source (LinkedIn, Collective…) aura sa propre page et ses propres filtres, sans migration des données existantes.
  - La navigation des Réglages liste les sources disponibles. En V2, il n'y en a qu'une.
- **Quatre listes de mots-clés** saisies sous forme d'étiquettes :
  - « Doit contenir au moins un de » ;
  - « Exclure toujours » ;
  - « Exclure, sauf si rattrapé » ;
  - « Mots de rattrapage ».

  Chacune est accompagnée d'une phrase d'aide et d'un exemple.
- **Trois TJM minimum :** full remote, hybride, sur site.
- **Liste de régions.**
- **Aucun pré-remplissage :** chaque utilisateur saisit ses filtres lui-même (demande du porteur).
- **Effet immédiat** sur « À traiter ».

### 5.6 Sauvegarde et export
- L'export et la sauvegarde par utilisateur incluent ses filtres et ses décisions.
- La table commune `opportunities` n'est pas sauvegardée : ce sont des données publiques, purgées après 30 jours.
- À la restauration, une décision dont la mission n'existe plus est ignorée.

## 6. Contraintes
- Toutes celles de la V1 : sécurité, conventions de code du porteur, fuseau Europe/Paris, tests (unitaires, intégration avec isolation entre utilisateurs, `test:tz`).
- Watcher : JavaScript ES modules avec `// @ts-check`, et ses tests existants (`node --test`) ; suivre le style du dépôt career-ops.
- Déploiements :
  - Freeclutch : migration Supabase (`db push`) puis déploiement Vercel ;
  - watcher : `deploy.sh`.

  Ces actions touchent la production et se font avec l'accord du porteur au moment de les lancer.

## 7. Laissé au builder
- La forme exacte de l'abstraction « destinations » dans le watcher.
- La table ou les colonnes portant les filtres.
- Les noms exacts des fichiers et composants, dans le respect des conventions.
- Le calcul du filtrage : en SQL ou en TypeScript, tant que la logique est testée et que la page reste rapide pour quelques milliers de missions.

## 8. Roadmap (hors V2)
- App mobile avec notifications de nouvelles missions (s'appuyant sur `opportunities_last_viewed_at`).
- Autres sources que Free-Work.
- Profil `cyber` dans Freeclutch, le jour où le pote du porteur devient utilisateur.
