# Inscriptions publiques (web) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sur l'app web, n'importe qui peut s'inscrire par e-mail et mot de passe, avec une confirmation par e-mail, ou par Google ou LinkedIn. On ajoute aussi « Mot de passe oublié », le changement de mot de passe, le statut « Freelance / CDI », la trace du consentement et une page de conditions d'utilisation.

**Architecture :**
- **Données :** une migration ajoute deux colonnes au profil et enrichit le trigger de création de profil, qui lit les métadonnées d'inscription et d'OAuth.
- **Domaine :** `src/domain/sign-up.ts` porte les validations, les messages et la correspondance des erreurs. Il sera recopié à l'identique sur le mobile.
- **Serveur :**
  - actions serveur dans `src/server/actions/auth-actions.ts` : inscription, renvoi, mot de passe, démarrage OAuth ;
  - routes `/auth/confirm` (types étendus) et `/auth/callback` (échange PKCE) ;
  - `proxy.ts` : nouveaux chemins publics, redirection des connectés.
- **Pages :** `/inscription`, `/mot-de-passe-oublie`, `/mot-de-passe/nouveau`, la page vitrine `/conditions-utilisation`, une carte de statut sur l'accueil et deux sections dans les préférences.

**Tech Stack:** Next.js 16.4 (App Router, server actions, route handlers, `proxy.ts`), `@supabase/ssr` (PKCE), Supabase Auth, Jest 30 + Testing Library, intégration sur Supabase local (Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-23-aled-inscriptions-design.md`. Le §7 « Précisions » fait foi en cas de doute.

## Global Constraints

- CLAUDE.md du porteur :
  - fonctions fléchées uniquement ;
  - `export const`, sauf `page.tsx`, `layout.tsx` et les `route.ts`, qui exportent `GET` et `POST` nommés ;
  - jamais de `any`, aucun `console.log`, pas de commentaire ;
  - noms explicites, aucun import inutilisé ;
  - un dossier par composant en kebab-case, avec `<nom>.tsx`, `interfaces.ts`, `index.ts` (`export * from './<nom>'`) et `controller.tsx` (`useController`) si la logique dépasse 4 fonctions.
- AGENTS.md : lire le guide Next 16 concerné dans `node_modules/next/dist/docs/` avant d'écrire une page, une route, une action serveur ou `proxy.ts`.
- Textes en français, au tutoiement, **mot pour mot** quand la spec les donne.
- Sécurité :
  - aucun message ne révèle qu'une adresse a déjà un compte ;
  - aucun mot de passe, jeton ni e-mail complet dans les logs. Seuls le `code` et le `status` de l'erreur Supabase sont journalisés.
- Couleurs : uniquement des tokens existants ; `atelier-theme.test.ts` doit rester vert.
- Style :
  - guillemets simples, sans point-virgule ;
  - jamais de formateur, jamais de reformatage du code existant.
- Git :
  - committer sur la branche courante, sans créer ni changer de branche ;
  - **jamais de `git push`** ;
  - aucune ligne `Co-Authored-By` ni mention d'IA ;
  - `git add <chemins>` uniquement.
- Supabase : en local seulement (`npx supabase db reset`, `npm run db:types`). Jamais `--linked`, `db push` ni `link`.
- Commandes :
  - `npm test -- <motif>`, `npm run typecheck`, `npm run lint`, `npm run test:integration -- <motif>` ;
  - PATH : `export PATH="/usr/local/bin:$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Review Focus

1. **Une adresse déjà inscrite** (confirmée ou non) qui se réinscrit obtient le même écran « Vérifie ta boîte mail » que les autres : pas de second compte, pas de message différent. Testé dans les tâches 3 et 4, et en intégration dans la tâche 1.
2. **Un utilisateur connecté qui clique sur un lien de récupération ou de confirmation** n'est pas redirigé loin de `/auth/confirm`. Le lien de récupération mène bien à `/mot-de-passe/nouveau`. Testé dans la tâche 3.
3. **Un retour OAuth sans `code`, ou avec `error=access_denied`** (l'utilisateur annule chez Google), arrive sur `/login?error=oauth` avec le message de la spec, sans plantage. Testé dans la tâche 3.
4. **Les métadonnées OAuth variées** (`given_name` seul, `full_name` seul, `name` seul, rien du tout, un prénom de 300 caractères) donnent un prénom correct ou `null`, jamais une erreur qui bloquerait la création du compte. Testé dans la tâche 1.
5. **Un double clic sur « Créer mon compte » ou « Renvoyer l'e-mail »** n'envoie qu'une requête. Le renvoi reste bloqué 60 s. Testé dans la tâche 4.

---

### Task 1: Migration, trigger, configuration locale et templates

**Files:**
- Create: `supabase/migrations/20261023120000_public_sign_up.sql`
- Create: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`
- Modify: `supabase/config.toml`
- Modify: `src/server/supabase/database-types.ts` (régénéré)
- Create: `tests/integration/public-sign-up.test.ts`

**Interfaces — Produces:**
- `profiles.professional_status text null check (professional_status in ('freelance','employee'))`
- `profiles.terms_accepted_at timestamptz null`
- `public.create_profile_for_new_user()` remplacée, toujours `security definer`, `set search_path = ''`. Elle insère `(id, email, first_name, professional_status, terms_accepted_at)` :
  - `first_name` : `left(nullif(btrim(coalesce(meta->>'first_name', meta->>'given_name', split_part(coalesce(meta->>'full_name', meta->>'name', ''), ' ', 1))), ''), 100)` ;
  - `professional_status` : la valeur des métadonnées si elle vaut `freelance` ou `employee`, sinon `null` ;
  - `terms_accepted_at` : `now()` si `(meta->>'terms_accepted') = 'true'`, sinon `null`.

  `meta` désigne `new.raw_user_meta_data`. Utiliser `create or replace function`, sans toucher au trigger existant.
- `config.toml` :
  - `[auth] enable_signup = true`, `minimum_password_length = 8` ;
  - `[auth.email] enable_confirmations = true` ;
  - `[auth.rate_limit] email_sent = 30` ;
  - `additional_redirect_urls`, avec les valeurs existantes conservées, plus `"http://127.0.0.1:3000/auth/callback"`, `"http://localhost:3000/auth/callback"` et `"aled://auth/callback"` ;
  - `[auth.email.template.confirmation]`, sujet « Active ton compte Aled », `content_path = "./supabase/templates/confirmation.html"` ;
  - `[auth.email.template.recovery]`, sujet « Choisis un nouveau mot de passe Aled », `content_path = "./supabase/templates/recovery.html"` ;
  - `[auth.external.google]` et `[auth.external.linkedin_oidc]`, chacun avec `enabled = false`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` et `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` (équivalents `LINKEDIN_OIDC` pour LinkedIn), et `redirect_uri = ""`.
- Templates :
  - même gabarit que `supabase/templates/invite.html` ;
  - confirmation : lien vers `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, bouton « Activer mon compte » ;
  - récupération : lien vers `…&type=recovery`, bouton « Choisir un nouveau mot de passe ».

- [ ] **Step 1: Write the failing integration tests:**
  - `it('creates the profile with the first name, the professional status and the terms acceptance of a password sign-up')` : avec `auth.signUp` du client anon sur Supabase local, lire ensuite le profil avec le client service ;
  - `it.each([...])('derives the first name from OAuth metadata: %s')` : avec `auth.admin.createUser({ user_metadata })` pour `given_name`, `full_name`, `name`, rien et 300 caractères (Review Focus 4) ;
  - `it('ignores an unknown professional status')` ;
  - `it('answers a second sign-up with the same address without creating another user')` : pas d'erreur, et toujours une seule ligne dans `auth.users` pour cette adresse (Review Focus 1) ;
  - `it('sends the confirmation email in French')` : lire Mailpit (`http://127.0.0.1:54324/api/v1/messages`), puis vérifier le sujet et la présence de `/auth/confirm?token_hash=`.
- [ ] **Step 2: Run** — `npm run test:integration -- public-sign-up` → FAIL
- [ ] **Step 3: Implement**, puis `npx supabase stop && npx supabase start` pour recharger `config.toml`. Ensuite `npx supabase db reset && npm run db:types`.
- [ ] **Step 4: Run** — PASS, puis `npm run test:integration` en entier : les tests existants qui créent des utilisateurs doivent rester verts avec les confirmations activées. `create-test-user.ts` passe par l'admin avec `email_confirm` : vérifier. Puis `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): open sign-up with email confirmation and store the profile details from sign-up metadata"`

### Task 2: Domaine `sign-up`

**Files:** Create `src/domain/sign-up.ts`, `src/domain/sign-up.test.ts`

**Interfaces — Produces :** ce fichier n'importe que `@/domain/*`, car il sera copié sur le mobile.
- `PROFESSIONAL_STATUSES = ['freelance', 'employee'] as const` ; `type ProfessionalStatus` ; `PROFESSIONAL_STATUS_LABELS = { freelance: 'Freelance', employee: 'CDI' }` ; `isProfessionalStatus(candidate: unknown)`.
- `MINIMUM_PASSWORD_LENGTH = 8` ; `MAXIMUM_FIRST_NAME_LENGTH = 100` ; `RESEND_COOLDOWN_SECONDS = 60`.
- `OAUTH_PROVIDERS = ['google', 'linkedin_oidc'] as const` ; `type OAuthProvider` ; `OAUTH_PROVIDER_LABELS = { google: 'Continuer avec Google', linkedin_oidc: 'Continuer avec LinkedIn' }` ; `isOAuthProvider`.
- `type SignUpInput = { firstName: string; email: string; password: string; professionalStatus: ProfessionalStatus | null; hasAcceptedTerms: boolean }`.
- `findSignUpInputError(input: SignUpInput): string | null` : renvoie le premier message applicable, dans cet ordre :
  1. prénom vide → `'Saisis ton prénom.'` ;
  2. prénom trop long → `'Ton prénom est trop long.'` ;
  3. e-mail invalide → `INVALID_EMAIL_ADDRESS_MESSAGE` (existant) ;
  4. mot de passe de moins de 8 caractères → `'Ton mot de passe doit faire au moins 8 caractères.'` ;
  5. statut absent → `'Dis-nous si tu es freelance ou en CDI.'` ;
  6. case non cochée → `"Accepte les conditions d'utilisation et la politique de confidentialité pour continuer."`.
- `findNewPasswordError(password: string, confirmation: string): string | null` : longueur trop courte → message de longueur ci-dessus ; confirmations différentes → `'Les deux mots de passe ne correspondent pas.'`.
- `SIGN_UP_MESSAGES` (verbatim) :
  ```
  checkInbox: "Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte."
  resend: "Renvoyer l'e-mail"
  resendCooldown: 'Renvoyer dans {seconds} s'
  resent: 'E-mail renvoyé.'
  tooManyAttempts: 'Trop de tentatives, réessaie dans quelques minutes.'
  weakPassword: 'Ce mot de passe est trop facile à deviner.'
  failure: 'Inscription impossible pour le moment. Réessaie dans quelques minutes.'
  passwordResetSent: 'Si un compte existe pour cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe.'
  passwordUpdated: 'Mot de passe modifié.'
  passwordUpdateFailure: 'Impossible de modifier ton mot de passe pour le moment. Réessaie dans quelques minutes.'
  oauthFailure: "La connexion avec ce compte n'a pas abouti. Réessaie ou utilise ton e-mail."
  termsNotice: "En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité."
  ```
- `findSignUpErrorMessage(errorCode: string | undefined): string`. Correspondance :
  - `over_email_send_rate_limit` et `over_request_rate_limit` → `tooManyAttempts` ;
  - `weak_password` → `weakPassword` ;
  - `email_address_invalid` → `INVALID_EMAIL_ADDRESS_MESSAGE` ;
  - tout le reste, **y compris `user_already_exists` et `email_exists`**, → `failure`. L'action ne doit de toute façon pas montrer d'erreur pour ces deux codes (tâche 3).
- `formatResendCooldown(seconds: number): string`.

- [ ] **Steps:**
  - tests d'abord, un `it` par règle et par code ;
  - puis implémentation, `npm test -- sign-up`, `npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): add the sign-up domain rules and messages"`.

### Task 3: Actions serveur, routes d'authentification et proxy

**Files:**
- Modify: `src/server/actions/auth-actions.ts` (+ test) ;
- Modify: `src/app/auth/confirm/route.ts` (+ create `route.test.ts`) ;
- Create: `src/app/auth/callback/route.ts` (+ test) ;
- Modify: `src/proxy.ts` (+ test) ;
- Modify: `src/domain/landing-routing.ts` (+ test) ;
- Modify: `src/domain/routes.ts`, qui reçoit `SIGN_UP_ROUTE = '/inscription'`, `FORGOT_PASSWORD_ROUTE = '/mot-de-passe-oublie'` et `NEW_PASSWORD_ROUTE = '/mot-de-passe/nouveau'`, ou les réutilise depuis `landing-routing` si c'est le modèle en place.

**Interfaces — Produces** (toutes renvoient `ActionResult`) :
- `signUpWithPassword(input: SignUpInput): Promise<ActionResult<null>>` :
  - elle valide l'entrée (`findSignUpInputError`) ;
  - elle appelle `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${APP_ORIGIN}/auth/confirm, data: { first_name, professional_status, terms_accepted: true } } })` ;
  - succès, ainsi que `user_already_exists` et `email_exists` → `{ ok: true }` (Review Focus 1) ;
  - autres erreurs → `findSignUpErrorMessage`, avec un `console.error` (code et status) pour les inattendues.

  Lire `APP_ORIGIN` comme le fait le code existant (chercher `readAppOrigin`). Sinon, prendre l'origine de la requête via `headers()`.
- `resendSignUpConfirmation(email: string): Promise<ActionResult<null>>` : `auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`. Même règle de non-divulgation.
- `requestPasswordReset(email: string): Promise<ActionResult<null>>` :
  - `auth.resetPasswordForEmail(email, { redirectTo: ${APP_ORIGIN}/auth/confirm })` ;
  - renvoie toujours `{ ok: true }` si l'e-mail est valide, sauf limite de débit (`tooManyAttempts`).
- `updatePassword(password: string, confirmation: string): Promise<ActionResult<null>>` :
  - `findNewPasswordError`, puis `auth.updateUser({ password })` ;
  - `same_password` → `'Choisis un mot de passe différent de l\'actuel.'` (ajouter ce texte à `SIGN_UP_MESSAGES.samePassword` dans la tâche 2 s'il manque : petite extension acceptée) ;
  - `weak_password` → `weakPassword` ;
  - autres erreurs → `passwordUpdateFailure`.
- `startOAuthSignIn(provider: OAuthProvider): Promise<ActionResult<null>>` :
  - valide `isOAuthProvider` ;
  - appelle `auth.signInWithOAuth({ provider, options: { redirectTo: ${APP_ORIGIN}/auth/callback } })` ;
  - puis `redirect(data.url)`, qui lève, comme le fait Next. En cas d'erreur : `oauthFailure`.
- `/auth/confirm` :
  - types acceptés : `email`, `invite`, `signup`, `recovery` ;
  - `recovery` vérifié → redirection vers `NEW_PASSWORD_ROUTE` ;
  - les autres types → `HOME_ROUTE` ;
  - comportement d'erreur inchangé.
- `/auth/callback` (`GET`) :
  - présence de `error` ou absence de `code` → `/login?error=oauth` ;
  - sinon `exchangeCodeForSession(code)`. En cas d'erreur → `/login?error=oauth` avec un `console.warn` (code et status) ;
  - en cas de succès : `update profiles set terms_accepted_at = now() where id = user.id and terms_accepted_at is null`, via le client de session (RLS « own »), en ignorant une éventuelle erreur avec un `console.warn`. Puis redirection vers `HOME_ROUTE`.
- `proxy.ts` :
  - `PUBLIC_PATHNAMES` reçoit `/inscription`, `/mot-de-passe-oublie` et `/auth/callback` ;
  - un utilisateur **connecté** qui demande exactement `/login` ou `/inscription` est redirigé vers `/` (Review Focus 2 : jamais `/auth/*` ni `/mot-de-passe-oublie`).
- `landing-routing.ts` : `APP_PATH_PREFIXES` reçoit `/mot-de-passe-oublie`, `/mot-de-passe` et `/auth`, si ces chemins ne sont pas déjà couverts.
- `/login` : afficher `oauthFailure` quand `error=oauth`.

- [ ] **Steps :**
  - tests d'abord (client Supabase simulé, sur le modèle de `auth-actions.test.ts`) ;
  - cas couverts : chaque action (succès, adresse existante, débit, mot de passe faible, inattendu) ; `/auth/confirm` (`recovery` vers le nouveau mot de passe, `signup` et `email` vers l'accueil, type inconnu vers l'erreur) ; `/auth/callback` (sans code, `error=access_denied`, échec d'échange, succès avec le consentement mis à jour) ; `proxy` (nouveaux chemins publics ; connecté sur `/login` → `/` ; connecté sur `/auth/confirm` → pas de redirection) ;
  - puis implémentation ; `npm test && npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): add sign-up, password reset, password change and OAuth sign-in on the server"`.

### Task 4: Pages `/inscription` et connexion OAuth

**Files :**
- Create: `src/components/oauth-sign-in-buttons/`. Deux boutons pleine largeur `outline`, avec les libellés `OAUTH_PROVIDER_LABELS`. Chaque bouton appelle l'action `startOAuthSignIn` injectée et passe en attente. Un message d'erreur s'affiche si l'action renvoie `ok: false`. En dessous : `termsNotice`, avec les liens.
- Create: `src/components/sign-up-form/` (avec `controller.tsx`) :
  - champs prénom, e-mail, mot de passe (bouton « Afficher » / « Masquer »), un groupe radio « Je suis » (Freelance, CDI) et la case des conditions ;
  - les liens « conditions d'utilisation » et « politique de confidentialité » ouvrent un nouvel onglet ;
  - le bouton « Créer mon compte » ;
  - après le succès, l'écran `checkInbox` avec l'adresse et le bouton de renvoi, que le compte à rebours `RESEND_COOLDOWN_SECONDS` désactive ;
  - une garde contre le double envoi (Review Focus 5).
- Create: `src/app/inscription/page.tsx`. Même mise en page que `/login` : bandeau de marque à gauche, carte à droite avec le titre « Créer un compte ». Dans la carte : les boutons OAuth, le séparateur « ou », le formulaire, puis « Déjà un compte ? Se connecter ».
- Modify: `src/app/login/page.tsx` et `src/components/login-form/` : boutons OAuth et séparateur au-dessus du formulaire ; lien « Mot de passe oublié ? » sous le champ mot de passe ; « Pas encore de compte ? Créer un compte » en bas.
- Liens légaux : `${origine vitrine}/conditions-utilisation` et `/confidentialite`. Calculer l'origine de la vitrine comme le fait `buildLandingHref` (`src/app/vitrine/layout.tsx`) ou un utilitaire équivalent. En local, sans hôte vitrine configuré, se rabattre sur `/vitrine/...`.

- [ ] **Steps :**
  - tests d'abord :
    - contrôleur : validation, envoi unique, écran boîte mail, compte à rebours avec des minuteries factices ;
    - rendu : champs, radio, liens, boutons OAuth, liens entre `/login` et `/inscription` ;
  - puis implémentation ; `npm test && npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): add the sign-up page and Google and LinkedIn buttons"`.

### Task 5: Mot de passe oublié, nouveau mot de passe, préférences

**Files :**
- Create: `src/components/forgot-password-form/`, `src/app/mot-de-passe-oublie/page.tsx`. Champ e-mail et bouton « Recevoir un lien ». Après l'envoi, afficher `passwordResetSent`. Lien de retour « Retour à la connexion ».
- Create: `src/components/new-password-form/`, `src/app/mot-de-passe/nouveau/page.tsx` (session requise, donc non public). Champs « Nouveau mot de passe » et « Confirme-le », bouton « Enregistrer ». En cas de succès, `router.push('/?mot-de-passe=modifie')`.
- Modify: l'accueil (`src/app/(app)/page.tsx` et son composant) affiche le bandeau `passwordUpdated` quand `mot-de-passe=modifie` est présent, en `role="status"`.
- Modify: les préférences ajoutent une section « Mot de passe » avec un lien « Changer mon mot de passe » vers `/mot-de-passe/nouveau`. Trouver la page des préférences depuis `PREFERENCES_ROUTE`.

- [ ] **Steps :** tests d'abord pour chaque formulaire, le bandeau et le lien des préférences ; puis implémentation ; `npm test && npm run typecheck && npm run lint` ; commit `git commit -m "feat(auth): let users reset and change their password"`.

### Task 6: Statut professionnel et conditions d'utilisation

**Files :**
- Modify: `src/server/repositories/profile-repository.ts` pour lire et écrire `professional_status`, ainsi que le domaine `src/domain/profile-settings.ts` et l'action des préférences : un champ « Je suis » (Freelance, CDI) à côté du prénom.
- Create: `src/components/professional-status-card/`. Carte d'accueil « Tu es… » avec deux boutons, affichée seulement si le statut est `null`. Elle enregistre le choix via une action serveur `saveProfessionalStatus(status)` et disparaît.
- Modify: l'accueil, pour passer le statut et l'action.
- Create: la page vitrine `src/app/vitrine/conditions-utilisation/page.tsx` et `TERMS_OF_USE_DOCUMENT` dans `src/domain/legal-copy.ts`. Sections avec `LEGAL_PLACEHOLDER_MARKER` : objet, compte, IA et clé Claude, données, responsabilité, résiliation, droit applicable. Ajouter `TERMS_OF_USE_PATHNAME = '/conditions-utilisation'` dans `landing-routing.ts`, le lien dans le footer de la vitrine et le `sitemap`.

- [ ] **Steps :** tests d'abord (repository en intégration ou simulé selon l'existant, carte, préférences, page CGU, sitemap) ; puis implémentation ; `npm test && npm run typecheck && npm run lint && npm run test:integration -- profile` ; commit `git commit -m "feat(profile): ask whether the user is freelance or employee and add the terms of use page"`.

### Task 7: README — guide de mise en production

**Files :** Modify `README.md`.
- Réécrire « Créer un compte utilisateur » pour l'inscription publique, en gardant la création manuelle comme secours.
- Ajouter « Mettre en production les inscriptions » : les 6 étapes du §5 de la spec, clic par clic, avec les écrans Google Cloud (écran de consentement, identifiants OAuth « Application Web », URI de redirection `https://<ref>.supabase.co/auth/v1/callback`) et LinkedIn Developers (produit « Sign In with LinkedIn using OpenID Connect », onglet Auth, URL de redirection). Préciser où coller l'identifiant et le secret dans Supabase, et le rappel « Confirm email ».
- Ajouter l'activation locale des fournisseurs (variables d'environnement et `enabled = true`).
- Mettre à jour la section Mailpit et les templates.

- [ ] **Steps :** relire contre la spec ; `npm test` (aucun test README) ; commit `git commit -m "docs: explain how to open sign-up and configure Google and LinkedIn"`.
