# Aled — Contacts et agences — Document de conception

Date : 2026-10-22
Statut : brouillon, à valider

Projet 1 sur 3 d'un ensemble « mémoire des échanges » :
1. **Contacts et agences** (ce document) ;
2. bibliothèque de CV et « CV envoyé » sur la candidature (conçu ensuite) ;
3. « J'ai eu un call » sur mobile : saisie rapide, puis dictée et IA payante (conçu ensuite).

Ce document couvre l'app web (`Freeclutch` / `aled-web`) et l'app mobile (`aled-mobile`), qui partagent le même projet Supabase. Toutes les contraintes des documents précédents restent valables : conventions de code du porteur (CLAUDE.md : composants en dossier kebab-case, `useController`, pas de `any`, fonctions fléchées, exports nommés), identité Atelier, mode sombre, accessibilité, 360 px, tests. Les décisions marquées **[choix du rédacteur]** n'ont pas été demandées explicitement par le porteur, qui a délégué ces choix.

---

## 1. Intention

À presque chaque appel, un recruteur d'agence dit : « on s'était appelés il y a 6 mois, tu te rappelles ? ». Le porteur veut répondre « oui, bien sûr : en mars, pour Stime, sur du React ; c'est Thomas qui t'avait donné mon numéro ».

Aujourd'hui, c'est impossible :
- les infos d'un contact sont éparpillées dans les candidatures ;
- choisir un contact existant dans le formulaire de candidature ne remplit que son nom : on retape téléphone et e-mail à chaque fois ;
- un contact n'est jamais rattaché à son agence ;
- il n'existe aucune page pour voir ses contacts ou ses agences ;
- un appel qui n'aboutit pas à une candidature (typiquement : on est en mission et on refuse) ne laisse aucune trace. C'est pourtant ce qu'on regrette le plus le jour où les missions s'arrêtent.

**Objectifs** :
- une page **Contacts** triable et cherchable, où chaque contact existe même sans candidature ;
- une **fiche contact** : coordonnées, agence, « recommandé par », notes, missions proposées, historique des échanges ;
- une **fiche agence**, accessible en deux clics : d'abord tous les contacts de l'agence, puis tous les échanges avec eux et le nombre de missions qu'ils ont proposées (ordre demandé par le porteur) ;
- **noter un échange sans candidature** ;
- dans la candidature, **sélectionner un contact** (autocomplétion) ou **en créer un**, sans rien retaper ;
- sur mobile, **retrouver un contact en plein appel** : recherche par nom, agence ou numéro, et consultation des fiches.

**Hors périmètre** :
- CV (projet 2), saisie rapide d'un appel sur mobile et IA (projet 3) ;
- modification des contacts depuis le mobile : le mobile est en lecture seule dans ce projet **[choix du rédacteur]** ;
- fusion de doublons, import depuis le carnet du téléphone, export vCard ;
- plusieurs contacts sur une même candidature : une candidature garde un seul contact principal ;
- couche API entre le mobile et la base (dette connue, traitée à part).

**Anti-objectifs** :
- un deuxième journal d'échanges parallèle à celui des candidatures : il n'y a qu'**un seul journal** ;
- perdre ou casser des données existantes (contacts, journaux, liens des candidatures) ;
- écraser des coordonnées de contact sans action explicite de l'utilisateur ;
- un contact qui ne peut exister qu'à travers une candidature.

## 2. Vocabulaire

- **Contact** : une personne (table `contacts`).
- **Agence** : un intermédiaire (table `intermediaries`), quel que soit son type (agence, ESN, plateforme, direct, autre). L'interface dit « Agence » partout **[choix du rédacteur]**, et affiche le type à côté quand il est connu.
- **Échange** : une entrée du journal (table `activity_log_entries`) de type appel, message, e-mail ou autre. Les changements de statut (`status_change`) sont des entrées du journal, mais ne sont **pas** des échanges et n'apparaissent pas dans les historiques de contact ou d'agence.
- **Mission proposée** : une candidature. « Missions proposées par un contact » = candidatures dont il est le contact. « Missions proposées par une agence » = candidatures passées par cette agence. Une mission refusée se note comme une candidature au statut « KO après échange » ; aucun nouveau statut n'est ajouté **[choix du rédacteur]**.

## 3. Modèle de données

Une migration Supabase, additive. Les types (`database-types.ts`) sont régénérés et recopiés à l'identique dans le mobile.

### 3.1 `contacts`

- Ajouter `notes text` (null autorisé, 10 000 caractères maximum, même limite que les notes de candidature).
- Ajouter `referred_by text` (null autorisé, 200 caractères maximum). Champ libre « Recommandé par » : « Thomas (Agence X) », « LinkedIn », « Salon ». Pas de lien vers un autre contact, pour rester rapide à remplir **[choix du rédacteur]**.
- `intermediary_id` existe déjà mais n'est jamais écrit. Il devient l'**agence actuelle** du contact.

### 3.2 `activity_log_entries` : le journal unique

- `job_application_id` devient **nullable**.
- Ajouter `contact_id uuid` (nullable), avec une clé étrangère composite `(user_id, contact_id)` vers `contacts (user_id, id)`, sur le modèle des autres clés étrangères du schéma.
- Ajouter une contrainte : `job_application_id is not null or contact_id is not null`. Un échange est toujours rattaché à une candidature, à un contact, ou aux deux.
- Ajouter un index `(contact_id, occurred_at desc)`.
- Les politiques RLS existantes (« mes lignes uniquement ») ne changent pas. Les clés étrangères composites empêchent de rattacher un échange au contact d'un autre utilisateur.

Règles d'écriture **[choix du rédacteur]** :
- un échange noté **depuis une candidature** reçoit seulement `job_application_id`. Il n'est **pas** rattaché au contact au moment de l'écriture : la règle de lecture s'en charge. Ainsi, si on corrige le contact de la candidature, ses échanges suivent le nouveau contact au lieu de rester attachés à l'ancien ;
- un échange noté **depuis une fiche contact** reçoit `contact_id`, et `job_application_id` seulement si l'utilisateur choisit une candidature parmi celles du contact. Il reste attaché à ce contact même si la candidature change de contact plus tard : c'est bien avec lui que l'échange a eu lieu.

**Contact effectif** d'un échange : son `contact_id` s'il en a un, sinon le contact de sa candidature.

Règle de lecture, pour l'historique d'un contact C : les échanges dont le contact effectif est C. Les anciens échanges, notés avant cette migration, apparaissent ainsi sans reprise de données.

**Suppression d'une candidature** **[choix du rédacteur]** : aujourd'hui, ses échanges sont supprimés en cascade. Désormais, les échanges qui ont un `contact_id` survivent : ils perdent leur lien vers la candidature mais restent dans l'historique du contact. Les autres sont supprimés comme aujourd'hui. Le mécanisme est laissé au builder ; par exemple, un trigger `before delete` sur `job_applications` qui met `job_application_id` à null sur les échanges ayant un `contact_id`, avant la cascade. La confirmation de suppression d'une candidature le mentionne si de tels échanges existent.

### 3.3 Rattachement d'un contact à son agence

- À l'enregistrement d'une candidature (création ou modification) qui a une agence A et un contact C : si C n'a pas d'agence, il reçoit A. Si C a déjà une autre agence, on ne change rien : un recruteur peut avoir changé d'agence, et seule une action explicite sur sa fiche change son agence **[choix du rédacteur]**.
- **Reprise de l'existant** dans la migration : chaque contact sans agence reçoit l'agence de sa candidature la plus récente qui en a une. La restauration d'une sauvegarde applique la même règle aux contacts restaurés sans agence, pour qu'un ancien fichier donne des fiches complètes **[choix du rédacteur]**. Le mécanisme est laissé au builder, par exemple une fonction SQL utilisée par la migration et par le script.

### 3.4 Suppression d'un contact

Supprimer un contact doit être possible, par exemple pour un doublon :
- ses échanges **sans candidature** sont supprimés ;
- ses échanges **liés à une candidature** sont conservés, sans lien vers le contact ;
- les candidatures perdent leur contact (`on delete set null`, comme aujourd'hui).

L'opération doit être atomique. Le mécanisme est laissé au builder (fonction Postgres en `security invoker`, ou autre).

### 3.5 Export, sauvegarde, restauration

- L'export et la sauvegarde utilisent `select('*')` : les nouvelles colonnes y entrent d'elles-mêmes, et le type `UserDataSnapshot` suit les types régénérés. Seules les fixtures de test sont à mettre à jour.
- Le script de restauration ne vérifie pas les identifiants référencés. Les clés étrangères composites suffisent à empêcher un `contact_id` d'un autre utilisateur, et il accepte déjà les échanges sans candidature une fois la colonne nullable. Il gagne seulement la reprise d'agence décrite en §3.3.
- `formatVersion` reste à 1 : le changement est additif, et un ancien fichier reste restaurable.

## 4. Web

### 4.1 Navigation et routes

- Nouvel élément de navigation **« Mes contacts »**, entre « Mes candidatures » et « Mon calendrier ».
- Routes :
  - `/contacts` : liste, avec deux onglets « Contacts » et « Agences » (l'onglet actif est dans l'URL, par exemple `?vue=agences`) ;
  - `/contacts/[contactId]` : fiche contact ;
  - `/agences/[intermediaryId]` : fiche agence.
- Ajouter `/contacts` et `/agences` aux préfixes d'app de `src/domain/landing-routing.ts`. Sinon, sur le domaine de la landing, ces chemins seraient réécrits vers la vitrine au lieu d'être redirigés vers l'app.
- Un contact ou une agence d'un autre utilisateur, ou inexistant, affiche une page 404.

### 4.2 Page Contacts, onglet « Contacts »

Tableau, sur le modèle du tableau des candidatures existant :

| Colonne | Contenu | Tri |
|---|---|---|
| Nom | lien vers la fiche | oui |
| Agence | lien vers la fiche agence | oui |
| Téléphone | lien `tel:` | non |
| LinkedIn | icône lien, si renseigné | non |
| Dernier échange | date du dernier échange (voir la règle de lecture §3.2) ; « — » sinon | oui, **tri par défaut, le plus récent en premier** |
| Missions | nombre de missions proposées | oui |

- **Recherche** : un seul champ, qui cherche dans le nom, le nom de l'agence et le téléphone. La recherche par téléphone ignore espaces, points et tirets, et considère `+33 6…` et `06…` comme identiques (fonction de domaine pure, testée).
- **« Nouveau contact »** : crée un contact (nom obligatoire ; agence, téléphone, e-mail, LinkedIn facultatifs), puis ouvre sa fiche.
- **Volume** : on charge tous les contacts de l'utilisateur, puis on trie et filtre côté client. Ça reste confortable jusqu'à environ un millier de contacts **[choix du rédacteur]**.
- **Sur petit écran (360 px)** : défilement horizontal, comme le tableau des candidatures (`overflow-x-auto`), par cohérence. Sur téléphone, c'est l'app mobile qui sert à consulter les contacts **[choix du rédacteur]**.
- **État vide** : un texte qui explique que les contacts se créent ici ou depuis une candidature.

### 4.3 Page Contacts, onglet « Agences »

Tableau : Nom (lien vers la fiche), Type, Contacts (nombre), Missions (nombre), Dernier échange. Tri par défaut : dernier échange. Recherche par nom.

### 4.4 Fiche contact

De haut en bas :
1. **En-tête** : nom, agence (lien vers la fiche agence), puis les actions « Appeler » (`tel:`), « E-mail » (`mailto:`), « LinkedIn ». Une action n'apparaît que si l'information existe.
2. **Coordonnées**, modifiables : nom, agence (autocomplétion, avec création possible), téléphone, e-mail, LinkedIn, « Recommandé par », notes.
   - Renommer est autorisé. Si un autre contact porte déjà ce nom (même nom normalisé), l'enregistrement est refusé avec le message existant « Un autre contact porte déjà ce nom » (`saveContactDetails` le gère déjà).
   - Sur la fiche contact, vider un champ efface la valeur.
   - On réutilise les règles de validation existantes (e-mail, URL LinkedIn, longueurs).
3. **Missions proposées** : les candidatures dont il est le contact, la plus récente en premier. Pour chacune : date, intitulé, client final, statut, lien vers la candidature. Le projet 2 ajoutera ici le CV envoyé.
4. **Échanges** : l'historique selon la règle §3.2, le plus récent en premier. Pour chacun : date, type, résumé, et la candidature liée s'il y en a une (lien).
   - Formulaire **« Noter un échange »** : type (appel par défaut), date et heure (maintenant par défaut, modifiable), résumé (obligatoire), candidature (facultatif, à choisir parmi les candidatures du contact). Il réutilise la validation existante du journal (`ACTIVITY_LOG_VALIDATION_MESSAGES`).
   - Noter un échange lié à une candidature a les mêmes effets que depuis la candidature, notamment sur les rappels « À faire » (`findAlertKindsClearedByActivity`).
5. **Supprimer le contact** : en bas, avec une confirmation qui dit ce qui sera supprimé (§3.4).

### 4.5 Fiche agence

De haut en bas, dans l'ordre demandé par le porteur :
1. **En-tête** : nom, type (modifiable, en réutilisant `updateIntermediaryKind`), et un résumé « N contacts · N missions proposées · dernier échange le … ».
2. **Contacts de l'agence** : les contacts dont c'est l'agence actuelle. Pour chacun : nom (lien), téléphone, dernier échange. Plus un bouton « Ajouter un contact » qui crée un contact déjà rattaché à l'agence.
3. **Échanges** : tous les échanges avec cette agence, le plus récent en premier, avec le nom du contact concerné. Un échange appartient à l'agence si son contact effectif (§3.2) a cette agence pour agence actuelle, **ou** si sa candidature est passée par cette agence.
4. **Missions proposées** : les candidatures passées par l'agence (date, intitulé, client final, contact, statut, lien).

Renommer ou supprimer une agence est hors périmètre.

### 4.6 Contact dans le formulaire de candidature

S'applique au formulaire de création (`new-job-application-form`) et au bloc Contact de la fiche candidature (`contact-edit-form`).

- Les **suggestions** affichent le nom et l'agence du contact (« Jean-Marc · Hays »).
- **Choisir un contact existant** :
  - le lie par son **identifiant**, plus par son nom ;
  - pré-remplit ses téléphone, e-mail et LinkedIn.
- **Créer un contact** : la liste se termine par une option « Créer « {texte saisi} » » quand aucun contact ne porte exactement ce nom. Le contact est créé à l'enregistrement de la candidature, avec les coordonnées saisies, et reçoit l'agence de la candidature (§3.3).
- **Texte saisi sans rien choisir** : comportement actuel conservé. Si un contact porte ce nom normalisé, il est lié ; sinon, il est créé.
- **Ajouter le champ LinkedIn** au formulaire de création.

**Écriture des coordonnées d'un contact existant** **[choix du rédacteur]**. Il y a trois sources possibles pour chaque champ (téléphone, e-mail, LinkedIn), traitées dans cet ordre :
- **Formulaire de création de candidature** :
  - une valeur **saisie ou modifiée par l'utilisateur** remplace celle du contact ;
  - une valeur **pré-remplie par l'extraction IA** et non retouchée remplit seulement un champ vide du contact, comme `fillEmptyContactField` aujourd'hui ;
  - un champ vide n'efface jamais rien.

  Le formulaire doit donc savoir, champ par champ, si l'utilisateur a modifié la valeur ; le serveur reçoit cette information avec les valeurs.
- **Bloc Contact de la fiche candidature** (`contact-edit-form`) : c'est une modification explicite des coordonnées, donc il se comporte comme la fiche contact. Les valeurs remplacent celles du contact, et vider un champ efface la valeur, comme aujourd'hui.
- La copie mobile de `entities-repository.ts` (`fillEmptyContactField`, `resolveContactId`) est mise à jour ou supprimée pour rester alignée : le mobile n'écrit pas de contact dans ce projet.
- Le bloc Contact de la fiche candidature affiche un lien « Voir la fiche du contact ». Le renommage se fait sur la fiche contact.

## 5. Mobile

En lecture seule dans ce projet.

- **Onglets** : la barre a déjà 5 onglets, le maximum confortable sur iOS. « Réglages » quitte la barre pour devenir un bouton engrenage en haut de l'Accueil, et un onglet **« Contacts »** prend sa place **[choix du rédacteur]**. Ordre : Accueil, Candidatures, Contacts, Opportunités, Calendrier. L'Accueil n'a pas d'en-tête aujourd'hui (`headerShown: false`) : le bouton est à construire, dans l'écran ou via une pile de navigation propre à l'onglet. Aucun autre écran ne pointe vers `/reglages`.
- **Liste** : segment « Contacts » / « Agences », un champ de recherche (mêmes règles qu'en §4.2, y compris le téléphone), et un tri par dernier échange. Chaque ligne affiche le nom, l'agence et la date du dernier échange.
- **Fiche contact** : bouton « Appeler » bien visible en haut (c'est le geste principal), puis e-mail et LinkedIn, agence (lien), « Recommandé par », notes, missions proposées et échanges.
- **Fiche agence** : même ordre que sur le web (contacts, échanges, missions).
- **Fiche candidature** : la ligne « Contact » devient un lien vers la fiche contact.
- **Accès aux données** : le mobile continue de lire Supabase directement, avec des repositories copiés du web, comme aujourd'hui. Les fonctions de domaine partagées (normalisation du téléphone, tris, fusion des historiques) sont copiées à l'identique dans `src/domain` des deux dépôts, avec leurs tests.

## 6. Tests

Les tests font partie du livrable, dans les deux dépôts :
- **domaine** : normalisation du téléphone pour la recherche, filtrage et tri des contacts et des agences, fusion et dédoublonnage de l'historique d'un contact, appartenance d'un échange à une agence ;
- **repositories** : création et modification d'un contact, rattachement automatique à l'agence, échange sans candidature, suppression d'un contact (§3.4) ;
- **controllers** (`renderHook`) et **composants** (Testing Library) pour chaque nouvel écran et formulaire ;
- **intégration** (Supabase local) :
  - isolation : un utilisateur ne peut ni lire ni rattacher le contact d'un autre ;
  - la contrainte « candidature ou contact » ;
  - la suppression d'une candidature : les échanges rattachés à un contact survivent, les autres disparaissent ;
  - la reprise de l'agence dans la migration ;
  - export puis restauration d'un échange sans candidature.

## 7. Laissé au builder

- La disposition exacte des écrans, dans le respect de l'identité Atelier et du mode sombre.
- Le découpage en composants et en server actions.
- Le mécanisme atomique de suppression d'un contact.
- La stratégie de requêtes pour « dernier échange » et les compteurs : vue SQL, requêtes séparées, ou calcul côté serveur.
- L'ordre de livraison. Suggestion : migration et domaine, puis web, puis mobile.
