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

Changer `API_KEY_ENCRYPTION_SECRET` rend illisibles les clés API Claude déjà enregistrées : chaque utilisateur devra ressaisir la sienne.

Le compte de service des sauvegardes n'a que le rôle `roles/storage.objectCreator` sur le bucket : il peut créer des objets, pas les lire, les lister, les remplacer ni les supprimer.

Sa clé JSON est un secret : la télécharger **hors du dépôt** (par exemple `~/Downloads/cle.json`, jamais dans le dossier du projet), l'encoder, copier la valeur dans la variable d'environnement, puis supprimer le fichier :

```bash
base64 -i ~/Downloads/cle.json | tr -d '\n' | pbcopy
rm ~/Downloads/cle.json
```

## Inviter un utilisateur

L'inscription publique est désactivée. Pour ouvrir l'accès à quelqu'un :

1. Dans le tableau de bord Supabase du projet : **Authentication → Users → Add user → Send invitation**, puis saisir son adresse e-mail. En local, la même action se fait depuis Supabase Studio (http://127.0.0.1:54323).
2. La personne reçoit l'e-mail « Ton invitation à Freeclutch ». Son lien ouvre `/auth/confirm`, qui la connecte et la redirige vers l'accueil. Ensuite, elle se reconnecte avec un lien magique depuis `/login`.

Sur le projet hébergé, les modèles d'e-mail **Invite user** et **Magic link** doivent reprendre les liens de `supabase/templates/invite.html` et `supabase/templates/magic-link.html` (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`), et la **Site URL** doit être l'URL de production.

Un profil est créé automatiquement pour chaque nouveau compte.

## Export et sauvegardes

- **Export manuel** : Réglages → « Exporter mes données » télécharge `freeclutch-export-<AAAA-MM-JJ>.json` avec toutes les données de l'utilisateur connecté, PDF de fiches métier inclus (en base64). La clé API Claude n'y figure jamais.
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
- il fait un upsert (insertion, ou mise à jour par identifiant) du profil, des intermédiaires, contacts, clients finaux, candidatures, journal d'activité, entretiens, fiches métier et reports d'alerte, dans l'ordre des dépendances, puis remet chaque PDF à son chemin de stockage ;
- les lignes absentes de la sauvegarde ne sont pas supprimées : pour revenir exactement à l'état sauvegardé, supprimer d'abord les données actuelles de l'utilisateur.

La clé API Claude n'étant jamais sauvegardée, l'utilisateur doit la ressaisir dans les réglages si son profil a été recréé.
