# Aled — « J'ai eu un call » (mobile) — Document de conception

Date : 2026-10-22
Statut : brouillon. Le porteur a demandé que les projets 2 et 3 soient conçus et réalisés sans questions pendant la nuit ; ses questions seront traitées à la relecture.

Projet 3 sur 3 de l'ensemble « mémoire des échanges ». Il s'appuie sur les projets 1 (contacts, agences, échanges sans candidature) et 2 (bibliothèque de CV). Mêmes contraintes que les documents précédents. Les décisions marquées **[choix du rédacteur]** n'ont pas été validées par le porteur.

---

## 1. Intention

Un freelance en mission reçoit des appels de recruteurs tout le temps. Il n'enregistre ni le numéro ni l'échange, « on prend la grosse tête », et le jour où la mission s'arrête, plus personne n'appelle et il regrette toutes ces conversations perdues.

Le porteur veut **un bouton « J'ai eu un call » sur l'app mobile**. Juste après avoir raccroché, il raconte l'appel en une phrase, au clavier ou à la voix : « Jean-Marc a appelé, il a positionné mon CV sur une nouvelle mission chez tel client à tel TJM ». L'IA en tire l'échange et, s'il y a une mission, une candidature. Il valide et c'est rangé : « je perds pas de temps ».

**Ce qui a été tranché en conversation** :
- **l'IA propose, l'utilisateur valide.** Rien n'est écrit sans confirmation ;
- **la dictée** utilise celle du clavier du téléphone, sans module de reconnaissance vocale en v1 ;
- **pas d'accès au journal d'appels** : impossible sur iPhone, et quasi impossible sur le Play Store. Le numéro se colle depuis le presse-papiers ;
- l'IA fera partie de l'offre payante plus tard. Aujourd'hui, comme le reste de l'app, elle utilise **la clé Claude de l'utilisateur** ;
- une **saisie manuelle rapide** reste disponible sans IA.

**Objectifs** :
- noter un appel en moins de 30 secondes, d'une main, juste après avoir raccroché ;
- retrouver ensuite l'échange sur la fiche du contact, et la candidature s'il y en a une ;
- ne jamais perdre ce que l'utilisateur a raconté, même en cas d'erreur réseau ou de fermeture de l'app.

**Hors périmètre** :
- reconnaissance vocale intégrée à l'app ;
- lecture du journal d'appels ;
- équivalent sur l'app web (piste) ;
- limitation de débit côté serveur : le coût repose sur la clé de l'utilisateur. À reprendre avec l'offre payante.

**Anti-objectifs** :
- une IA qui écrit en silence dans les données ;
- perdre le texte dicté ;
- écraser les coordonnées d'un contact existant avec une valeur devinée par l'IA ;
- un écran de confirmation si long que l'utilisateur abandonne.

## 2. Architecture

**Le mobile n'écrit pas ces données directement dans Supabase. Il passe par deux routes de l'app web** **[choix du rédacteur]** :
- l'IA a besoin de la clé chiffrée, qui ne doit jamais quitter le serveur ;
- la création du contact, de la candidature et de l'échange réutilise exactement le code du web (fusion des coordonnées, rattachement à l'agence, effets sur « À faire ») au lieu d'en dupliquer une copie ;
- c'est le premier pas de la couche API recommandée pour le mobile.

Routes :
- `POST /api/mobile/calls/draft` : l'IA analyse le texte et renvoie un **brouillon**. Rien n'est écrit.
- `POST /api/mobile/calls` : enregistre l'appel confirmé.

Authentification :
- l'en-tête `Authorization: Bearer <access token Supabase>` porte le jeton de la session mobile ;
- le serveur crée un client Supabase pour la requête avec cet en-tête, donc le RLS s'applique comme pour l'utilisateur, et lit l'utilisateur avec `auth.getClaims(token)` ;
- un jeton absent ou invalide donne 401 ;
- nouveau module serveur `src/server/supabase/create-bearer-supabase-client.ts`.

Autres points :
- les repositories existants prennent déjà un client en paramètre et sont réutilisés tels quels ;
- la clé Claude est lue avec ce client (`findEncryptedAnthropicApiKey`, puis `decryptApiKey`), sans passer par `getDecryptedAnthropicApiKeyForUser`, qui dépend des cookies ;
- le mobile appelle l'hôte de l'app (`EXPO_PUBLIC_WEB_APP_URL`, nouvelle variable, par exemple `https://app.aled.work`), jamais le domaine de la landing, qui redirige `/api` en 308 ;
- les routes `/api` échappent déjà au proxy ; CORS n'est pas nécessaire pour une app native.

## 3. Brouillon IA

### 3.1 Entrée

```
{ text: string, phone: string | null, contactId: string | null, occurredAt: string (ISO) }
```

- `text` : obligatoire, 3 000 caractères au maximum (`CALL_NOTE_MAX_LENGTH`) **[choix du rédacteur]**.
- `contactId` : rempli quand l'appel est noté depuis une fiche contact.
- `occurredAt` : par défaut, le moment où l'utilisateur a ouvert l'écran.

### 3.2 Extraction

On reprend la forme de `extract-job-posting.ts` : `CLAUDE_MODELS.extraction`, sortie structurée zod, `effort: 'low'`, le texte placé dans une balise et déclaré comme donnée et non comme instruction, refus géré.

On extrait uniquement ce qui est dit, et null sinon :
- `contactName`, `intermediaryName`, `contactPhone`, `contactEmail` ;
- `summary` : un résumé de l'échange en une ou deux phrases, en français, à la première personne de l'utilisateur ;
- `missionProposed` : booléen ;
- `missionTitle`, `endClientName`, `dailyRate` (nombre), `location`, `remotePolicy`, `desiredStart`, `duration`, `stack` (même schéma que l'extraction d'annonce) ;
- `outcome` : l'une de `cv_submitted` (« il a positionné mon CV »), `interview_scheduled` (un entretien est calé), `declined` (l'utilisateur ou le recruteur a dit non), `discussed` (on en a juste parlé) ;
- `cvLabel` : le CV mentionné, s'il y en a un (« mon CV DevOps »).

### 3.3 Rapprochements faits par le serveur, sans IA

- **Contact** : si `contactId` est fourni, c'est lui. Sinon, le serveur cherche parmi les contacts de l'utilisateur, avec `normalizeEntityName` et `normalizePhoneNumberForSearch` du projet 1, ceux qui correspondent au téléphone saisi ou extrait, puis au nom et à l'agence. Il renvoie au plus 3 candidats, le meilleur en premier, avec `{ id, fullName, intermediaryName, phone }`.
- **CV** : `cvLabel` est rapproché, par nom normalisé, des CV de la bibliothèque (projet 2). Le résultat est l'`id` du CV ou null.
- **Statut de la candidature** :
  - `cv_submitted` → « CV positionné » ;
  - `interview_scheduled` → « Entretien planifié » ;
  - `declined` → « KO après échange » ;
  - `discussed` → « Échange intermédiaire ».

### 3.4 Réponse

```
{
  contact: { candidates: [...], suggestedContactId: string | null, fullName, intermediaryName, phone, email },
  exchange: { summary, occurredAt },
  jobApplication: null | { title, endClientName, intermediaryName, postedDailyRate, location, remotePolicy, desiredStart, duration, stack, status, cvId }
}
```

`jobApplication` vaut null si aucune mission n'a été proposée.

### 3.5 Erreurs

Le format reprend celui des autres routes : `{ error: { kind, message } }` avec un statut HTTP adapté. Messages propres à cet écran :
- clé absente : « Ajoute ta clé Claude dans les préférences de l'app web pour utiliser l'IA. Tu peux aussi noter l'appel sans IA. »
- échec de l'IA : « L'IA n'a pas pu analyser l'appel. Ton texte est gardé : réessaie ou note-le sans IA. »
- les autres cas (clé invalide, débit, délai) reprennent `AI_ERROR_MESSAGES`, dans une formulation générique.

## 4. Enregistrement

### 4.1 Entrée

```
{
  contact: { id: string } | { new: ContactProfileInput },
  contactDetails: { phone, email, linkedinUrl },
  userEditedContactFields: ContactDetailFieldName[],
  exchange: { summary: string, occurredAt: string },
  jobApplication: null | { title, endClientName, intermediaryName, postedDailyRate, location, remotePolicy, desiredStart, duration, stack, status, cvId }
}
```

### 4.2 Effets, dans l'ordre

1. **Contact**. Un contact existant reçoit ses coordonnées selon la règle du projet 1 (`mergeContactDetailValues`) : une valeur modifiée par l'utilisateur remplace, une valeur venant de l'IA remplit seulement un champ vide. Un nouveau contact est créé avec les coordonnées, et rattaché à l'agence indiquée.
2. **Candidature**, si demandée. Elle est créée avec ce contact, l'agence, le client final, le statut, `source` = « Appel » **[choix du rédacteur]** et `applied_on` = la date de l'appel. Si un CV est choisi, sa version actuelle devient le CV envoyé (projet 2). Le contact reçoit l'agence s'il n'en a pas (règle du projet 1).
3. **Échange**. Il est de type `call`, avec le résumé et la date, rattaché au contact et à la candidature si elle a été créée. Les effets sur « À faire » sont ceux d'un échange noté sur la candidature.

### 4.3 Réponse et validations

- **Réponse** : `{ contactId, jobApplicationId | null }`.
- **Validations** : on réutilise `validateContactProfileInput`, `validateContactExchangeInput` et les validateurs de `JobApplicationInput`.
- **Échec partiel** : les écritures ne sont pas dans une transaction unique. Si une étape échoue après la création du contact, la réponse renvoie l'erreur avec ce qui a déjà été créé (`createdContactId`). Un nouvel envoi réutilise alors le contact existant au lieu d'en créer un doublon **[choix du rédacteur]**.

## 5. Écrans mobiles

### 5.1 Points d'entrée

- **Accueil** : un bouton principal « J'ai eu un call », pleine largeur, sous la phrase de résumé, juste au-dessus de « À faire ».
- **Fiche contact** (projet 1) : un bouton « Noter un appel » sous « Appeler ». Il ouvre le même écran, contact présélectionné.

### 5.2 Écran « Raconte l'appel »

Route modale `src/app/appel.tsx`, paramètre facultatif `contactId`.

- Le contact présélectionné s'affiche en tête, s'il y en a un.
- Un grand champ texte multiligne, focus automatique : « Raconte l'appel ». Exemple en placeholder : « Jean-Marc de Hays a positionné mon CV DevOps chez BNP, 650 €/jour, démarrage en janvier. » Une ligne d'aide rappelle le micro du clavier pour dicter.
- Un champ « Numéro (facultatif) », avec un bouton « Coller le numéro ». Il lit le presse-papiers (`expo-clipboard`, à installer avec `npx expo install`) **seulement au clic**, pour éviter l'avertissement de collage d'iOS à chaque ouverture. Si le contenu ressemble à un numéro, il remplit le champ ; sinon : « Le presse-papiers ne contient pas de numéro. »
- Deux actions :
  - **« Préparer avec l'IA »** (principale) : visible si l'utilisateur a une clé Claude, ce qu'on sait en lisant directement `profiles.anthropic_api_key_last_four` (RLS : son propre profil) ;
  - **« Noter sans IA »** (secondaire).
- Sans clé : à la place du bouton IA, « Ajoute ta clé Claude depuis l'app web pour que l'IA prépare tout. ». Seul « Noter sans IA » reste.
- **Brouillon local** : le texte et le numéro sont gardés dans le stockage local (`expo-sqlite/localStorage`, déjà utilisé par l'app) à chaque frappe. Ils sont effacés après un enregistrement réussi. En rouvrant l'écran, un brouillon non envoyé est restauré avec la mention « Brouillon non envoyé restauré ».

### 5.3 Écran « Vérifie avant d'enregistrer »

Même écran, deuxième étape **[choix du rédacteur : une seule route, deux étapes]**.

- **Contact** :
  - si le serveur suggère un contact : « C'est bien {Jean-Marc · Hays} ? », avec « Oui » (par défaut), les autres candidats, et « Un nouveau contact » ;
  - nouveau contact : nom (obligatoire), agence, téléphone, e-mail, pré-remplis par l'IA.

  Un champ modifié par l'utilisateur est marqué comme tel pour la règle de fusion.
- **Échange** : résumé (modifiable, obligatoire), date et heure.
- **Mission** : un interrupteur « Créer la candidature », activé si l'IA a détecté une mission. Il est suivi des champs principaux pré-remplis :
  - intitulé (obligatoire si l'interrupteur est activé) ;
  - client final, TJM ;
  - statut (une liste parmi les statuts du parcours, plus « KO après échange ») ;
  - CV envoyé (liste de la bibliothèque, pré-sélectionné si l'IA l'a reconnu).

  Les autres champs extraits (lieu, télétravail, démarrage, durée, stack) sont envoyés tels quels, sans être affichés, pour garder l'écran court **[choix du rédacteur]**.
- **« Enregistrer »**. En cas de succès, l'écran se ferme et ouvre la fiche du contact, où le nouvel échange apparaît. En cas d'erreur, le message s'affiche et rien de ce qui a été saisi n'est perdu.

### 5.4 Saisie manuelle (« Noter sans IA »)

Elle mène au même écran de vérification, avec :
- l'échange pré-rempli avec le texte brut comme résumé ;
- le contact présélectionné s'il y en a un. Sinon, une recherche dans les contacts (la liste chargée par l'onglet Contacts, avec la recherche par nom, agence ou téléphone du projet 1), ou « Un nouveau contact » ;
- l'interrupteur « Créer la candidature » désactivé par défaut.

## 6. Tests

- **Serveur** :
  - authentification par jeton (absent, invalide, valide) ;
  - validation des entrées ;
  - extraction avec le faux client Anthropic existant ;
  - rapprochements (contact par téléphone, par nom et agence, CV par nom) ;
  - correspondance `outcome` → statut ;
  - enregistrement complet en intégration : contact existant avec fusion des coordonnées, nouveau contact, avec ou sans candidature, CV envoyé, échange visible dans l'historique du contact ;
  - isolation : impossible de viser le contact d'un autre utilisateur.
- **Mobile** :
  - client API (en-tête, erreurs) ;
  - controller de l'écran (brouillon local, étapes, champs modifiés, saisie manuelle) ;
  - bouton « Coller le numéro » ;
  - points d'entrée depuis l'accueil et la fiche contact.

## 7. Laissé au builder

- Le découpage exact en modules serveur (route, service, prompt).
- L'ordre de score des candidats contact.
- La disposition des écrans, dans l'identité de l'app mobile.
- Le format exact des erreurs, dans le respect de §3.5.

## 8. Précisions apportées après relecture (choix du rédacteur)

1. **Ordre de réalisation** : ce projet se réalise après la partie mobile du projet 1 (fiches contact `/contacts/[contactId]`) et après le projet 2 (bibliothèque de CV). Le mobile liste les CV en lisant directement `cvs_overview` (RLS), comme les autres données.
2. **Écritures côté serveur** : un service `src/server/calls/record-call.ts` compose les repositories existants, qui prennent tous un client en paramètre :
   - la règle de fusion des coordonnées, aujourd'hui dans `resolveContactId` (`entities-repository.ts`), est extraite dans une fonction de repository réutilisable `applyContactDetails(supabase, userId, contactId, submittedDetails, userEditedFields)` ;
   - `insertJobApplication` sert à la candidature : elle accepte directement le statut voulu, y compris « KO après échange » ;
   - `recordContactExchange` sert à l'échange, et porte les effets sur « À faire ».

   Aucune server action n'est appelée depuis la route.
3. **`source` = « Appel »** : un texte libre, comme les autres sources. Il apparaît dans le filtre par source de la liste des candidatures, ce qui est voulu.
4. **Reprise après échec partiel** :
   - la réponse d'erreur renvoie `createdContactId` et `createdJobApplicationId` quand ils existent ;
   - au nouvel envoi, le client remplace le contact par `{ id: createdContactId }` et ajoute `existingJobApplicationId`. Le serveur ne recrée alors pas la candidature : il vérifie qu'elle appartient à l'utilisateur et qu'elle a ce contact, puis enregistre seulement l'échange.

   Pas de clé d'idempotence ni de migration.
5. **Navigation mobile** : `appel` est un écran de la pile racine (`src/app/_layout.tsx`), sous la garde de session, avec `presentation: 'modal'`. Après succès, on remplace l'écran par `/contacts/[contactId]`.
6. **Jeton** : la route n'exige que la revendication `sub`, pas l'e-mail.
7. **Rapprochement par téléphone** : seule l'égalité exacte des numéros normalisés suggère un contact, jamais un fragment. Le nom et l'agence passent ensuite par `normalizeEntityName` (égalité du nom, puis agence identique en départage).
