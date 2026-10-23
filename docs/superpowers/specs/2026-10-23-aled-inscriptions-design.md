# Aled — Inscriptions publiques — Document de conception

Date : 2026-10-23
Statut : validé en conversation. Le porteur a répondu point par point aux questions (2026-10-23, 7 réponses) et a demandé d'avancer en autonomie. Les décisions marquées **[choix du rédacteur]** sont des choix du rédacteur, que le porteur n'a pas validés.

---

## 1. Intention

Jusqu'ici, les comptes sont créés à la main dans Supabase. Le porteur va lancer une communication marketing et veut que **n'importe qui puisse s'inscrire**, sur l'app web et sur l'app mobile. Les moyens d'inscription sont un e-mail avec mot de passe et confirmation par e-mail, Google et LinkedIn.

**Ce qui a été tranché en conversation :**
1. web **et** mobile ;
2. inscription **ouverte à tous**, sans code d'invitation ;
3. formulaire : **prénom, e-mail, mot de passe, « Je suis : Freelance / CDI »**, et une case d'acceptation des conditions d'utilisation et de la politique de confidentialité ;
4. e-mails : **Resend est déjà configuré** comme SMTP du projet Supabase hébergé ;
5. **« Mot de passe oublié »** et **changement de mot de passe** inclus ;
6. Google et LinkedIn : le porteur crée les applications OAuth lui-même, et on lui fournit un guide pas à pas ;
7. après l'inscription, l'utilisateur arrive sur l'accueil, avec ses états vides habituels et l'invitation existante à ajouter sa clé Claude.

**Objectifs :**
- s'inscrire en moins d'une minute, quel que soit le moyen ;
- ne jamais révéler si une adresse a déjà un compte (même message dans tous les cas) ;
- garder la connexion e-mail et mot de passe actuelle intacte pour les comptes existants.

**Hors périmètre :**
- captcha et anti-abus avancé (piste : Turnstile dans Supabase) ;
- suppression de compte en libre-service ;
- liaison manuelle de plusieurs fournisseurs sur un même compte. Supabase lie automatiquement les identités qui ont la même adresse vérifiée ;
- Apple Sign-In (piste, imposé par l'App Store seulement si l'app iOS est publiée avec Google) ;
- associated domains iOS (universal links).

**Anti-objectifs :**
- un formulaire long ;
- un message qui dit « cette adresse existe déjà » ;
- une inscription OAuth qui laisse un profil sans prénom alors que le fournisseur le donne.

## 2. Données

- **Profil :** nouvelle colonne `profiles.professional_status text null check (professional_status in ('freelance', 'employee'))`. Libellés : `freelance` → « Freelance », `employee` → « CDI ».
- **Trigger `create_profile_for_new_user` :** à la création d'un compte, il remplit aussi :
  - `first_name`, avec dans l'ordre de priorité `raw_user_meta_data->>'first_name'`, puis `given_name` (Google, LinkedIn), puis le premier mot de `full_name` ou de `name`. La valeur est rognée et limitée à la longueur que la validation actuelle autorise pour le prénom ;
  - `professional_status`, depuis `raw_user_meta_data->>'professional_status'` si la valeur est valide, sinon `null`.
- Le statut professionnel ne change rien au fonctionnement aujourd'hui. Il est enregistré pour plus tard (offre, statistiques) **[choix du rédacteur]**.
- **Statut manquant :** une inscription par Google ou LinkedIn n'a pas de statut. L'accueil affiche une petite carte « Tu es… » avec deux boutons, « Freelance » et « CDI ». Elle enregistre le choix et disparaît. Le statut est aussi modifiable dans les préférences, à côté du prénom **[choix du rédacteur]**.

## 3. Web

### 3.1 Inscription — `/inscription`

C'est une page publique. Le chemin est déjà réservé dans `landing-routing.ts` (`SIGN_UP_PATHNAME`).

**Champs :**
- Prénom (obligatoire) ;
- E-mail ;
- Mot de passe : **8 caractères minimum**, avec un bouton afficher / masquer ;
- « Je suis » : deux options, « Freelance » et « CDI », obligatoire ;
- case obligatoire : « J'accepte les conditions d'utilisation et la politique de confidentialité ». Les deux mots sont des liens vers les pages de la vitrine, ouvertes dans un nouvel onglet ;
- bouton « Créer mon compte ».

**Au-dessus du formulaire :** les boutons « Continuer avec Google » et « Continuer avec LinkedIn », puis le séparateur « ou ». Sous les boutons : « En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité. »

**Envoi :** `supabase.auth.signUp`, avec `emailRedirectTo` = `${APP_ORIGIN}/auth/confirm` et les données `first_name` et `professional_status`. Le résultat est toujours le même écran, que l'adresse soit nouvelle ou déjà prise : « Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte. », avec « Renvoyer l'e-mail » (`auth.resend` type `signup`, désactivé 60 s après chaque envoi).

**Erreurs affichées :**
- les validations de champ ;
- « Trop de tentatives, réessaie dans quelques minutes. » pour la limite de débit ;
- « Ce mot de passe est trop facile à deviner. » si Supabase refuse un mot de passe faible ;
- un message générique sinon.

**Liens :** « Déjà un compte ? Se connecter » sur `/inscription`, et « Pas encore de compte ? Créer un compte » sur `/login`.

### 3.2 Confirmation et retour OAuth

- `/auth/confirm` accepte les types `email`, `invite`, `signup` et `recovery`. Pour `recovery`, il redirige vers `/mot-de-passe/nouveau`. Pour les autres types, il redirige vers `/`.
- **Nouvelle route `/auth/callback`** : elle reçoit `code`, appelle `exchangeCodeForSession` (flux PKCE de `@supabase/ssr`) et redirige vers `/`. En cas d'erreur, ou si le fournisseur renvoie `error`, elle redirige vers `/login?error=oauth` avec le message « La connexion avec ce compte n'a pas abouti. Réessaie ou utilise ton e-mail. ».
- **OAuth :** une action serveur appelle `signInWithOAuth({ provider: 'google' | 'linkedin_oidc', options: { redirectTo: ${APP_ORIGIN}/auth/callback } })`, puis fait un `redirect` vers l'URL renvoyée. Les boutons sont les mêmes sur `/login` et `/inscription`.

### 3.3 Mot de passe

- **`/mot-de-passe-oublie`** (publique) :
  - un champ e-mail et le bouton « Recevoir un lien » ;
  - envoi par `resetPasswordForEmail(email, { redirectTo: ${APP_ORIGIN}/auth/confirm })` ;
  - toujours le même message : « Si un compte existe pour cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe. » ;
  - lien « Mot de passe oublié ? » sous le champ mot de passe de `/login`.
- **`/mot-de-passe/nouveau`** (session requise, ouverte par le lien de récupération) :
  - les champs « Nouveau mot de passe » et « Confirme-le » ;
  - envoi par `updateUser({ password })` ;
  - succès : redirection vers `/` avec le message « Mot de passe modifié. » **[choix du rédacteur : un bandeau temporaire sur l'accueil]**.
- **Préférences :** une section « Mot de passe », avec un bouton « Changer mon mot de passe » qui mène à `/mot-de-passe/nouveau`.

### 3.4 Routage

- `proxy.ts` : `PUBLIC_PATHNAMES` gagne `/inscription`, `/mot-de-passe-oublie` et `/auth/callback`.
- Un utilisateur connecté qui ouvre `/login` ou `/inscription` est redirigé vers `/` **[choix du rédacteur]**.
- Les chemins publics de l'app ajoutés à `APP_PATH_PREFIXES` redirigent du domaine vitrine vers l'app.
- La vitrine pointe déjà « S'inscrire » vers `/inscription`. À vérifier et brancher.

### 3.5 Conditions d'utilisation

Il n'existe pas de CGU. On crée la page vitrine `/conditions-utilisation` sur le modèle de `/confidentialite` (`legal-copy.ts`, `LEGAL_PLACEHOLDER_MARKER`). Ses sections à compléter par le porteur sont : objet, compte, usage de l'IA et clé Claude, données, responsabilité, résiliation, droit applicable. Elles sont marquées `[À COMPLÉTER …]`, comme les autres pages légales. Le footer de la vitrine y renvoie **[choix du rédacteur]**.

## 4. Mobile

- **Écran de connexion :**
  - la mention « Accès sur invitation uniquement. » disparaît ;
  - on ajoute « Continuer avec Google » et « Continuer avec LinkedIn » au-dessus du formulaire ;
  - sous le bouton : « Mot de passe oublié ? » et « Pas encore de compte ? Créer un compte ».
- **Écran d'inscription :**
  - les mêmes champs que sur le web. Les liens légaux ouvrent la vitrine dans le navigateur intégré. La vitrine est sur `https://aled.work`, une constante **[choix du rédacteur]** ;
  - même écran « Vérifie ta boîte mail » avec « Renvoyer l'e-mail » ;
  - `emailRedirectTo` = `${EXPO_PUBLIC_WEB_APP_URL}/auth/confirm`. Sur Android, ce lien ouvre l'app grâce aux App Links existants. Sur iOS, il ouvre le web, et l'utilisateur se connecte ensuite dans l'app.
- **Mot de passe oublié :** même écran qu'au web. Le lien de récupération reçu sur Android ouvre l'app : `auth/confirm` accepte `recovery`, puis ouvre l'écran « Nouveau mot de passe ». Sur iOS, il ouvre le web.
- **OAuth :**
  - le client Supabase passe en `flowType: 'pkce'` ;
  - `signInWithOAuth({ provider, options: { redirectTo: 'aled://auth/callback', skipBrowserRedirect: true } })` ;
  - puis `WebBrowser.openAuthSessionAsync(url, 'aled://auth/callback')` ;
  - si le résultat est un succès, on lit le paramètre `code` de l'URL et on appelle `exchangeCodeForSession` ;
  - une annulation par l'utilisateur n'affiche rien ;
  - une erreur affiche le message OAuth du §3.2 ;
  - si `crypto.subtle` manque pour le PKCE dans React Native, utiliser `expo-crypto` (installation par `npx expo install`, et nouveau build de dev à signaler).
- **Réglages :** l'écran gagne une ligne « Mot de passe » qui ouvre l'écran « Nouveau mot de passe ».
- **Statut manquant :** même carte sur l'accueil mobile qu'au web (§2).

## 5. Configuration

**Local (`supabase/config.toml`, commité) :**
- `[auth] enable_signup = true` ;
- `[auth.email] enable_confirmations = true` ;
- `minimum_password_length = 8` ;
- `[auth.rate_limit] email_sent` relevé pour les tests locaux ;
- templates `confirmation` et `recovery` en français (`supabase/templates/confirmation.html`, `recovery.html`), sur le modèle des existants, avec un lien vers `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (confirmation) ou `type=recovery` (récupération) ;
- `additional_redirect_urls` gagne `http://127.0.0.1:3000/auth/callback`, `http://localhost:3000/auth/callback` et `aled://auth/callback` ;
- blocs `[auth.external.google]` et `[auth.external.linkedin_oidc]` présents mais `enabled = false` en local, avec `client_id = "env(...)"` et `secret = "env(...)"` ;
- le README explique comment les activer.

**Hébergé (actions du porteur, guide pas à pas dans le README) :**
1. Authentication → Sign In / Providers : activer les inscriptions, « Confirm email », et le mot de passe à 8 caractères minimum.
2. URL Configuration : Site URL `https://app.aled.work` ; Redirect URLs `https://app.aled.work/auth/callback` et `aled://auth/callback`.
3. Email Templates : coller « Confirm signup » et « Reset password » depuis `supabase/templates/`.
4. Google :
   - Google Cloud Console → créer un projet, configurer l'écran de consentement, puis créer des identifiants OAuth « Application Web » ;
   - URI de redirection autorisée : `https://<ref>.supabase.co/auth/v1/callback` ;
   - coller l'identifiant et le secret dans Supabase → Google.
5. LinkedIn :
   - LinkedIn Developers → créer une app, puis ajouter le produit « Sign In with LinkedIn using OpenID Connect » ;
   - URL de redirection : la même `…/auth/v1/callback` ;
   - coller l'identifiant et le secret dans Supabase → LinkedIn (OIDC).
6. Rate limits : relever la limite d'e-mails par heure, puisque Resend est en place.

## 6. Tests

- **Domaine** (copié sur le mobile) :
  - validation de l'inscription (prénom, e-mail, 8 caractères minimum, statut, case cochée) ;
  - libellés de statut ;
  - correspondance des erreurs Supabase vers les messages (débit, mot de passe faible, adresse invalide, autres) ;
  - validation du nouveau mot de passe (longueur, confirmation identique).
- **Web :**
  - actions `signUp`, `requestPasswordReset`, `updatePassword`, `startOAuthSignIn` (client Supabase simulé) ;
  - `/auth/confirm` (types, redirection selon `recovery`) ;
  - `/auth/callback` (code, erreur) ;
  - `proxy` (nouvelles routes publiques, redirection des connectés) ;
  - formulaires (affichage, validation, écran « Vérifie ta boîte mail », minuterie de renvoi) ;
  - carte de statut sur l'accueil ;
  - page CGU.
- **Intégration (Supabase local) :**
  - inscription → e-mail reçu dans Mailpit → confirmation → profil créé avec prénom et statut ;
  - même e-mail une deuxième fois → même réponse, pas de second compte ;
  - trigger : métadonnées OAuth (`given_name`, `full_name`) → prénom.
- **Mobile :**
  - écrans d'inscription, de mot de passe oublié et de nouveau mot de passe ;
  - flux OAuth avec `WebBrowser` et le client simulés (succès, annulation, erreur) ;
  - `auth/confirm` avec `recovery`.

## 7. Précisions après relecture

- **Comptes existants :** il n'y a qu'un compte, celui du porteur. Il est confirmé et a un mot de passe. Aucune reprise de données n'est nécessaire.
- **Liens des e-mails :** les templates construisent leurs liens avec `{{ .SiteURL }}/auth/confirm?token_hash=…`. `emailRedirectTo` est transmis mais ne détermine pas la cible du lien. La Site URL hébergée doit valoir `https://app.aled.work` : à vérifier par le porteur, et c'est déjà la cible des templates invite et lien magique.
- **Variables :** `APP_ORIGIN` existe côté web (`.env.example`) et `EXPO_PUBLIC_WEB_APP_URL` côté mobile (ajoutée avec « J'ai eu un call »). Aucune nouvelle variable n'est nécessaire.
- **Récupération dans l'app Android :**
  - `auth/confirm`, qui n'est pas gardée, vérifie le lien. Une fois la session ouverte, elle remplace l'écran par « Nouveau mot de passe », qui se trouve dans le groupe protégé.
  - Une route `auth/callback`, elle aussi non gardée, existe pour que le lien `aled://auth/callback` ne tombe jamais sur une page introuvable. Elle redirige simplement vers l'accueil, car c'est `openAuthSessionAsync` qui traite le code.
  - `rewriteIncomingPath` doit laisser passer `auth/callback`.
- **Trace du consentement [choix du rédacteur] :** nouvelle colonne `profiles.terms_accepted_at timestamptz null`.
  - Le trigger la remplit avec `now()` quand les métadonnées d'inscription contiennent `terms_accepted: true`. Le formulaire e-mail l'envoie.
  - Pour une inscription Google ou LinkedIn, `/auth/callback` (web) et l'échange du code (mobile) la remplissent si elle est encore vide : l'utilisateur a cliqué « Continuer » sous la mention d'acceptation.
- **Prénom dans le trigger :** limité à `MAXIMUM_NAME_LENGTH` de `src/domain/profile-settings.ts`, avec la même valeur recopiée dans le SQL.
- **Redirection des connectés :** elle ne s'applique qu'à `/login` et `/inscription`, jamais à `/auth/confirm`, `/auth/callback` ni `/mot-de-passe-oublie`.

## 8. Laissé au constructeur

- Les noms des composants, des actions et des fichiers, selon les conventions de chaque dépôt.
- La mise en page exacte des formulaires, sur le modèle de `/login` (web) et de l'écran de connexion (mobile), en mode clair et sombre.
