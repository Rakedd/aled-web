# Aled — Brief technique (préparation d'entretien) — Document de conception

Date : 2026-10-23
Statut : brouillon, en relecture par le porteur.

Ce document étend la préparation d'entretien existante (brief client et questions à poser) sur l'app web. Il s'appuie sur la bibliothèque de CV (projet 2) : le CV envoyé est rattaché à la candidature. Les contraintes de code sont celles du dépôt. Les décisions marquées **[choix du rédacteur]** n'ont pas été validées par le porteur.

---

## 1. Intention

En entretien freelance, le déroulé est toujours le même. Le client présente la boîte et le projet, puis dit « À toi, présente-toi ». Le porteur raconte alors son histoire :

1. qui il est : prénom, Epitech, depuis combien de temps il est freelance ;
2. une mission ancienne, choisie parce qu'elle l'a mené à la suite ;
3. ses missions récentes ;
4. ce qu'il cherche maintenant : c'est leur mission décrite en creux (leur stack, leur défi), sans dire « votre mission » ;
5. ce qui lui a plu chez eux, et où il pense apporter de l'aide.

Ensuite viennent les questions techniques. **Plus il y en a, plus le discours était flou.** Le meilleur entretien, c'est quand le client dit « parfait » et enchaîne sur « tu peux commencer quand ? ».

Le porteur veut, sous le brief client, un **brief technique**. L'IA croise **le CV envoyé pour cette candidature** et **la stack de la mission** pour lui dire :
- quelles missions de son CV correspondent à leur stack, et sur lesquelles appuyer ;
- comment ordonner son récit, de la mission ancienne jusqu'à eux ;
- pour chaque mission qui compte, **des questions pour construire lui-même son récit** (« Quel challenge as-tu relevé ? », « Peux-tu décrire un incident ? », « De quoi es-tu fier ? ») ;
- ce que leur stack demande et que son CV ne montre pas, c'est-à-dire là où les questions techniques vont tomber.

**Ce qui a été tranché en conversation :**
- **l'IA ne rédige pas le pitch.** Elle donne le squelette, les missions à mettre en avant et des questions de réflexion. Le porteur écrit et dit son récit lui-même ;
- **pas de CV envoyé, pas de brief technique** ;
- le CV doit contenir **au moins la stack de chaque mission**. Sinon : « Le CV manque d'informations », avec un mot rassurant et un bouton « Améliorer mon CV » qui renvoie vers la page Mes CV ;
- **la page Mes CV ne change pas** dans ce projet. Un bouton « Améliorer mon CV » (points forts et faibles par l'IA) y viendra plus tard ; ce n'est pas ce projet ;
- la maquette validée est décrite au §4.

**Objectifs :**
- avant un entretien, savoir en deux minutes de lecture quelles missions raconter, dans quel ordre, et quoi préparer ;
- des conseils tirés **de son CV à lui** et de **leur stack à eux**, jamais génériques.

**Hors périmètre :**
- un pitch rédigé prêt à lire ;
- un mode interactif où l'IA pose les questions et réécrit le pitch avec les réponses (piste) ;
- « Améliorer mon CV » et toute modification de la page Mes CV ;
- l'app mobile (piste) ;
- les crédits IA et la limitation de débit (le coût repose sur la clé Claude de l'utilisateur, comme le reste).

**Anti-objectifs :**
- inventer une mission, une techno ou un chiffre absent du CV ;
- des conseils d'entretien génériques, valables pour n'importe qui ;
- un brief si long qu'on ne le relit pas avant l'entretien.

## 2. Données d'entrée

Pour une candidature donnée :

| Donnée | Source | Obligatoire |
| --- | --- | --- |
| CV envoyé (PDF) | `job_applications.sent_cv_version_id` → `cv_versions.storage_path`, bucket privé `cvs` | **oui** |
| Stack de la mission | `job_applications.stack` (stack confirmée) | non, mais voir la règle ci-dessous |
| Fiche de poste | `job_specs` : `raw_text` si texte, le PDF si PDF | non |
| Intitulé, client final, intermédiaire | vue `job_applications_overview` | non |
| Brief client dans la langue choisie | `end_client_briefs` | non : utilisé s'il existe, pour « ce qui t'a plu chez eux » |

**Règle sur la mission [choix du rédacteur] :** il faut la stack confirmée **ou** une fiche de poste. Sans aucune des deux, l'IA ne peut pas comparer. On affiche alors « Ajoute la fiche de poste ou la stack de la mission pour préparer ton pitch. », sans appel à l'IA.

Le CV est envoyé à Claude comme un **bloc document PDF en base64**, comme le fait déjà l'extraction de la stack d'une fiche de poste (`extract-job-spec-stack.ts`). Une fiche de poste en PDF est envoyée de la même façon. Une candidature n'a qu'une fiche de poste, en texte ou en PDF.

Une nouvelle fonction du dépôt des CV lit la version **en filtrant sur l'utilisateur** et renvoie le PDF en base64. Si la version ou le fichier est introuvable, elle renvoie une erreur explicite, que le bloc affiche comme « Pas de CV envoyé ». Le module de sauvegarde garde sa propre fonction et son comportement tolérant **[choix du rédacteur]**.

Toutes les entrées sont **des données, pas des instructions**. Elles sont passées dans des balises, comme pour les questions d'entretien.

## 3. Génération

- **Modèle :** `CLAUDE_MODELS.brief` (Sonnet) **[choix du rédacteur]**. Le travail demande du raisonnement, croiser chaque mission du CV avec une stack, plus que de l'extraction. Pas de recherche web.
- **Sortie structurée** (`zodOutputFormat`), dans la langue choisie (`BRIEF_LANGUAGES` : fr, en). Le schéma (§3.1) borne les longueurs pour que le brief reste lisible en deux minutes.
- **Déclenchement :** un bouton dédié dans le bloc. Le brief technique n'est **pas** généré automatiquement avec le brief client **[choix du rédacteur]** : c'est un appel plus coûteux, qui demande un CV, et qu'on relance quand le CV envoyé change.
- **Une action serveur à part [choix du rédacteur]**, distincte de `generateInterviewPreparation`, avec sa propre requête et donc son propre budget de temps sous le `maxDuration = 300` de la page. Elle ne touche ni au brief client ni aux questions.
- **Durées :** 120 s par requête et 1 nouvel essai, soit 240 s au pire, sous les 300 s de la page. Libellé pendant la génération : « Préparation de ton pitch… (jusqu'à 2 min) ».
- **Langue :** le bloc suit la langue affichée dans la fenêtre, avec le même sélecteur. Chaque langue a son propre brief technique. Si on passe à une langue jamais générée, le bloc affiche l'état « Prêt, jamais généré » pour cette langue, comme les questions **[choix du rédacteur]**.
- **CV illisible [choix du rédacteur] :** un PDF scanné sans texte, ou refusé par l'API, est signalé par `cvStatus: 'unreadable'`, ou par l'erreur de l'API sur le document. Message : « Impossible de lire ce CV. Dépose une version PDF exportée depuis ton éditeur, pas un scan. », avec le bouton « Améliorer mon CV ».
- **Refus, clé invalide, débit, délai :** les messages existants (`AI_ERROR_MESSAGES` et le même schéma que `INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES`), formulés pour ce bloc.

### 3.1 Résultat attendu

```
cvStatus: 'usable' | 'missing_mission_stacks' | 'unreadable'
```

Si `cvStatus` vaut `missing_mission_stacks`, c'est-à-dire qu'**au moins une mission du CV n'a aucune techno identifiable, même ancienne ou secondaire** (règle stricte, confirmée par le porteur), le reste est vide et on affiche l'état « CV incomplet » (§4.2). Rien n'est enregistré dans ce cas **[choix du rédacteur]**.

Si `cvStatus` vaut `usable` :

- **`storyline`**, le fil rouge, avec 5 étapes dans l'ordre du §1. Chaque étape a un titre court et une ligne d'indication. Les étapes 2 et 3 citent la ou les missions du CV à utiliser. L'étape 4 donne les thèmes à évoquer en creux (leur type de produit, leur défi, leur stack). L'étape 5 s'appuie sur le brief client s'il existe, sinon sur la fiche de poste.
- **`missions`**, de 1 à 6 entrées, triées par importance. Chaque entrée contient :
  - `label` : l'entreprise ou le projet, tel qu'écrit dans le CV ;
  - `period` : texte libre, tel qu'écrit dans le CV, ou vide ;
  - `emphasis` : `lean_on` (« Appuie fort »), `intro` (« Pour l'intro ») ou `skim` (« Passe vite ») ;
  - `sharedStack` : les technos communes avec la mission, prises dans le CV ;
  - `why` : une phrase ;
  - `reflectionQuestions` : de 2 à 4 questions pour `lean_on`, de 1 à 2 pour `intro`, aucune pour `skim`.
- **`gaps`**, de 0 à 5 entrées : `{ stackItem, question }`. Une techno de leur stack absente du CV, et la question à se poser pour préparer sa réponse.

Le prompt interdit d'inventer : une mission, une techno ou une période doit venir du CV. Les questions de réflexion portent sur **cette** mission. Le schéma est validé côté serveur, avec des bornes de longueur par champ, avant d'être enregistré.

## 4. Interface (web)

Le bloc s'ajoute dans la fenêtre « Préparer l'entretien », **sous le brief client et les questions à poser**. Il a le même cadre visuel que les autres blocs et utilise le même sélecteur de langue que la régénération du brief.

### 4.1 Brief généré (maquette validée)

- **En-tête :** « Brief technique », avec en dessous « Basé sur : {libellé du CV} · version du {date} (le CV envoyé) », et un bouton « Régénérer ».
- **1 · Ton fil rouge :** une liste numérotée des 5 étapes. Les missions citées sont en gras.
- **2 · Missions sur lesquelles appuyer :** une carte par mission `lean_on` ou `intro`, avec :
  - le libellé et la période ;
  - une étiquette « Appuie fort » (pêche) ou « Pour l'intro » (neutre) ;
  - « En commun avec leur stack : » et les technos en badges ;
  - « Pourquoi : … » ;
  - « Pour préparer ton récit : » et la liste des questions.

  Les missions `skim` tiennent en une ligne : « Passe vite sur : X (raison courte). »
- **3 · Points à préparer :** « Leur stack contient des choses que ton CV ne montre pas. C'est là que tomberont les questions : », puis une ligne par écart.
- **Si le CV envoyé a changé** depuis la génération, c'est-à-dire que `cv_version_id` est différent du CV envoyé actuel ou vaut null, on affiche « Ton CV envoyé a changé depuis ce brief. », avec « Régénérer » mis en avant **[choix du rédacteur]**. Seul le CV compte pour cette mention : une stack ou une fiche de poste modifiée ne la déclenche pas, l'utilisateur régénère s'il le souhaite.
- **Priorité des états [choix du rédacteur] :** un brief enregistré est toujours affiché, même si la candidature n'a plus de CV envoyé. Dans ce cas, la mention « CV changé » s'affiche, et « Régénérer » est remplacé par « Choisir le CV envoyé ».
- **Libellé du CV :** le libellé et la date de la version sont **enregistrés avec le brief** au moment de la génération. L'en-tête reste donc juste même si le CV est supprimé ensuite.

### 4.2 États sans brief

| État | Affichage |
| --- | --- |
| Pas de clé Claude | même traitement que le brief client : pas de bouton de génération, renvoi vers les préférences |
| Pas de CV envoyé | « Rattache le CV que tu as envoyé à cette candidature pour préparer ton pitch. » et un bouton « Choisir le CV envoyé », qui mène au champ « CV envoyé » de la fiche candidature |
| Ni stack ni fiche de poste | « Ajoute la fiche de poste ou la stack de la mission pour préparer ton pitch. » |
| Prêt, jamais généré | une ligne d'explication et le bouton « Préparer mon pitch » |
| CV incomplet (`missing_mission_stacks`) | **« Le CV manque d'informations. »** Il faut au moins la stack de chaque mission pour savoir sur lesquelles appuyer. **« T'inquiète, on va le retaper ensemble. »** Bouton **« Améliorer mon CV »** vers `/cv` (texte validé par le porteur) |
| Génération en cours | les boutons sont désactivés et affichent « Préparation de ton pitch… (jusqu'à 2 min) » |
| Erreur | le message sous le bloc ; le brief précédent, s'il existe, reste affiché |

## 5. Stockage

Nouvelle table **`technical_briefs`**, sur le modèle de `interview_questions` :
- `id`, `user_id`, `job_application_id` ;
- `language` (`fr` | `en`) ;
- `cv_version_id`, la version du CV utilisée ;
- `cv_label` et `cv_uploaded_at`, copiés de cette version au moment de la génération ;
- `content` (jsonb, le résultat validé du §3.1) ;
- `generated_at`.

Règles :
- unicité sur `(user_id, job_application_id, language)` ;
- clés étrangères composites avec `user_id` vers `job_applications` et `cv_versions`, comme le reste du schéma ;
- suppression en cascade avec la candidature ;
- si la version du CV est supprimée, `cv_version_id` passe à null (`on delete set null (cv_version_id)`) et le brief reste lisible, avec la mention « CV changé » ;
- politiques RLS « own » ;
- l'écriture se fait par upsert lors d'une régénération.

Le brief est lié à **la candidature**, pas au client final comme le brief client : il dépend du CV envoyé et de la stack de cette mission.

L'export des données (`build-user-data-snapshot`) et la restauration (`scripts/restore-user-data-snapshot.ts`) incluent la nouvelle table, comme `interview_questions`. Les versions de CV sont restaurées avec leur PDF, donc `cv_version_id` reste valide.

## 6. Tests

- **Domaine :**
  - validation du résultat (bornes, `emphasis`, questions par niveau) ;
  - choix de l'état affiché (pas de CV, pas de stack ni fiche, CV changé, CV incomplet) ;
  - libellés.
- **IA :** avec le faux client Anthropic existant :
  - le CV et la fiche de poste PDF partent bien en blocs document ;
  - la stack, le brief et la langue partent dans le prompt ;
  - refus, délai et sortie invalide ;
  - `missing_mission_stacks` ne produit rien d'autre.
- **Intégration (Supabase local) :**
  - génération et enregistrement, puis upsert à la régénération ;
  - isolation : impossible de viser la candidature ou le CV d'un autre utilisateur ;
  - suppression de la version de CV → `cv_version_id` à null ;
  - export et restauration des données.
- **Composants :** chaque état du §4.2, l'affichage du brief (fil rouge, cartes, « Passe vite sur », points à préparer) et le bouton « Améliorer mon CV » vers `/cv`.

## 7. Laissé au constructeur

- Les noms exacts des fonctions, de l'action serveur et des composants, en suivant les conventions du dépôt (dossier par composant, `controller.tsx` si besoin).
- La rédaction du prompt, en respectant le §3 (données en balises, pas d'invention, langue, bornes).
- L'endroit exact du bouton « Choisir le CV envoyé » : un lien vers l'ancre du champ sur la page de la candidature suffit.
