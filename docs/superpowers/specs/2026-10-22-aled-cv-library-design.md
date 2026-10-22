# Aled — Bibliothèque de CV — Document de conception

Date : 2026-10-22
Statut : brouillon. Le porteur a demandé que les projets 2 et 3 soient conçus et réalisés sans questions pendant la nuit ; ses questions seront traitées à la relecture.

Projet 2 sur 3 de l'ensemble « mémoire des échanges » :
1. contacts et agences (réalisé) ;
2. **bibliothèque de CV** (ce document) ;
3. « J'ai eu un call » sur mobile.

Toutes les contraintes des documents précédents restent valables (conventions CLAUDE.md, identité Atelier, mode sombre, accessibilité, 360 px, tests, style « guillemets simples, sans point-virgule »). Les décisions marquées **[choix du rédacteur]** n'ont pas été validées par le porteur.

---

## 1. Intention

Le porteur a deux versions de CV ou plus (« CV DevOps », « CV React »), et en retouche parfois un pour une mission précise. Le pire moment de son métier : un recruteur le rappelle six mois après et lui dit « ah mais t'as deux CV ? », parce qu'il ne se souvient plus lequel il avait envoyé.

Il veut :
- **sauvegarder ses CV** dans l'app ;
- dans une candidature, **dire « c'est celui-là que j'ai envoyé »** ;
- **se faire challenger** quand un CV n'a pas bougé depuis longtemps : « bro, t'as le même CV depuis 3 mois, peut-être faut l'améliorer ». Refaire son CV fait partie de la prospection. Ce n'est pas une contrainte : rien n'est supprimé ni forcé.

**Ce qui a été tranché en conversation** :
- au maximum **10 CV** dans la bibliothèque, et **4 Mo** au maximum par fichier ;
- **aucune suppression automatique** : l'expiration à 3 mois devient un simple rappel ;
- un CV envoyé ne change jamais après coup. Mettre à jour un CV crée une nouvelle version, et les candidatures passées gardent le fichier exact qu'elles ont reçu ;
- rappel en jaune, non prioritaire, avec « Mettre à jour » ou « Il est encore bon » ;
- pas de rappel quand le freelance n'a aucune candidature en cours.

**Objectifs** :
- une page « Mes CV » : déposer, voir, remplacer (nouvelle version), renommer et supprimer un CV ;
- un bloc « CV envoyé » sur la fiche candidature, avec le choix d'un CV de la bibliothèque ou le dépôt d'un CV sur mesure ;
- le choix d'un CV dans le formulaire de création de candidature ;
- le CV envoyé affiché dans les missions proposées des fiches contact et agence (web et mobile) ;
- le rappel « Ton CV vieillit » dans « À faire » (web et mobile) ;
- les CV inclus dans l'export et les sauvegardes.

**Hors périmètre** :
- formats autres que PDF ;
- aperçu du PDF dans la page : on l'ouvre dans un nouvel onglet, comme les fiches de poste ;
- analyse ou amélioration du CV par l'IA (piste pour l'offre payante) ;
- gestion de la bibliothèque depuis le mobile, qui reste en lecture seule pour les CV **[choix du rédacteur]**.

**Anti-objectifs** :
- perdre le fichier exact envoyé pour une candidature ;
- forcer l'utilisateur ou supprimer un CV sans action de sa part ;
- garder indéfiniment des fichiers que plus rien ne référence (coût) ;
- un rappel bruyant pour quelqu'un qui ne cherche pas de mission.

## 2. Vocabulaire

- **CV** : une entrée de la bibliothèque (« CV DevOps »). Au plus 10 par utilisateur.
- **Version** : un fichier PDF déposé. Un CV a une **version actuelle**, la plus récente, et éventuellement d'anciennes versions conservées parce qu'une candidature les a envoyées.
- **CV sur mesure** : une version déposée pour une seule candidature, sans entrée dans la bibliothèque. Elle ne compte pas dans la limite de 10.
- **CV envoyé** : la version rattachée à une candidature.

## 3. Modèle de données

Une migration additive. Les types sont régénérés et recopiés à l'identique dans le mobile.

### 3.1 Tables

- `cvs` : `id`, `user_id`, `label text not null` (100 caractères maximum, validé par l'app), `reviewed_at timestamptz not null default now()`, `created_at`, `updated_at`. Contraintes : `unique (user_id, id)` et le RLS « mes lignes uniquement », comme les autres tables.
- `cv_versions` :
  - colonnes : `id`, `user_id`, `cv_id uuid` (nullable ; null pour une version sur mesure ou orpheline), `label text not null`, `storage_path text not null`, `file_name text not null`, `byte_size int not null`, `uploaded_at timestamptz not null default now()`, `created_at` ;
  - clé étrangère composite `(user_id, cv_id)` vers `cvs` en `on delete set null` ;
  - `label` est une copie du nom du CV au moment du dépôt (ou du nom choisi pour un CV sur mesure). La candidature affiche donc toujours le nom de l'époque, même si le CV est renommé ou supprimé ensuite.
- `job_applications.sent_cv_version_id uuid` (nullable), avec une clé étrangère composite vers `cv_versions (user_id, id)` en `on delete set null`.

### 3.2 Bucket

Bucket `cvs`, privé :
- `file_size_limit = 4194304` (4 Mo), `allowed_mime_types = array['application/pdf']` ;
- les quatre mêmes politiques que `job-specs` (premier segment du chemin = `auth.uid()`) ;
- chemin des fichiers : `{userId}/{versionId}.pdf`.

### 3.3 Vues

- `cvs_overview` (`security_invoker`) : les colonnes de `cvs`, plus la version actuelle (`current_version_id`, `current_version_uploaded_at`, `current_version_file_name`, `current_version_storage_path`) et `sent_count`, le nombre de candidatures ayant envoyé une version de ce CV.
- `job_applications_overview` est recréée avec deux colonnes en plus : `sent_cv_label` et `sent_cv_uploaded_at`. Toutes les colonnes existantes sont conservées.

### 3.4 Règles de conservation des fichiers

Une version est **conservée** si elle est la version actuelle d'un CV, **ou** si une candidature l'a envoyée. Toute autre version est supprimée, ligne et fichier.

On applique cette règle à chaque opération qui peut rendre une version inutile :
- dépôt d'une nouvelle version d'un CV : l'ancienne version actuelle disparaît si aucune candidature ne l'a envoyée ;
- suppression d'un CV : ses versions non envoyées disparaissent, et les versions envoyées restent avec `cv_id` à null ;
- changement ou retrait du CV envoyé d'une candidature, et suppression d'une candidature : la version qui n'est plus référencée disparaît si elle n'est la version actuelle d'aucun CV.

Le fichier est supprimé du stockage par l'app après la suppression de la ligne, comme `deleteJobApplicationWithFiles` le fait pour les fiches de poste. Le mécanisme exact (fonction SQL qui renvoie les chemins à supprimer, ou repository) est laissé au builder, avec des tests d'intégration.

### 3.5 Limite de 10

On ne peut pas créer un 11e CV. Le dépôt est refusé avec « Tu as déjà 10 CV. Supprimes-en un pour en ajouter un nouveau. ».

La limite est vérifiée côté serveur avant le dépôt **et** par la base (trigger `before insert` sur `cvs`), pour résister à deux dépôts simultanés **[choix du rédacteur]**. Les CV sur mesure ne comptent pas.

### 3.6 Fichiers acceptés

PDF uniquement, 4 Mo au maximum, avec la signature `%PDF-`. On réutilise `hasPdfSignature` et le modèle de `validateJobSpecPdfFile`.

Messages :
- « Dépose un fichier PDF. »
- « PDF trop lourd (4 Mo maximum) »
- « Ce fichier n'est pas un PDF valide. »

## 4. Web

### 4.1 Navigation

Un nouvel élément **« Mes CV »** (`/cv`) prend place entre « Mes contacts » et « Mon calendrier » **[choix du rédacteur : le porteur dit que refaire son CV fait partie de sa prospection, donc la page mérite le premier niveau plutôt qu'une section des Préférences]**.

Il faut aussi ajouter `/cv` aux préfixes d'app de `landing-routing.ts`.

### 4.2 Page « Mes CV »

- **En-tête** : titre « Mes CV », compteur « {n} / 10 », bouton « Ajouter un CV ». Le bouton est désactivé à 10, avec le message de limite affiché à côté.
- **« Ajouter un CV »** : un nom (obligatoire, 100 caractères maximum, par exemple « CV DevOps ») et un PDF (glisser-déposer ou sélection, comme la fiche de poste).
- **Une carte par CV**, du plus récemment mis à jour au plus ancien :
  - nom, puis « Mis à jour le {date} » ;
  - si la dernière mise à jour ou la dernière confirmation (« Il est encore bon ») date de plus de 3 mois, une pastille « À revoir » ;
  - « Envoyé dans {n} candidature(s) » ;
  - actions : « Voir » (le PDF actuel dans un nouvel onglet), « Remplacer » (dépose une nouvelle version), « Renommer », « Supprimer ».
- **Supprimer** demande une confirmation : « Les candidatures auxquelles tu as envoyé ce CV le garderont. ».
- **Remplacer** : la nouvelle version devient l'actuelle et `reviewed_at` repasse à maintenant.
- **Anciennes versions** : un dépliant « Anciennes versions envoyées » liste les versions conservées parce qu'envoyées (date, nombre de candidatures, « Voir »).
- **État vide** : « Ajoute tes CV ici pour retrouver lequel tu as envoyé à chaque candidature. »

### 4.3 Bloc « CV envoyé » sur la fiche candidature

Ce bloc, dans l'onglet Aperçu à côté du bloc Contact, suit le même modèle de bloc modifiable.

- **Vue** : « {label} · version du {date} » avec « Voir », ou « Aucun CV indiqué ».
- **Modification** :
  - une liste « Choisir dans ma bibliothèque » qui rattache la **version actuelle** du CV choisi ;
  - « Déposer un CV sur mesure » : un PDF et un nom (par défaut « CV sur mesure · {intitulé de la candidature} »), avec une case « L'ajouter aussi à ma bibliothèque ». Si la case est cochée, cela crée un CV de bibliothèque dont cette version est l'actuelle, dans la limite de 10 ;
  - « Retirer le CV envoyé ».

### 4.4 Formulaire de création de candidature

Un champ facultatif « CV envoyé » (liste des CV de la bibliothèque, « Aucun » par défaut) rattache la version actuelle du CV choisi.

Le CV sur mesure se dépose ensuite depuis la fiche candidature, pour ne pas alourdir la création **[choix du rédacteur]**.

### 4.5 Ouverture des PDF

Route `GET /api/cvs/versions/[versionId]/pdf`, sur le modèle de la route des fiches de poste : authentification par cookie, URL signée de 5 minutes, redirection 302, 404 si la version n'appartient pas à l'utilisateur.

### 4.6 Fiches contact et agence

`ProposedMission` gagne `sentCvLabel: string | null` et `sentCvUploadedAt: Date | null`. La liste des missions proposées affiche « CV : {label} ({date}) » quand ils sont renseignés. C'est la réponse directe au « ah mais t'as deux CV ? ».

### 4.7 Rappel « Ton CV vieillit »

- **Condition** : l'utilisateur a au moins une candidature en cours (statut actif), et la version actuelle d'un CV **et** son `reviewed_at` datent tous deux de plus de **90 jours** (`CV_REVIEW_INTERVAL_DAYS = 90`).
- **Message** : « Ton {label} n'a pas bougé depuis {n} mois. Un coup de neuf ? »
- **Présentation** : non prioritaire (dernier dans l'ordre d'affichage), couleur jaune ou pêche de l'identité. La carte mène à `/cv`.
- **Actions** :
  - « Mettre à jour » mène à `/cv` ;
  - « Il est encore bon » met `reviewed_at` à maintenant et fait disparaître le rappel pour 90 jours.
- **Pas de nouvelle valeur dans l'énum Postgres `alert_kind`** : ce rappel ne passe pas par `alert_snoozes`. Le type TypeScript des alertes s'étend pour accepter une alerte qui n'est pas liée à une candidature. La forme exacte est laissée au builder (union discriminée recommandée).
- Le compteur de la barre « À faire » inclut ce type.

## 5. Mobile

En lecture seule.

- **Fiche candidature** : une ligne « CV envoyé » (« {label} · {date} »). Un appui ouvre le PDF : URL signée créée directement avec `supabase.storage.from('cvs').createSignedUrl(path, 300)` (les politiques du bucket l'autorisent pour ses propres fichiers), puis `openWebPage`.
- **Fiches contact et agence** : le CV envoyé apparaît dans les missions proposées, comme sur le web.
- **Accueil, « À faire »** : le rappel « Ton CV vieillit » s'affiche, non pressable, avec « Mets-le à jour depuis l'app web. » en sous-titre **[choix du rédacteur]**.
- Les fichiers de domaine et les types restent des copies à l'identique du web.

## 6. Export, sauvegarde, restauration

- Le snapshot gagne `cvs` et `cvVersions`, avec le PDF en base64 sur chaque version, comme `jobSpecs`.
- La restauration :
  - ajoute ces clés à `ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS`, pour qu'un ancien fichier reste restaurable ;
  - vérifie que chaque chemin reste dans le dossier de l'utilisateur et que chaque PDF fait 4 Mo au maximum ;
  - restaure les lignes dans l'ordre des dépendances (`cvs`, puis `cv_versions`, puis `job_applications.sent_cv_version_id`) et réenvoie les fichiers.
- `formatVersion` reste à 1.

## 7. Tests

- **Domaine** : validation du PDF et du nom, calcul du rappel (seuil de 90 jours, pas de candidature active, `reviewed_at` récent), formatage.
- **Intégration** :
  - la limite de 10, y compris par la base ;
  - les règles de conservation de §3.4, avec chaque cas ;
  - l'isolation entre utilisateurs (tables, vues, bucket) ;
  - export puis restauration d'un CV avec une version envoyée.
- **Composants et controllers** : page « Mes CV », bloc « CV envoyé », champ du formulaire de création, rappel.
- **Mobile** : la ligne « CV envoyé » et l'ouverture du PDF, le rappel sur l'accueil.

## 8. Laissé au builder

- Le mécanisme de nettoyage des versions (§3.4).
- La forme exacte du type d'alerte étendu.
- La disposition des écrans, dans l'identité Atelier.
- Le découpage en composants, actions et repositories.

## 9. Précisions apportées après relecture (choix du rédacteur)

1. **Version actuelle stockée** : `cvs.current_version_id uuid` (nullable), avec une clé étrangère composite vers `cv_versions (user_id, id)` en `on delete set null`. On insère d'abord la version, puis on met à jour le CV. La règle de conservation de §3.4 se lit alors ainsi : une version est conservée si un CV la désigne comme `current_version_id`, ou si une candidature l'a envoyée. `cvs_overview` lit la version actuelle par ce pointeur.
2. **CV sur mesure avec « L'ajouter aussi à ma bibliothèque » quand la bibliothèque est pleine** : le CV sur mesure est quand même déposé et rattaché à la candidature. Seul l'ajout à la bibliothèque est refusé, avec « Le CV est rattaché à la candidature, mais ta bibliothèque est pleine (10 CV). ». Ordre des opérations : envoi du fichier, insertion de la version (`cv_id` null), rattachement à la candidature, puis, si la case est cochée et qu'il reste de la place, création du CV avec `current_version_id` = cette version et `cv_id` mis à jour sur la version.
3. **Un rappel par CV** qui vieillit. Il a une clé propre, par exemple `cv:{cvId}:cv_outdated`, et « Il est encore bon » ne concerne que ce CV. Le compteur « À faire » compte chaque CV concerné.
4. **« Candidature en cours »** se mesure avec le prédicat `isActiveStatus` déjà utilisé par les autres rappels (statut non terminal).
5. **Synchronisation mobile** : copie manuelle des fichiers de domaine et des types, vérifiée par un `diff` dans le plan mobile, comme pour le projet 1.
6. **Ordre de restauration** :
   - premier passage : `cvs` avec `current_version_id` à null, et `job_applications` avec `sent_cv_version_id` à null ;
   - puis `cv_versions` et l'envoi des fichiers ;
   - enfin, mise à jour de `cvs.current_version_id` et de `job_applications.sent_cv_version_id`.

   `cvs` et `cvVersions` s'ajoutent à `SNAPSHOT_TABLE_NAMES` et à `ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS`.
7. **Suppression d'une candidature** : l'app lit la version envoyée avant de supprimer la ligne, puis applique la règle de conservation. La suppression d'un compte ne nettoie pas le bucket. C'est déjà le cas pour `job-specs`, et c'est hors périmètre.
8. **Doublons de nom** : deux CV peuvent porter le même nom.
9. **Échec de l'ouverture du PDF sur mobile** : message « Impossible d'ouvrir le CV pour le moment. ».
10. Le fichier des préfixes d'app est bien `src/domain/landing-routing.ts` (`APP_PATH_PREFIXES`).
