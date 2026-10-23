# Aled

Aled (anciennement Freeclutch) : le dépôt GitHub s'appelle `aled-web` et l'application est servie sur `https://app.aled.work` ; les noms techniques portent encore `freeclutch`.

Suivi des candidatures freelance : missions, intermédiaires, entretiens, fiches métier et brief client généré par Claude.
Next.js (App Router), TypeScript, Supabase (Postgres, Auth, Storage), API Claude.

## Identité Atelier

- **Jetons** : les couleurs, rayons et polices vivent dans `src/app/globals.css` (jetons de rôle `--primary`, `--accent-text`, `--brand-tile`, `--deep-surface`, `--lilac-panel`, `--menu-counter`, `--peach`, `--ink`…), exposées en classes Tailwind (`bg-primary`, `text-accent-text`, `bg-peach-tint`…). Le bloc `:root[data-theme='dark']` contient les valeurs sombres. Aucun hexadécimal ni classe `dark:` dans les composants.
- **Tons de `Pill`** (`src/components/pill`) : `neutral`, `sage`, `forest-soft`, `brand`, `action`, `peach`, `peach-soft`, `lilac`, `lilac-soft`, `clay`, `counter`. `PillToggle` en dérive et expose le ton via `data-tone`.
- **Thème** : choix Clair / Sombre / Système dans le menu en pilule (bouton « Thème »), mémorisé dans `localStorage` (`aled-theme`), appliqué avant la première peinture par le script de `src/lib/theme/theme-init-script.ts`. Un changement fait depuis le menu passe par un fondu (`document.startViewTransition`), sans animation si le navigateur ne la gère pas ou si l'appareil demande moins d'animations (`prefers-reduced-motion`).
- **Contraste** : tout texte doit atteindre 4,5:1 dans les deux thèmes, vérifié par `atelier-theme.test.ts`. Sur `bg-peach`, utiliser `text-on-peach` ; sur `bg-lilac`, utiliser `text-on-lilac`.

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

L'application tourne sur http://localhost:3000. Les e-mails (confirmation d'inscription, récupération de mot de passe, invitation, lien de connexion) arrivent dans Mailpit : http://127.0.0.1:54324. Les modèles en français sont dans `supabase/templates/` (`confirmation.html` et `recovery.html` pour l'inscription).

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
| `LANDING_HOSTNAMES` | domaines qui affichent la landing page, séparés par des virgules ; le premier est le domaine canonique (voir « Landing page ») | `aled.localhost` |
| `APP_ORIGIN` | origine de l'app, utilisée par les liens de la landing (« Se connecter », inscription) et pour renvoyer vers l'app les anciens liens ouverts sur la landing ; sans elle, les liens restent relatifs | `http://localhost:3000` |
| `ANDROID_APP_SHA256_FINGERPRINTS` | empreintes SHA-256 des certificats de signature de l'app Android `work.aled.app`, séparées par des virgules ; servies dans `/.well-known/assetlinks.json` pour que les liens `app.aled.work` s'ouvrent dans l'app (voir « App Links Android ») | facultatif en local |

Changer `API_KEY_ENCRYPTION_SECRET` rend illisibles les clés API Claude déjà enregistrées : chaque utilisateur devra ressaisir la sienne.

Le compte de service des sauvegardes n'a que le rôle `roles/storage.objectCreator` sur le bucket : il peut créer des objets, pas les lire, les lister, les remplacer ni les supprimer.

Sa clé JSON est un secret : la télécharger **hors du dépôt** (par exemple `~/Downloads/cle.json`, jamais dans le dossier du projet), l'encoder, copier la valeur dans la variable d'environnement, puis supprimer le fichier :

```bash
base64 -i ~/Downloads/cle.json | tr -d '\n' | pbcopy
rm ~/Downloads/cle.json
```

## Navigation et fonctionnalités

Menu : « Mes candidatures », « Mes contacts », « Mes CV », « Mon calendrier », « Mes opportunités », « Préférences ».

| Route | Contenu |
| --- | --- |
| `/` | accueil : rappels, prochains entretiens et missions mises en avant |
| `/candidatures` | tableau des candidatures |
| `/contacts` | « Mes contacts » : onglets contacts et agences, avec la page de chaque contact (profil, missions, échanges, notes) et de chaque agence (`/agences/<id>`) |
| `/calendar` | « Mon calendrier » |
| `/candidatures/<id>` | page de la candidature, en lecture d'abord, avec un crayon pour modifier chaque bloc (en-tête, infos mission, contact, stack) |
| `/opportunites` | « Mes opportunités », avec recherche par titre, entreprise ou lieu |
| `/cv` | « Mes CV » : bibliothèque de 10 CV maximum (PDF de 4 Mo), versions conservées tant qu'une candidature les a envoyées, rappel après 90 jours |
| `/preferences` | préférences, clé API Claude, export des données (`/settings` redirige définitivement vers `/preferences`) |

- **Stack** : sur « J'ai postulé », la stack de la mission est extraite par l'IA.
- **Brief d'entretien** : « Générer le brief » devient « Brief généré · voir mon brief » et ouvre une fenêtre avec le brief par langue (fr/en) : une langue à la fois, choisie avant de générer, avec les callouts « Chiffres clés » et « Dates clés », « Mes notes sur l'entreprise », « Questions à poser en entretien » et « Voir les sources (N) » repliées. « Régénérer » relance la génération.
- **Brief technique** : dans « Préparer l'entretien », il demande le CV envoyé pour la candidature, rattaché à celle-ci. Chaque mission du CV doit lister sa stack, sinon le brief ne sait pas sur lesquelles appuyer.
- **Suppression** : le bouton rouge « Supprimer la candidature » demande confirmation, puis supprime le journal, les entretiens, la fiche métier et son PDF. L'opportunité d'origine revient dans « À traiter ».

## Landing page

La landing page de `aled.work` vit dans ce projet, sous le segment interne `src/app/vitrine/` (accueil, `mentions-legales`, `confidentialite`, `sitemap.xml`, `robots.txt` et image d'aperçu). Elle n'utilise ni Supabase ni session : ses pages sont statiques.

- **Routage par domaine** : `src/proxy.ts` reconnaît les domaines de `LANDING_HOSTNAMES` et réécrit leurs chemins vers `/vitrine` (`aled.work/` affiche `/vitrine`, `aled.work/mentions-legales` affiche `/vitrine/mentions-legales`). `www.aled.work` redirige vers `aled.work`. Un chemin de l'app ouvert sur la landing (`/login`, `/auth/confirm`, `/candidatures/…`, `/api/…`) redirige vers le même chemin sur `APP_ORIGIN`. Sur `app.aled.work`, `/vitrine` renvoie une 404 en production.
- **Textes** : tous les textes de la page sont dans `src/domain/landing-copy.ts`, ceux des pages légales dans `src/domain/legal-copy.ts`. Le mot « freelance » y est interdit, un test le vérifie.
- **En local** : mettre `LANDING_HOSTNAMES=aled.localhost` et `APP_ORIGIN=http://localhost:3000` dans `.env.local`, lancer `npm run dev`, puis ouvrir `http://aled.localhost:3000` (Chrome et Firefox résolvent `*.localhost` tout seuls). L'app reste sur `http://localhost:3000`.
- **Prévisualisations Vercel** : la landing est consultable sans connexion sur `<url-de-prévisualisation>/vitrine`.
- **Référencement** : la landing est indexable ; l'app ne l'est pas (`robots.txt` qui interdit tout et `noindex` sur ses pages).
- **Mesure d'audience** : Vercel Web Analytics, sans cookie, sur la landing seulement. L'activer dans **Analytics** du projet Vercel.

### Checklist de lancement

1. L'inscription publique existe sur `app.aled.work/inscription` (projet séparé) et la relecture du contrat est livrée.
2. Les emplacements `[À COMPLÉTER` de `src/domain/legal-copy.ts` sont remplis, et le test « contains no placeholder left » de `src/domain/legal-copy.test.ts` est activé (retirer le `.skip`).
3. La page Confidentialité couvre aussi l'app (comptes, candidatures, clé API).
4. Dans Vercel : renseigner `LANDING_HOSTNAMES` et `APP_ORIGIN` en Production, activer Web Analytics, retirer la redirection de `aled.work` (voir « Domaine de production »), puis déployer.

## App Links Android

Les liens `https://app.aled.work/auth/confirm…` (connexion et invitation) et `https://app.aled.work/candidatures/…` s'ouvrent dans l'app mobile quand elle est installée sur Android. Android le vérifie avec `/.well-known/assetlinks.json`, servi par `src/app/.well-known/assetlinks.json/route.ts` sans connexion (chemin public du proxy).

1. Récupérer l'empreinte SHA-256 du certificat de signature : `npx eas-cli@latest credentials -p android` dans `aled-mobile`, ligne « SHA256 Fingerprint ». Une fois l'app sur le Play Store, ajouter aussi l'empreinte de Play App Signing (Play Console > Configuration > Signature de l'application).
2. Dans Vercel, renseigner `ANDROID_APP_SHA256_FINGERPRINTS` (les empreintes séparées par des virgules), puis redéployer : le fichier est généré au build.
3. Vérifier que `https://app.aled.work/.well-known/assetlinks.json` répond en JSON, sans redirection.

Tant que la variable est vide, le fichier contient `[]` et les liens continuent de s'ouvrir dans le navigateur.

## Opportunités

La page « Mes opportunités » affiche les missions freelance Free-Work et Collective des 7 derniers jours, filtrées selon les préférences de chaque utilisateur (`/preferences/opportunites`) : un seul jeu de filtres pour toutes les sources, et un interrupteur par source pour masquer ses missions de « À traiter ». Elle est alimentée par le watcher career-ops (`cloud/free-work-watcher`, dépôt career-ops), qui appelle le point d'entrée `POST /api/opportunities/ingest`.

- **Authentification** : `Authorization: Bearer <OPPORTUNITIES_INGEST_TOKEN>`. Sans jeton configuré côté Freeclutch, ou avec un jeton incorrect, la requête est refusée.
- **Source** : chaque mission porte sa `source` (`free-work` ou `collective`) ; une source absente ou inconnue rend la mission invalide.
- **Lots** : 100 missions au maximum par requête.
- **Idempotence** : renvoyer une mission déjà reçue ne crée pas de doublon (clé : source + identifiant). Une même mission publiée sur les deux plateformes apparaît deux fois.
- **Missions invalides** : ignorées et comptées (`skippedInvalid`) ; un lot non vide entièrement invalide est refusé (422).
- **Purge** : chaque appel supprime les missions publiées il y a plus de 30 jours (date de publication sur la plateforme, pas date de réception).

Générer le jeton une seule fois, avec `openssl rand -hex 32`, puis placer la **même valeur** à deux endroits :

1. la variable d'environnement `OPPORTUNITIES_INGEST_TOKEN` du projet Vercel (et de `.env.local` pour un essai en local) ;
2. le secret GCP `freeclutch-ingest-token`, lu par le watcher.

Ne jamais coller le jeton dans un fichier suivi par git ni dans une commande qui resterait dans l'historique du shell. Pour le renouveler, générer une nouvelle valeur, la mettre à jour des deux côtés, puis redéployer Vercel. Le déploiement du watcher est documenté dans le dépôt career-ops.

## Créer un compte utilisateur

L'inscription est publique : chacun crée son compte lui-même, par e-mail et mot de passe ou avec Google ou LinkedIn. Les comptes se connectent ensuite sur le web (`/login`) comme sur l'application mobile.

Parcours d'une inscription :

1. Sur `/inscription` (web) ou depuis l'écran d'inscription de l'application, la personne saisit son prénom, son e-mail, un mot de passe d'au moins 8 caractères, son statut (freelance ou salarié) et accepte les conditions d'utilisation.
2. Elle reçoit un e-mail de confirmation. Le lien ouvre `/auth/confirm`, qui vérifie le jeton et ouvre la session.
3. Avec Google ou LinkedIn, le retour passe par `/auth/callback` (échange de code PKCE) et aucun e-mail de confirmation n'est nécessaire.
4. En cas d'oubli, `/mot-de-passe-oublie` envoie un lien de récupération ; `/mot-de-passe/nouveau` permet de choisir le nouveau mot de passe.

Routes concernées : `/inscription`, `/mot-de-passe-oublie`, `/mot-de-passe/nouveau`, `/auth/confirm` (types `email`, `invite`, `signup`, `recovery`) et `/auth/callback`.

Un profil est créé automatiquement pour chaque nouveau compte. Il garde le statut professionnel (`professional_status`) et la date d'acceptation des conditions (`terms_accepted_at`).

Secours, création manuelle (par exemple si l'inscription est coupée ou pour un compte de test) :

1. Dans le tableau de bord Supabase du projet : **Authentication → Users → Add user → Create new user**, saisir l'adresse e-mail et un mot de passe, et cocher **Auto Confirm User**. Sans cette case, la connexion est refusée avec « Ton compte n'est pas encore activé. ». En local, la même action se fait depuis Supabase Studio (http://127.0.0.1:54323).
2. Transmettre le mot de passe à la personne par un canal privé. Elle pourra ensuite le changer depuis l'application ou passer par `/mot-de-passe-oublie`.

Sur le projet hébergé, la mise en route de l'inscription est décrite dans « Mettre en production les inscriptions ».

## Mettre en production les inscriptions

Le code et la configuration locale (`supabase/config.toml`) sont prêts. Les réglages du projet Supabase hébergé, de Google et de LinkedIn se font à la main. Ordre à respecter :

1. La landing est en ligne sur `aled.work`, avec les pages légales accessibles (voir « Landing page > Checklist de lancement »). C'est à ce moment que `LANDING_HOSTNAMES` et `APP_ORIGIN` sont renseignées en Production.
2. L'écran de consentement Google est configuré avec les URL de confidentialité et des conditions d'utilisation, qui doivent donc déjà répondre. Google peut exiger la vérification du domaine `aled.work` : à contrôler dans la console.
3. Les inscriptions s'ouvrent (réglages Supabase ci-dessous, puis Google et LinkedIn).

### 1. Réglages Supabase

1. **Authentication > Sign In / Providers** : activer **Allow new users to sign up** et **Confirm email**, puis fixer la longueur minimale du mot de passe à 8.
2. **Authentication > URL Configuration** :
   - **Site URL** : `https://app.aled.work` ;
   - **Redirect URLs** : `https://app.aled.work/auth/callback` et `aled://auth/callback` (le schéma `aled://` sert à l'application mobile).
3. **Authentication > Email Templates** : coller le contenu de `supabase/templates/confirmation.html` dans **Confirm signup** et celui de `supabase/templates/recovery.html` dans **Reset password**, avec les mêmes objets que ceux du fichier.
4. **Authentication > Rate Limits** : Resend est déjà le SMTP du projet, donc relever la limite d'envoi d'e-mails (« Rate limit for sending emails »), par exemple à 30 par heure. Vérifier que l'intervalle minimal entre deux e-mails (« Minimum interval between emails », réglage du fournisseur e-mail ou des limites de débit dans **Authentication**) vaut 60 secondes ou plus ; l'emplacement exact est à confirmer dans le tableau de bord. Cela empêche des répétitions rapides de révéler si un compte existe et limite les abus. Attention : Supabase voit l'IP du serveur Vercel, pas celle de l'utilisateur. Les limites par IP s'appliquent donc à tous les utilisateurs ensemble.
5. Variables Vercel (Production) : `APP_ORIGIN` et `LANDING_HOSTNAMES`, déjà renseignées le jour du lancement de la landing (voir « Projet Vercel »). Sans hôte de landing, les liens légaux pointent vers `/vitrine/...`, qui est une 404 sur l'hôte de l'application, et l'application journalise `Landing hostname missing for legal links` (`console.error`).

### 2. Google

1. Ouvrir la [Google Cloud Console](https://console.cloud.google.com), créer un projet ou choisir celui existant.
2. **APIs & Services > OAuth consent screen** : type **External**, nom de l'application `Aled`, e-mail d'assistance, domaine `aled.work`, URL de la politique de confidentialité `https://aled.work/confidentialite` et URL des conditions d'utilisation `https://aled.work/conditions-utilisation`.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**.
4. Dans **Authorized redirect URIs**, ajouter `https://<référence-du-projet>.supabase.co/auth/v1/callback`.
5. Copier le **Client ID** et le **Client secret**.
6. Dans Supabase, **Authentication > Sign In / Providers > Google** : activer le fournisseur, coller l'identifiant et le secret, enregistrer.
7. Publier l'application avant le lancement public. Un écran de consentement **External** démarre en mode « Testing » : seuls les testeurs listés peuvent se connecter. Cliquer sur « Publier l'application » pour passer le statut à « In production ». Le libellé exact du bouton est à vérifier dans la console, car l'interface Google Auth Platform peut répartir ces réglages entre Branding, Audience et Clients.

### 3. LinkedIn

1. Ouvrir [LinkedIn Developers](https://www.linkedin.com/developers/apps) et **Create app**. L'app doit être rattachée à une page entreprise LinkedIn.
2. Onglet **Products** : demander **Sign In with LinkedIn using OpenID Connect**.
3. Onglet **Auth** : ajouter l'URL de redirection `https://<référence-du-projet>.supabase.co/auth/v1/callback`.
4. Copier le **Client ID** et le **Primary Client Secret**.
5. Dans Supabase, **Authentication > Sign In / Providers > LinkedIn (OIDC)** : activer le fournisseur, coller l'identifiant et le secret, enregistrer.

### 4. Application mobile

Un nouveau build de développement est nécessaire : `expo-clipboard` et `expo-crypto` sont des modules natifs, à reconstruire. Le schéma `aled://auth/callback` doit être dans les **Redirect URLs** de Supabase (étape 1.2).

### 5. Avant le lancement

La page `/conditions-utilisation` contient des marqueurs `[À COMPLÉTER …]`. Le porteur doit les remplir avant d'ouvrir les inscriptions. Le texte est dans `src/domain/legal-copy.ts` (`TERMS_OF_USE_DOCUMENT`), en 7 sections : Objet, Compte, Usage de l'IA et clé Claude, Données, Responsabilité, Résiliation, Droit applicable. Le test « contains no placeholder left » de `src/domain/legal-copy.test.ts` est ignoré (`.skip`) : l'activer une fois les emplacements remplis. Vérifier ensuite un parcours complet : inscription par e-mail, confirmation, déconnexion, récupération du mot de passe, puis Google et LinkedIn.

### Activer Google et LinkedIn en local

Les blocs `[auth.external.google]` et `[auth.external.linkedin_oidc]` de `supabase/config.toml` sont désactivés (`enabled = false`). Pour les essayer en local :

1. Créer les identifiants comme ci-dessus, avec l'URI de redirection `http://127.0.0.1:54321/auth/v1/callback`.
2. Exporter les variables lues par la configuration : `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, `SUPABASE_AUTH_EXTERNAL_LINKEDIN_OIDC_CLIENT_ID` et `SUPABASE_AUTH_EXTERNAL_LINKEDIN_OIDC_SECRET`.
3. Passer `enabled = true` dans le bloc voulu.
4. Redémarrer Supabase : `npx supabase stop && npx supabase start`.

Réglages locaux déjà en place : inscriptions et confirmations activées, mot de passe de 8 caractères minimum, `email_sent` à 30 et intervalle minimal d'une seconde entre deux e-mails (`max_frequency`).

## Export et sauvegardes

- **Export manuel** : Préférences (`/preferences`) → « Exporter mes données » télécharge `freeclutch-export-<AAAA-MM-JJ>.json` avec toutes les données de l'utilisateur connecté, PDF de fiches métier et CV (toutes leurs versions) inclus (en base64). La clé API Claude n'y figure jamais.
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
- si le compte n'existe plus (projet recréé, utilisateur supprimé), il le recrée avec le même identifiant et l'adresse e-mail du profil ; le compte recréé n'a pas de mot de passe : en définir un depuis sa fiche dans Supabase (**Authentication → Users**) avant que l'utilisateur se reconnecte ;
- il fait un upsert (insertion, ou mise à jour par identifiant) du profil, des intermédiaires, contacts, clients finaux, candidatures, journal d'activité, entretiens, fiches métier, reports d'alerte, briefs par langue, questions d'entretien, filtres et décisions des opportunités, dans l'ordre des dépendances, puis rattache les contacts sans agence à celle de leur candidature la plus récente et remet chaque PDF à son chemin de stockage ;
- les lignes absentes de la sauvegarde ne sont pas supprimées : pour revenir exactement à l'état sauvegardé, supprimer d'abord les données actuelles de l'utilisateur.

La clé API Claude n'étant jamais sauvegardée, l'utilisateur doit la ressaisir dans les préférences si son profil a été recréé.

## CI/CD

Le workflow `.github/workflows/ci-cd.yml` tourne à chaque push, sur toutes les branches :

1. **checks** : lint, typecheck, tests unitaires, tests de fuseau horaire, build ;
2. **integration** : tests d'intégration sur un Supabase local démarré dans le runner ;
3. **deploy** (seulement sur `main`, et seulement si les deux jobs précédents passent) : `supabase db push` applique les migrations en attente sur la base de production, puis la CLI Vercel construit et déploie la production. Les migrations passent donc toujours avant le code qui en dépend.

`vercel.json` désactive le déploiement automatique de Vercel sur `main` (`git.deploymentEnabled`) : la production ne se déploie que par ce workflow. Les autres branches gardent leurs déploiements de prévisualisation Vercel.

Secrets à créer dans GitHub (**Settings > Secrets and variables > Actions**) :

| Secret | Valeur |
| --- | --- |
| `VERCEL_TOKEN` | un jeton créé sur [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `orgId` et `projectId` de `.vercel/project.json` (après `npx vercel link`) |
| `SUPABASE_ACCESS_TOKEN` | un jeton créé sur [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | le mot de passe de la base de production |
| `SUPABASE_PROJECT_ID` | la référence du projet Supabase |

Le watcher Free-Work + Collective (career-ops) se déploie à part, avec son propre `deploy.sh`. Déployer Freeclutch **avant** le watcher : tant que Freeclutch ne connaît pas la source `collective`, il refuse ces missions.

## Déploiement

La première mise en place se fait à la main, dans cet ordre : Supabase, Google Cloud Storage, Vercel, puis le premier utilisateur. Vercel n'est configuré qu'à la fin car il a besoin des valeurs des deux premières étapes. Ensuite, les migrations et les déploiements passent par la CI/CD.

### 1. Projet Supabase hébergé (formule gratuite)

1. Sur [supabase.com/dashboard](https://supabase.com/dashboard), créer un projet (formule gratuite) et noter le mot de passe de la base.
2. Appliquer les migrations depuis ce dépôt :

   ```bash
   npx supabase login
   npx supabase link --project-ref <référence-du-projet>
   npx supabase db push
   ```

3. Les inscriptions, les fournisseurs Google et LinkedIn et les modèles d'inscription se règlent dans « Mettre en production les inscriptions ».
4. Dans **Authentication > URL Configuration** :
   - **Site URL** : `https://app.aled.work` ;
   - **Redirect URLs** : ajouter `https://app.aled.work/auth/confirm`, `https://app.aled.work/auth/callback` et `aled://auth/callback`.
5. Dans **Authentication > Email Templates**, reproduire ce que `supabase/config.toml` fait en local (les fichiers sont dans `supabase/templates/`). Le lien de chaque modèle doit être :
   - **Magic link** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - **Invite user** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Confirm signup** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - **Reset password** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

   Le plus simple est de copier le contenu des fichiers de `supabase/templates/` dans les modèles, avec les mêmes objets :
   - Magic link : `magic-link.html`
   - Invite : `invite.html`
   - Confirm signup : `confirmation.html`
   - Reset password : `recovery.html`
6. Configurer un serveur SMTP personnalisé avant d'envoyer des e-mails Supabase (invitation, lien magique). La connexion par mot de passe n'envoie aucun e-mail et fonctionne sans. Le service d'e-mail intégré de Supabase n'envoie qu'aux adresses des membres de l'équipe du projet Supabase, avec une limite de quelques e-mails par heure : sans SMTP personnalisé, ces e-mails n'arrivent jamais, sans aucune erreur visible.
   - Créer un compte chez un fournisseur gratuit, par exemple [Resend](https://resend.com) (3 000 e-mails par mois) ou [Brevo](https://www.brevo.com) (300 e-mails par jour).
   - Chez ce fournisseur, vérifier le domaine d'envoi (enregistrements DNS SPF et DKIM) ou, à défaut, l'adresse d'expéditeur.
   - Dans **Authentication > Emails > SMTP Settings**, activer **Enable custom SMTP** et renseigner l'hôte, le port, l'identifiant, le mot de passe (clé SMTP du fournisseur), l'adresse et le nom d'expéditeur.
   - Dans **Authentication > Rate Limits**, relever la limite d'envoi d'e-mails (« Rate limit for sending emails »), par exemple à 30 par heure : la valeur par défaut reste très basse même avec un SMTP personnalisé.
   - Vérifier en envoyant une invitation depuis le tableau de bord à une adresse qui n'est pas membre de l'équipe Supabase.
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
   | `LANDING_HOSTNAMES`, `APP_ORIGIN` | `aled.work,www.aled.work` et `https://app.aled.work`, en **Production** uniquement, le jour du lancement de la landing (voir « Landing page ») |

3. Les pages qui appellent l'IA déclarent un `maxDuration` jusqu'à 300 s, ce qui exige **Fluid compute** : il est activé par défaut sur les nouveaux projets, mais vérifier dans **Settings > Functions**.
4. `vercel.json` planifie la sauvegarde (`/api/cron/backup`, le lundi et le jeudi à 03:00 UTC). Vercel envoie `Authorization: Bearer <CRON_SECRET>` lui-même. Après le premier déploiement, vérifier dans **Settings > Cron Jobs** que la tâche est présente.
5. Déployer, puis reporter le domaine obtenu dans la **Site URL** et la **Redirect URL** de Supabase (étape 1.4) s'il a changé.
6. Brancher le domaine de production `app.aled.work` (voir « Domaine de production »).

### Domaine de production

L'application est servie sur `https://app.aled.work`. Le domaine racine `aled.work` est réservé à la landing page, servie par ce même projet. Le code ne contient aucun domaine en dur : les redirections d'authentification partent de l'URL de la requête et les e-mails de `{{ .SiteURL }}`. Changer de domaine se fait donc uniquement dans les services externes, dans cet ordre :

1. **Vercel**, dans **Settings > Domains** : ajouter `app.aled.work`, puis créer chez le registrar l'enregistrement DNS `CNAME app` avec la valeur affichée par Vercel. Attendre que Vercel indique « Valid Configuration » et que le certificat HTTPS soit émis.
2. **Supabase**, dans **Authentication > URL Configuration** : passer la **Site URL** à `https://app.aled.work` et ajouter `https://app.aled.work/auth/confirm` aux **Redirect URLs**. Garder l'ancienne redirect URL quelques jours : les liens de connexion déjà envoyés pointent encore vers l'ancien domaine.
3. **Watcher career-ops** : redéployer avec `deploy.sh`, dont `FREECLUTCH_INGEST_URL` vaut `https://app.aled.work/api/opportunities/ingest` par défaut. Ne pas compter sur une redirection de l'ancien domaine : `fetch` retire l'en-tête `Authorization` lorsqu'il suit une redirection vers un autre domaine, et l'ingestion serait refusée (401).
4. **Expéditeur des e-mails** (optionnel) : pour envoyer depuis une adresse `@aled.work`, vérifier le domaine chez le fournisseur SMTP (SPF, DKIM) puis changer l'adresse d'expéditeur dans **Authentication > Emails > SMTP Settings**.
5. Une fois le watcher vérifié sur le nouveau domaine, rediriger `aled.work` et `freeclutch.vercel.app` vers `app.aled.work` dans **Settings > Domains**. Quand la landing page est prête, retirer la redirection de `aled.work` : le domaine reste attaché à ce projet Vercel, qui sert alors la landing. Les sessions sont liées au domaine : il faut se reconnecter une fois sur `app.aled.work`.

### 4. Premier utilisateur

1. Dans le tableau de bord Supabase, **Authentication > Users > Add user > Create new user** : créer son compte avec sa propre adresse, un mot de passe, et **Auto Confirm User** coché.
2. Se connecter sur `/login` avec cette adresse et ce mot de passe.
3. Dans **Préférences**, enregistrer sa clé API Claude.
4. Dans la console Anthropic, définir une limite de dépense mensuelle pour cette clé.
