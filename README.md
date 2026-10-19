# Freeclutch

Suivi des candidatures freelance : missions, intermédiaires, entretiens, fiches métier et brief client généré par Claude.
Next.js (App Router), TypeScript, Supabase (Postgres, Auth, Storage), API Claude. Accès sur invitation uniquement.

## Installation locale

Prérequis : Node 24, npm, Docker (pour Supabase en local).

```bash
npm install
npx supabase start
```

`npx supabase start` lance Postgres, Auth, Storage et Mailpit, puis applique les migrations de `supabase/migrations`.
`npx supabase status -o env` affiche l'URL et les clés locales à reporter dans `.env.local` (voir plus bas).

```bash
cp .env.example .env.local
npm run dev
```

L'application tourne sur http://localhost:3000. Les e-mails (invitation, lien de connexion) arrivent dans Mailpit : http://127.0.0.1:54324.

Commandes utiles :

| Commande | Rôle |
| --- | --- |
| `npm test` | tests unitaires (Jest) |
| `npm run test:integration` | tests d'intégration, contre le Supabase local uniquement |
| `npm run lint` | ESLint |
| `npm run typecheck` | vérification TypeScript |
| `npm run db:types` | régénère `src/server/supabase/database-types.ts` depuis la base locale |
| `npx supabase db reset` | recrée la base locale à partir des migrations |

## Variables d'environnement

Toutes sont lues côté serveur uniquement (aucune n'a le préfixe `NEXT_PUBLIC_`). Le modèle est dans `.env.example`.

| Variable | Rôle | Valeur en local |
| --- | --- | --- |
| `SUPABASE_URL` | URL du projet Supabase | `API_URL` de `npx supabase status -o env` |
| `SUPABASE_ANON_KEY` | clé publique, utilisée avec la session de l'utilisateur (RLS) | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service role, utilisée par la sauvegarde planifiée et la restauration ; contourne la RLS, ne jamais l'exposer | `SERVICE_ROLE_KEY` |
| `API_KEY_ENCRYPTION_SECRET` | secret AES-256-GCM qui chiffre les clés API Claude des utilisateurs : 32 octets encodés en base64 | `openssl rand -base64 32` |
| `CRON_SECRET` | secret attendu par `/api/cron/backup` dans l'en-tête `Authorization: Bearer <CRON_SECRET>` ; Vercel l'envoie lui-même pour ses crons | `openssl rand -hex 32` |
| `GCS_BACKUP_BUCKET` | nom du bucket Google Cloud Storage qui reçoit les sauvegardes | facultatif en local |
| `GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64` | clé JSON du compte de service GCP, encodée en base64 (voir ci-dessous) | facultatif en local |
| `OPPORTUNITIES_INGEST_TOKEN` | jeton attendu par `/api/opportunities/ingest` dans l'en-tête `Authorization: Bearer <OPPORTUNITIES_INGEST_TOKEN>` ; sans lui, la route refuse tout | `openssl rand -hex 32` |

Changer `API_KEY_ENCRYPTION_SECRET` rend illisibles les clés API Claude déjà enregistrées : chaque utilisateur devra ressaisir la sienne.

Le compte de service des sauvegardes n'a que le rôle `roles/storage.objectCreator` sur le bucket : il peut créer des objets, pas les lire, les lister, les remplacer ni les supprimer.

Sa clé JSON est un secret : la télécharger **hors du dépôt** (par exemple `~/Downloads/cle.json`, jamais dans le dossier du projet), l'encoder, copier la valeur dans la variable d'environnement, puis supprimer le fichier :

```bash
base64 -i ~/Downloads/cle.json | tr -d '\n' | pbcopy
rm ~/Downloads/cle.json
```

## Navigation et fonctionnalités

Menu : « Mes candidatures », « Mon calendrier », « Mes opportunités », « Préférences ».

| Route | Contenu |
| --- | --- |
| `/` | accueil : rappels, prochains entretiens et missions mises en avant |
| `/candidatures` | tableau des candidatures |
| `/calendar` | « Mon calendrier » |
| `/candidatures/<id>` | page de la candidature, en lecture d'abord, avec un crayon pour modifier chaque bloc (en-tête, infos mission, contact, stack) |
| `/opportunites` | « Mes opportunités », avec recherche par titre, entreprise ou lieu |
| `/preferences` | préférences, clé API Claude, export des données (`/settings` redirige définitivement vers `/preferences`) |

- **Stack** : sur « J'ai postulé », la stack de la mission est extraite par l'IA.
- **Brief d'entretien** : « Générer le brief » devient « Brief généré · voir mon brief » et ouvre une fenêtre avec le brief par langue (fr/en) : une langue à la fois, choisie avant de générer, avec les callouts « Chiffres clés » et « Dates clés », « Mes notes sur l'entreprise », « Questions à poser en entretien » et « Voir les sources (N) » repliées. « Régénérer » relance la génération.
- **Suppression** : le bouton rouge « Supprimer la candidature » demande confirmation, puis supprime le journal, les entretiens, la fiche métier et son PDF. L'opportunité d'origine revient dans « À traiter ».

## Opportunités

La page « Mes opportunités » affiche les missions Free-Work des 7 derniers jours, filtrées selon les préférences de chaque utilisateur. Elle est alimentée par le watcher career-ops (`cloud/free-work-watcher`, dépôt career-ops), qui appelle le point d'entrée `POST /api/opportunities/ingest`.

- **Authentification** : `Authorization: Bearer <OPPORTUNITIES_INGEST_TOKEN>`. Sans jeton configuré côté Freeclutch, ou avec un jeton incorrect, la requête est refusée.
- **Lots** : 100 missions au maximum par requête.
- **Idempotence** : renvoyer une mission déjà reçue ne crée pas de doublon.
- **Missions invalides** : ignorées et comptées (`skippedInvalid`) ; un lot non vide entièrement invalide est refusé (422).
- **Purge** : chaque appel supprime les missions publiées il y a plus de 30 jours (date de publication Free-Work, pas date de réception).

Générer le jeton une seule fois, avec `openssl rand -hex 32`, puis placer la **même valeur** à deux endroits :

1. la variable d'environnement `OPPORTUNITIES_INGEST_TOKEN` du projet Vercel (et de `.env.local` pour un essai en local) ;
2. le secret GCP `freeclutch-ingest-token`, lu par le watcher.

Ne jamais coller le jeton dans un fichier suivi par git ni dans une commande qui resterait dans l'historique du shell. Pour le renouveler, générer une nouvelle valeur, la mettre à jour des deux côtés, puis redéployer Vercel. Le déploiement du watcher est documenté dans le dépôt career-ops.

## Inviter un utilisateur

L'inscription publique est désactivée. Pour ouvrir l'accès à quelqu'un :

1. Dans le tableau de bord Supabase du projet : **Authentication → Users → Add user → Send invitation**, puis saisir son adresse e-mail. En local, la même action se fait depuis Supabase Studio (http://127.0.0.1:54323).
2. La personne reçoit l'e-mail « Ton invitation à Freeclutch ». Son lien ouvre `/auth/confirm`, qui la connecte et la redirige vers l'accueil. Ensuite, elle se reconnecte avec un lien magique depuis `/login`.

Sur le projet hébergé, les modèles d'e-mail **Invite user** et **Magic link** doivent reprendre les liens de `supabase/templates/invite.html` et `supabase/templates/magic-link.html` (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`), et la **Site URL** doit être l'URL de production.

Un profil est créé automatiquement pour chaque nouveau compte.

## Export et sauvegardes

- **Export manuel** : Préférences (`/preferences`) → « Exporter mes données » télécharge `freeclutch-export-<AAAA-MM-JJ>.json` avec toutes les données de l'utilisateur connecté, PDF de fiches métier inclus (en base64). La clé API Claude n'y figure jamais.
- **Sauvegarde automatique** : le cron Vercel (`vercel.json`) appelle `/api/cron/backup` le lundi et le jeudi à 3 h UTC. Pour chaque utilisateur, un fichier au même format est créé dans `gs://<GCS_BACKUP_BUCKET>/backups/<AAAA-MM-JJ>/<userId>.json` (date de Paris). L'échec d'un utilisateur n'arrête pas les autres ; il apparaît dans les logs (`User data backup failed`, avec l'identifiant de l'utilisateur). Ces appels réguliers évitent aussi la mise en pause du projet Supabase gratuit.

Un objet déjà présent n'est jamais écrasé : relancer la sauvegarde le même jour échoue pour les utilisateurs déjà sauvegardés ce jour-là. Pour garder un historique borné, configurer une règle de cycle de vie sur le bucket (par exemple, suppression après 90 jours).

## Restaurer une sauvegarde

1. Télécharger le fichier voulu, par exemple :

   ```bash
   gcloud storage cp gs://<GCS_BACKUP_BUCKET>/backups/2026-10-19/<userId>.json ./sauvegarde.json
   ```

   Un export manuel (`freeclutch-export-<date>.json`) se restaure de la même façon.

2. Lancer la restauration avec l'URL et la clé service role du projet **cible**. Ne jamais coller la clé service role dans la commande, car elle resterait dans l'historique du shell : la saisir sans écho :

   ```bash
   export SUPABASE_URL=https://<projet>.supabase.co
   read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
   npx tsx scripts/restore-backup.ts ./sauvegarde.json
   unset SUPABASE_SERVICE_ROLE_KEY
   ```

   Autre possibilité : un fichier d'environnement non suivi par git (tout `.env*` est ignoré, par exemple `.env.restore`), chargé avec `set -a; source .env.restore; set +a`, puis supprimé après usage. Garder aussi le fichier de sauvegarde hors du dépôt et le supprimer une fois la restauration faite : il contient toutes les données de l'utilisateur.

Ce que fait le script :

- il refuse, sans rien écrire, un fichier qui n'est pas un export Freeclutch (`formatVersion: 1`), qui contient une ligne d'un autre utilisateur, dont un identifiant de ligne appartient déjà à un autre utilisateur en base, ou dont un PDF sort du dossier de l'utilisateur ou dépasse 4 Mo ;
- si le compte n'existe plus (projet recréé, utilisateur supprimé), il le recrée avec le même identifiant et l'adresse e-mail du profil ; l'utilisateur se reconnecte ensuite par lien magique ;
- il fait un upsert (insertion, ou mise à jour par identifiant) du profil, des intermédiaires, contacts, clients finaux, candidatures, journal d'activité, entretiens, fiches métier, reports d'alerte, briefs par langue, questions d'entretien, filtres et décisions des opportunités, dans l'ordre des dépendances, puis remet chaque PDF à son chemin de stockage ;
- les lignes absentes de la sauvegarde ne sont pas supprimées : pour revenir exactement à l'état sauvegardé, supprimer d'abord les données actuelles de l'utilisateur.

La clé API Claude n'étant jamais sauvegardée, l'utilisateur doit la ressaisir dans les préférences si son profil a été recréé.

## Déploiement

Le déploiement se fait à la main, dans cet ordre : Supabase, Google Cloud Storage, Vercel, puis le premier utilisateur. Vercel n'est configuré qu'à la fin car il a besoin des valeurs des deux premières étapes.

### 1. Projet Supabase hébergé (formule gratuite)

1. Sur [supabase.com/dashboard](https://supabase.com/dashboard), créer un projet (formule gratuite) et noter le mot de passe de la base.
2. Appliquer les migrations depuis ce dépôt :

   ```bash
   npx supabase login
   npx supabase link --project-ref <référence-du-projet>
   npx supabase db push
   ```

3. Dans **Authentication > Sign In / Providers** (ou **Settings**), désactiver les inscriptions (« Allow new users to sign up »). C'est l'équivalent de `enable_signup = false` dans `supabase/config.toml` : seules les invitations créent des comptes.
4. Dans **Authentication > URL Configuration** :
   - **Site URL** : le domaine Vercel, par exemple `https://<domaine>` ;
   - **Redirect URLs** : ajouter `https://<domaine>/auth/confirm`.
5. Dans **Authentication > Email Templates**, reproduire ce que `supabase/config.toml` fait en local (les fichiers sont dans `supabase/templates/`). Le lien de chaque modèle doit être :
   - **Magic link** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - **Invite user** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`

   Le plus simple est de copier le contenu de `supabase/templates/magic-link.html` et `supabase/templates/invite.html` dans les deux modèles, avec les mêmes objets.
6. Configurer un serveur SMTP personnalisé, **avant d'inviter qui que ce soit**. Le service d'e-mail intégré de Supabase n'envoie qu'aux adresses des membres de l'équipe du projet Supabase, avec une limite de quelques e-mails par heure : sans SMTP personnalisé, les invitations et les liens de connexion envoyés aux amis n'arrivent jamais, sans aucune erreur visible.
   - Créer un compte chez un fournisseur gratuit, par exemple [Resend](https://resend.com) (3 000 e-mails par mois) ou [Brevo](https://www.brevo.com) (300 e-mails par jour).
   - Chez ce fournisseur, vérifier le domaine d'envoi (enregistrements DNS SPF et DKIM) ou, à défaut, l'adresse d'expéditeur.
   - Dans **Authentication > Emails > SMTP Settings**, activer **Enable custom SMTP** et renseigner l'hôte, le port, l'identifiant, le mot de passe (clé SMTP du fournisseur), l'adresse et le nom d'expéditeur.
   - Dans **Authentication > Rate Limits**, relever la limite d'envoi d'e-mails (« Rate limit for sending emails »), par exemple à 30 par heure : la valeur par défaut reste très basse même avec un SMTP personnalisé.
   - Vérifier en s'envoyant un lien de connexion à une adresse qui n'est pas membre de l'équipe Supabase. Si l'application affiche un succès sans qu'aucun e-mail n'arrive, les journaux Vercel contiennent l'avertissement `Magic link email throttled` quand la limite d'envoi est atteinte.
7. Relever dans **Project Settings > API** : l'URL du projet (`SUPABASE_URL`), la clé `anon` (`SUPABASE_ANON_KEY`) et la clé `service_role` (`SUPABASE_SERVICE_ROLE_KEY`, secrète).

### 2. Sauvegardes sur Google Cloud Storage

1. Créer un bucket dans la région `europe-west9` (Paris).
2. Ajouter une règle de cycle de vie : action **Supprimer l'objet**, condition **Âge : 90 jours**.
3. Créer un compte de service et lui donner uniquement le rôle `roles/storage.objectCreator`, au niveau de ce bucket (onglet **Autorisations** du bucket), pas du projet.
4. Créer une clé JSON pour ce compte de service, la télécharger **hors du dépôt**, l'encoder en base64 puis la supprimer :

   ```bash
   base64 -i ~/Downloads/cle.json | tr -d '\n' | pbcopy
   rm ~/Downloads/cle.json
   ```

   La valeur copiée est `GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64`. Le nom du bucket est `GCS_BACKUP_BUCKET`.

### 3. Projet Vercel

1. Sur Vercel, **Add New > Project**, puis importer le dépôt GitHub.
2. Dans **Settings > Environment Variables**, renseigner chaque variable de `.env.example` :

   | Variable | Valeur |
   | --- | --- |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | relevées à l'étape 1 |
   | `API_KEY_ENCRYPTION_SECRET` | `openssl rand -base64 32` |
   | `CRON_SECRET` | une valeur aléatoire, par exemple `openssl rand -hex 32` |
   | `GCS_BACKUP_BUCKET`, `GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64` | relevées à l'étape 2 |
   | `OPPORTUNITIES_INGEST_TOKEN` | `openssl rand -hex 32` ; la **même valeur** que le secret GCP `freeclutch-ingest-token` (voir « Opportunités ») |

3. Les pages qui appellent l'IA déclarent un `maxDuration` jusqu'à 300 s, ce qui exige **Fluid compute** : il est activé par défaut sur les nouveaux projets, mais vérifier dans **Settings > Functions**.
4. `vercel.json` planifie la sauvegarde (`/api/cron/backup`, le lundi et le jeudi à 03:00 UTC). Vercel envoie `Authorization: Bearer <CRON_SECRET>` lui-même. Après le premier déploiement, vérifier dans **Settings > Cron Jobs** que la tâche est présente.
5. Déployer, puis reporter le domaine obtenu dans la **Site URL** et la **Redirect URL** de Supabase (étape 1.4) s'il a changé.

### 4. Premier utilisateur

1. Dans le tableau de bord Supabase, **Authentication > Users > Invite user** : s'inviter avec sa propre adresse.
2. Ouvrir le lien reçu par e-mail pour se connecter.
3. Dans **Préférences**, enregistrer sa clé API Claude.
4. Dans la console Anthropic, définir une limite de dépense mensuelle pour cette clé.
