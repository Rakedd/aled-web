# Inscriptions publiques (mobile) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'app mobile (`/Users/rakedd/Personal_projects/aled-mobile`), on ajoute :
- l'inscription par e-mail ;
- la connexion par Google et LinkedIn ;
- « Mot de passe oublié » ;
- le changement de mot de passe ;
- le statut « Freelance / CDI » demandé sur l'accueil.

Ces fonctionnalités reprennent celles du web.

**Architecture :**
- Les règles et les textes viennent de `src/domain/sign-up.ts`, copié **à l'identique** du web. Le schéma vient de `src/lib/supabase/database-types.ts`, recopié du web.
- Le client Supabase passe en flux PKCE.
- Les fonctions d'authentification vivent dans `src/lib/auth/`.
- OAuth passe par `expo-web-browser` (`openAuthSessionAsync`) et la redirection `aled://auth/callback`.
- Nouveaux écrans :
  - inscription et mot de passe oublié, dans le groupe sans session ;
  - nouveau mot de passe, dans le groupe avec session.
- `auth/confirm` accepte la récupération.

**Tech Stack:** Expo 58, expo-router (Stack.Protected), React Native 0.88, `@supabase/supabase-js`, `expo-web-browser` (installé), `expo-linking` (installé), jest-expo et `@testing-library/react-native`.

**Spec:** `/Users/rakedd/Personal_projects/Freeclutch/docs/superpowers/specs/2026-10-23-aled-inscriptions-design.md`, en particulier le §4 et le §7.

**Prérequis :** le plan web `2026-10-23-aled-inscriptions-web.md` est exécuté. Il fournit les tâches 1 (migration et types), 2 (`src/domain/sign-up.ts`) et 6 (page `/conditions-utilisation`).

## Global Constraints

- CLAUDE.md du porteur :
  - fonctions fléchées, `export const` (les routes expo-router gardent leur `export default`) ;
  - jamais de `any`, aucun `console.log`, pas de commentaire, aucun import inutilisé ;
  - un dossier par composant ou écran, avec `<nom>.tsx`, `interfaces.ts`, `index.ts` et `controller.tsx` (`useController`).
- Ne jamais modifier `src/domain/*` ni `src/lib/supabase/database-types.ts` autrement qu'en les recopiant du web.
- Textes en français, au tutoiement, mot pour mot depuis `SIGN_UP_MESSAGES` et la spec.
- Les couleurs passent uniquement par le thème (clair et sombre). Cibles tactiles de 44 pt.
- Sécurité :
  - aucun message ne révèle qu'une adresse existe déjà ;
  - aucun mot de passe, jeton ni code dans les logs.
- Dépendances : ne rien installer, sauf `expo-crypto`, et seulement si le PKCE l'exige (`npx expo install expo-crypto`). Il faut alors le signaler, car un nouveau build de dev devient nécessaire.
- Style : guillemets simples, pas de point-virgule. Ne jamais lancer de formateur.
- Git :
  - committer sur la branche courante, sans créer ni changer de branche ;
  - **jamais de `git push`** ;
  - aucune ligne `Co-Authored-By` ni mention d'IA ;
  - `git add <chemins>`.
- Commandes : `npx jest <motif>`, `npm run typecheck`, `npm run lint`. PATH : `export PATH="/usr/local/bin:$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Review Focus

1. **L'utilisateur annule chez Google** (`openAuthSessionAsync` renvoie `cancel` ou `dismiss`) : rien ne s'affiche et l'écran reste utilisable. Testé dans la tâche 1.
2. **Le lien de récupération ouvert dans l'app Android :** `auth/confirm` ouvre la session, puis l'écran « Nouveau mot de passe ». L'utilisateur n'atterrit pas sur l'accueil, et le garde de session ne le renvoie pas vers la connexion. Testé dans la tâche 3.
3. **Le lien `aled://auth/callback`** reçu par le routeur n'aboutit jamais sur une page introuvable, et `rewriteIncomingPath` le laisse passer. Testé dans la tâche 3.
4. **Une adresse déjà inscrite** donne le même écran « Vérifie ta boîte mail ». Testé dans les tâches 1 et 2.
5. **Un double appui sur « Créer mon compte », « Continuer avec Google » ou « Renvoyer l'e-mail »** n'envoie qu'une requête. Testé dans la tâche 2.

---

### Task 1: Domaine recopié, client PKCE et fonctions d'authentification

**Files :**
- Copy (identique) depuis Freeclutch : `src/domain/sign-up.ts`, `src/domain/sign-up.test.ts` et `src/lib/supabase/database-types.ts` (depuis `src/server/supabase/database-types.ts`). Contrôler avec `diff`.
- Modify: `src/lib/supabase/supabase-client.ts` : ajouter `flowType: 'pkce'`.
- Create: `src/lib/auth/sign-up.ts`, `src/lib/auth/password-reset.ts`, `src/lib/auth/oauth-sign-in.ts`, avec leurs tests.

**Interfaces — Produces :**
- `signUpWithEmail(supabase, input: SignUpInput, webAppUrl: string): Promise<ActionResult<null>>`. Mêmes règles que l'action web (spec §3.1, plan web tâche 3) :
  - `emailRedirectTo: ${webAppUrl}/auth/confirm` ;
  - `data: { first_name, professional_status, terms_accepted: true }` ;
  - `user_already_exists` et `email_exists` donnent `ok: true` ;
  - les autres erreurs passent par `findSignUpErrorMessage`.
- `resendSignUpConfirmation(supabase, email, webAppUrl)` et `requestPasswordReset(supabase, email, webAppUrl)` : mêmes règles que sur le web.
- `updatePassword(supabase, password, confirmation)` : mêmes règles que sur le web, y compris `same_password`.
- `signInWithOAuthProvider(supabase, provider: OAuthProvider, openAuthSession = WebBrowser.openAuthSessionAsync): Promise<ActionResult<'signed_in' | 'cancelled'>>`, qui procède dans cet ordre :
  1. appeler `signInWithOAuth({ provider, options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true } })` ;
  2. appeler `openAuthSession(data.url, OAUTH_REDIRECT_URL)` ;
  3. un résultat différent de `success` donne `{ ok: true, data: 'cancelled' }` (Review Focus 1) ;
  4. lire `code` dans l'URL de retour. S'il est absent, ou si un paramètre `error` est présent, renvoyer `oauthFailure` ;
  5. appeler `exchangeCodeForSession(code)`. Une erreur donne `oauthFailure` ;
  6. compléter le profil : `update profiles set terms_accepted_at = now() where id = user.id and terms_accepted_at is null`, en ignorant une éventuelle erreur avec un `console.warn`. L'horodatage est calculé côté client en ISO ;
  7. renvoyer `{ ok: true, data: 'signed_in' }`.
- `OAUTH_REDIRECT_URL = 'aled://auth/callback'`.
- Si le PKCE échoue en test ou à l'exécution faute de `crypto.subtle` ou `getRandomValues` : installer `expo-crypto` avec `npx expo install expo-crypto`, ajouter le polyfill minimal documenté par Supabase et Expo, et le signaler dans le rapport.

- [ ] **Steps :**
  - écrire les tests d'abord, avec le client Supabase et `openAuthSession` simulés. Cas à couvrir :
    - succès ;
    - adresse existante ;
    - limite de débit ;
    - annulation ;
    - `error` dans l'URL ;
    - échec de l'échange ;
    - consentement mis à jour seulement s'il est vide ;
  - implémenter ;
  - lancer `npx jest && npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): add sign-up, password reset and OAuth sign-in helpers"`.

### Task 2: Écrans d'inscription et de mot de passe oublié, connexion enrichie

**Files :**
- Create: `src/screens/sign-up-screen/`, avec son controller. Il contient :
  - les champs prénom, e-mail et mot de passe (afficher / masquer) ;
  - « Je suis » avec Freelance et CDI (réutiliser `OptionList` ou `SelectField` s'ils conviennent) ;
  - la case des conditions, dont les liens ouvrent `https://aled.work/conditions-utilisation` et `https://aled.work/confidentialite` avec l'utilitaire `open-web-page` existant. Cette URL est une constante `LANDING_ORIGIN` dans `src/lib/legal/legal-links.ts` ;
  - les boutons OAuth ;
  - après le succès, l'écran `checkInbox` avec « Renvoyer l'e-mail » et un compte à rebours de 60 s ;
  - une garde contre les envois en double (Review Focus 5).
- Create: `src/screens/forgot-password-screen/`. Il contient un champ e-mail et le bouton « Recevoir un lien ». Après l'envoi, il affiche `passwordResetSent`.
- Create: les routes `src/app/inscription.tsx` et `src/app/mot-de-passe-oublie.tsx`, déclarées dans `Stack.Protected guard={session === null}` de `src/app/_layout.tsx`, à côté de `sign-in`.
- Create: `src/components/oauth-sign-in-buttons/`, partagé par la connexion et l'inscription. Il affiche les deux boutons pleine largeur, gère l'attente et l'erreur, et montre `termsNotice` en dessous. Une annulation n'affiche rien.
- Modify: `src/screens/sign-in-screen/` :
  - retirer « Accès sur invitation uniquement. » ;
  - mettre les boutons OAuth au-dessus du formulaire, avec un séparateur « ou » ;
  - sous le bouton, ajouter les liens « Mot de passe oublié ? » et « Pas encore de compte ? Créer un compte ».
- L'URL web vient du même parseur que `EXPO_PUBLIC_WEB_APP_URL` (`src/lib/api/web-app-environment.ts`).

- [ ] **Steps :**
  - écrire les tests d'abord :
    - controllers : validation, envoi unique, compte à rebours avec minuteries factices ;
    - rendus : champs, liens, boutons OAuth, liens entre les écrans ;
  - implémenter, puis lancer `npx jest && npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): add the sign-up and forgot password screens and the OAuth buttons"`.

### Task 3: Récupération, retour OAuth, nouveau mot de passe, statut

**Files :**
- Modify: `src/app/auth/confirm.tsx` et `src/lib/auth/email-link-sign-in.ts` : accepter `recovery`. Une fois le lien vérifié, faire `router.replace('/mot-de-passe/nouveau')` (Review Focus 2). Les autres types gardent leur comportement.
- Create: `src/app/auth/callback.tsx`, une route non gardée qui redirige vers `/` (Review Focus 3). Vérifier que `rewriteIncomingPath` (`src/lib/linking/rewrite-incoming-path.ts`) la laisse passer, et ajouter un test.
- Create: `src/screens/new-password-screen/` et la route `src/app/mot-de-passe/nouveau.tsx`, dans le groupe `session !== null`.
  - Champs « Nouveau mot de passe » et « Confirme-le », bouton « Enregistrer ».
  - En cas de succès : retour en arrière, ou vers l'accueil, avec le message `passwordUpdated`.
- Modify: `src/screens/settings-screen/` : ajouter une ligne « Mot de passe » qui ouvre `/mot-de-passe/nouveau`.
- Create: `src/components/professional-status-card/`. Sur l'accueil (`src/screens/home-screen/`), la carte « Tu es… » propose deux boutons, Freelance et CDI.
  - Elle s'affiche seulement si `professional_status` est `null`.
  - Le choix est enregistré par une mise à jour du profil (RLS « own »), via une fonction ajoutée à `src/data/repositories/profile-repository.ts`, après quoi la carte disparaît.
  - Le loader de l'accueil lit `professional_status`.

- [ ] **Steps :**
  - écrire les tests d'abord :
    - `auth/confirm` avec `recovery` ;
    - le callback ;
    - `rewriteIncomingPath` ;
    - l'écran du nouveau mot de passe ;
    - la ligne des réglages ;
    - la carte et le repository ;
  - implémenter, puis lancer `npx jest && npm run typecheck && npm run lint` ;
  - commit `git commit -m "feat(auth): handle password recovery links, the OAuth return and the professional status on mobile"`.
