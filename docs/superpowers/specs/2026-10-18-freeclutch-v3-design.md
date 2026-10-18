# Freeclutch V3 — Document de conception

Date : 2026-10-18
Statut : validé le 2026-10-18

Ce document complète les conceptions V1 (`2026-10-17-freeclutch-design.md`) et V2 (`2026-10-18-mes-opportunites-design.md`). Toutes leurs contraintes s'appliquent : stack, conventions de code du porteur, sécurité, fuseau Europe/Paris, tests. Les décisions marquées **[choix du rédacteur]** n'ont pas été demandées explicitement par le porteur du projet.

---

## 1. Intention

Avec la V1 et la V2 en production, le porteur veut maintenant :

- un outil plus agréable à parcourir : un menu clair, une page d'accueil qui résume la journée, une fiche candidature lisible ;
- une meilleure préparation d'entretien : un brief mis en forme et dans la bonne langue, avec des questions à poser.

Il signale aussi un bug : « J'ai postulé » ne reprend pas la stack de la mission.

La V3 se découpe en quatre lots indépendants, à livrer dans cet ordre.

## 2. Lot 1 — La stack sur « J'ai postulé »

**Constat** (porteur) : l'API Free-Work ne fournit pas de clé « stack » exploitable. Les technologies sont écrites dans la description de la mission, et le champ `skills` des opportunités arrive vide. La candidature créée par « J'ai postulé » n'a donc pas de stack.

**Solution** [choix du rédacteur, présentée au porteur] : au clic sur « J'ai postulé », extraire la stack de la description de la mission avec l'IA.
- On réutilise l'extraction de stack existante des fiches métier (`extractJobSpecStack`, en mode texte, avec Haiku et la clé Claude de l'utilisateur).
- Les compétences fournies par Free-Work, si un jour il y en a, sont fusionnées avec celles extraites, sans doublon.
- **Origine de la stack** : « annonce », puisqu'elle vient du texte de l'annonce.
- **Sans clé Claude, ou si l'IA échoue** : la candidature est créée quand même avec les compétences disponibles (souvent aucune). L'action n'échoue jamais pour cette raison. L'échec est journalisé avec `console.error`, sans contenu.
- **Délai** : l'extraction ajoute quelques secondes. Le bouton affiche un état « Création… » pendant l'opération.
- **Pas de rattrapage** des candidatures déjà créées. L'utilisateur peut ajouter une fiche métier ou éditer la stack.
- **Pas d'étape de validation** **[choix du rédacteur]** : la stack extraite est enregistrée directement, comme les autres champs que « J'ai postulé » reprend de l'annonce (titre, TJM, lieu…). Le clic sur « J'ai postulé » vaut validation, et la stack reste modifiable à tout moment avec le crayon du bloc « Stack » (lot 3). Le brouillon à valider des fiches métier n'est pas reproduit ici.

## 3. Lot 2 — Préparation d'entretien : brief et questions

### 3.1 Ce que voit l'utilisateur
Sur la fiche candidature, un seul bouton :
- **« Générer le brief »** tant qu'il manque une des deux parties (brief du client ou questions de la candidature) dans la langue choisie ;
- **« Brief généré · voir mon brief »** quand les deux existent. Si le client final est inconnu, les questions seules suffisent.

**[choix du rédacteur]** « Générer le brief » ne génère **que ce qui manque**. Par exemple, si un brief existe déjà pour ce client dans cette langue, on génère seulement les questions, avec le modèle léger et pour moins d'un centime. Seul « Régénérer » relance la recherche web.

Avant la génération, l'utilisateur choisit la **langue** : français ou anglais, français par défaut. **[choix du rédacteur]** La dernière langue utilisée pour cette candidature est présélectionnée.

Le bouton ouvre une **modale dédiée** qui affiche, dans l'ordre :
1. **le brief de l'entreprise**, en markdown mis en forme :
   - en tête, un encadré **« Chiffres clés »** (CA, effectifs, croissance, levées…) et un encadré **« Dates clés »** (création, rachats, annonces récentes…) ;
   - puis les sections existantes : enjeux, marché, actualités, contexte du groupe s'il y a un parent ;
2. **« Questions à poser en entretien »** : 8 à 10 questions propres à cette candidature, dans la langue choisie ;
3. en bas, un lien replié **« Voir les sources (N) »** qui déplie la liste des sources (demande du porteur : elles sont trop nombreuses pour être affichées d'emblée).

La modale propose aussi **« Régénérer »** (avec choix de la langue) et affiche la date de génération.

**Notes personnelles sur le client** (existantes depuis la V1) **[choix du rédacteur]** : elles restent, dans la modale, entre le brief et les questions, sous le titre « Mes notes sur l'entreprise », avec le même enregistrement automatique qu'aujourd'hui. L'export et la sauvegarde sont inchangés.

### 3.2 Ce qui est généré, et où c'est rangé
- **Le brief de l'entreprise reste rattaché au client final**, mais par langue : au plus un brief par client et par langue (`fr`, `en`). Les briefs français existants deviennent des briefs `fr`.
- **Les questions d'entretien sont rattachées à la candidature**, par langue. Elles sont construites à partir :
  - du titre de la mission, de la stack et de la fiche métier. Pour une fiche collée, on utilise son texte. Pour une fiche en PDF, on utilise seulement la stack validée **[choix du rédacteur]**, sans renvoyer le PDF au modèle ;
  - du client et de son brief dans la même langue ;
  - de l'intermédiaire.
- **Au clic sur « Générer le brief »** :
  1. si le brief du client existe déjà dans cette langue, il est réutilisé, sinon il est généré (Sonnet avec recherche web, comme aujourd'hui) ;
  2. les questions sont ensuite générées avec un modèle léger, sans recherche web **[choix du rédacteur]**, à partir du brief et des données de la candidature.
- **Client final inconnu** : pas de brief d'entreprise. Les questions sont générées quand même à partir de la mission, et la modale indique « Client inconnu, demande-le à l'intermédiaire ».
- **Régénérer** remplace le brief du client dans cette langue (ce qui le met à jour pour toutes ses candidatures) et les questions de cette candidature.

### 3.3 Abandonné
- **Les hypothèses sur la mission** : le porteur les a jugées peu utiles, elles sont abandonnées.

## 4. Lot 3 — Fiche candidature en lecture et suppression

### 4.1 Lecture par défaut
La fiche s'ouvre **en lecture**, avec les informations mises en forme et sans champs de saisie :
- **en haut** : titre, statut (frise), client final et intermédiaire, source, lien vers l'annonce, et le **prochain entretien** s'il y en a un ;
- **au milieu** : la stack mise en avant (étiquettes par catégorie), le bouton de brief (lot 2), la fiche métier, les infos mission (TJM, lieu, présentiel, démarrage, durée, notes), et le contact (nom, téléphone et e-mail cliquables) ;
- **en bas** : les entretiens et le journal des échanges, puis le bouton de suppression.

### 4.2 Modification
- **Un crayon par bloc**, qui passe ce bloc seul en modification avec « Enregistrer » et « Annuler ». Il y a quatre blocs **[choix du rédacteur]** :
  - **en-tête** : titre, source, lien de l'annonce, intermédiaire et son type, client final et son groupe parent, date de candidature ;
  - **infos mission** : TJM affiché et TJM demandé, lieu, présentiel, démarrage souhaité et effectif, durée, notes ;
  - **contact** ;
  - **stack**.

  Tous les champs modifiables aujourd'hui le restent.
- **Restent utilisables sans crayon** : le changement de statut et KO (en-tête), « Noter un échange », l'ajout ou la modification d'entretiens, le dépôt de la fiche métier.
- La resynchronisation après `router.refresh()` (V2) doit continuer à ne pas écraser une saisie en cours.

### 4.3 Suppression
- **Bouton rouge « Supprimer la candidature »**, tout en bas de la fiche.
- **Fenêtre de confirmation** : « Supprimer définitivement cette candidature ? Son journal, ses entretiens et sa fiche métier seront supprimés. » avec « Annuler » et « Supprimer ».
- **Ce qui est supprimé** :
  - la candidature ;
  - son journal, ses entretiens, ses reports d'alertes, sa fiche métier et ses questions d'entretien (par cascade) ;
  - **le fichier PDF de la fiche métier dans le stockage** (sinon il resterait orphelin).
- **Opportunité d'origine** **[choix du rédacteur, présenté au porteur]** : si la candidature venait de « Mes opportunités », la décision « postulée » est supprimée, et la mission revient dans « À traiter » si elle est encore dans la fenêtre de 7 jours.
- **Après la suppression** : retour à « Mes candidatures », avec le message « Candidature supprimée ».
- **Le brief du client n'est pas supprimé**, puisqu'il est partagé entre candidatures.

## 5. Lot 4 — Navigation, accueil et recherche

### 5.1 Menu
« Mes candidatures », « Mon calendrier », « Mes opportunités », « Préférences » (remplace « Réglages », demande du porteur), plus le compteur « À traiter » existant sur « Mes opportunités ».

### 5.2 Routes
- **`/`** devient la page d'accueil.
- **Le tableau des candidatures et son bandeau « À faire »** passent sur `/candidatures`.
- **`/settings`** devient `/preferences`, et `/settings/opportunites/free-work` devient `/preferences/opportunites/free-work`. **[choix du rédacteur]** Les anciennes adresses redirigent vers les nouvelles. Les liens internes sont mis à jour, y compris dans les messages d'erreur (« ajoute ta clé dans les réglages » devient « dans tes préférences »).

### 5.3 Page d'accueil
- **« Bonjour {prénom} »**, avec le prénom du profil ; « Bonjour » seul si le prénom est vide.
- **Rappels** : les alertes « À faire » existantes (relances, fiche métier manquante, client inconnu, entretiens à venir, sans nouvelles), au plus 5 avec un lien « Voir tout ».
- **Prochains rendez-vous** : les 3 prochains entretiens (client et blanc), avec leur date, leur heure et la mission.
- **Missions intéressantes** : au plus 2 missions de « À traiter », publiées depuis moins de 48 h, triées par TJM décroissant (TJM non communiqué en dernier) **[choix du rédacteur]**, affichées en cartes compactes avec « J'ai postulé » et « Voir sur Free-Work ».
- **Boutons** : « Voir mes candidatures », « Voir mon calendrier » et « Voir mes opportunités », chacun sous sa section.
- **États vides** :
  - aucun rappel : « Rien d'urgent aujourd'hui. » ;
  - aucun rendez-vous : « Aucun entretien prévu. » ;
  - aucune mission récente : « Pas de nouvelle mission intéressante depuis 48 h. »

### 5.4 Recherche dans « Mes opportunités »
- **Une barre de recherche** au-dessus des onglets.
- **Champs cherchés** : titre, entreprise et lieu, sans tenir compte de la casse ni des accents. Elle **s'ajoute** aux filtres Free-Work sans les remplacer.
- **Portée** : elle s'applique à l'onglet affiché, et les compteurs des onglets reflètent la recherche **[choix du rédacteur]**.
- **Côté serveur** : la recherche fait partie de la requête de liste, pour fonctionner avec la pagination par curseur. La saisie est différée d'environ 300 ms.

## 6. Contraintes
- Toutes celles des V1 et V2 :
  - aucun `any` ;
  - fonctions fléchées ;
  - exports nommés ;
  - dossiers de composants kebab-case avec `useController` ;
  - pas de `console.log` ni de commentaires ;
  - `server-only` ;
  - types partagés dans `src/domain` ;
  - isolation par utilisateur ;
  - la clé Claude ne quitte jamais le serveur.
- Les appels IA respectent le budget de temps existant (`maxDuration` de la fiche à 300 s, brief limité à 240 s).
- Les migrations de schéma sont additives et compatibles avec les données en production (les briefs existants deviennent `fr`).
- Chaque lot se livre et se déploie seul (migrations Supabase, puis Vercel).

## 7. Laissé au builder
- Le schéma exact des briefs par langue et des questions par candidature.
- Le prompt des questions d'entretien et le format exact des encadrés « Chiffres clés » et « Dates clés ».
- Le composant de modale.
- La mise en page exacte de la fiche en lecture et de l'accueil, dans l'esprit décrit.

## 8. Hors périmètre
- Les hypothèses sur la mission (abandonnées).
- D'autres langues que le français et l'anglais.
- La CI GitHub (sujet séparé, en attente).
- L'application mobile.
