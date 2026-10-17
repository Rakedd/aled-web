# Freeclutch — Document de conception (V1)

Date : 2026-10-17
Statut : validé le 2026-10-17

Légende : sauf mention contraire, ce qui est décrit vient directement du porteur du projet. Les éléments marqués **[choix du rédacteur]** sont des décisions prises pendant la conception, qui n'ont pas été explicitement demandées. Ils peuvent être remis en cause.

---

## 1. Intention

Freeclutch est un outil web de suivi des candidatures à des missions freelance.

**Le problème.** Le porteur du projet est développeur freelance. Il postule à beaucoup de missions venues de sources très différentes : plateformes (Free-Work, Collective, LeHibou…), posts et messages LinkedIn, bouche-à-oreille d'anciens contacts. Il n'a aucun endroit unique pour les suivre et fait **tout de mémoire** : relances oubliées, contacts introuvables, fiche métier non récupérée avant un entretien.

**Ce que l'outil doit faire.** Être l'endroit unique où atterrit chaque candidature, quelle que soit sa source. Il doit aussi **se souvenir à la place de l'utilisateur** et lui dire quoi faire : qui relancer, quelle fiche métier réclamer, quel entretien préparer.

**La phase qui compte le plus** est la préparation d'un entretien. Il faut alors avoir sous la main la stack complète de la mission (tirée de la fiche métier) et un brief sur l'entreprise cliente (enjeux, CA, croissance, marché).

## 2. Utilisateurs

- **Principal :** le porteur du projet, un développeur freelance.
- **Probables à terme :** quelques proches (amis, famille) à qui il ouvrira l'accès. L'outil doit donc gérer **plusieurs utilisateurs dès la V1**, chacun ne voyant que ses propres données. L'accès se fait **uniquement sur invitation**, sans inscription publique.
- Utilisation sur **ordinateur**. Le site doit rester lisible et utilisable sur téléphone, sans être optimisé pour.

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs V1**
- Lister toutes les candidatures dans un tableau filtrable, avec leur statut, leurs dates et leurs interlocuteurs.
- Ajouter une candidature en moins de 30 secondes, quelle que soit la source.
- Faire remonter automatiquement les actions à mener (bandeau « À faire »).
- Centraliser la fiche métier et en extraire la stack technique.
- Générer à la demande un brief sur l'entreprise cliente.
- Afficher les entretiens dans un calendrier qui donne accès à la stack de la mission.

**Non-objectifs V1**
- Aucune intégration spécifique par site : pas de parser Free-Work, LinkedIn, etc., pas de scraping. La source n'est qu'une étiquette.
- Pas de récupération automatique d'une annonce à partir de son URL. L'utilisateur colle le **texte**.
- Pas d'app mobile native.
- Pas de page « Potentielles missions » ni d'intégration du bot (voir V2).
- Pas de facturation ni d'abonnement.

**Anti-objectifs (ce qui rendrait l'outil raté même s'il fonctionne)**
- Une saisie trop longue : si ajouter une candidature ou noter un échange est pénible, l'utilisateur arrête au bout d'une semaine.
- Un tableau passif qui oblige l'utilisateur à repérer lui-même ce qui urge.
- Une IA qui enregistre des données sans validation humaine.
- Une clé API exposée côté navigateur, ou lisible par un autre utilisateur.

## 4. Le parcours d'une candidature

Parcours validé par le porteur du projet.

### 4.1 Le chemin vers la signature

| # | Statut | Ce qui se passe |
|---|--------|-----------------|
| 1 | **Postulé** | Candidature envoyée (bouton « postuler » d'une plateforme, message LinkedIn, contact direct). |
| 2 | **Échange intermédiaire** | L'intermédiaire répond, dans 90 % des cas par un appel, parfois par message. |
| 3 | **CV positionné** | L'intermédiaire a envoyé le CV au client. **C'est le moment de récupérer la fiche métier** (document ou mail décrivant toute la stack). Si le client ne répond pas, une relance est nécessaire. |
| 4 | **Entretien planifié** | Le client accepte et des créneaux sont fixés, avec si besoin des entretiens blancs organisés par l'intermédiaire. **Phase de préparation** : se renseigner sur l'entreprise cliente et réviser la stack de la fiche métier. |
| 5 | **Entretien passé** | En attente du retour du client, transmis par l'intermédiaire. |
| 6 | **Contrat reçu** | Le client a validé ; relecture et négociation du contrat. |
| 7 | **Signé** | Contrat signé, avec une date de démarrage. |

**[choix du rédacteur]** La « préparation » n'est pas un statut distinct. C'est une activité de la phase « Entretien planifié », et la fiche candidature met alors en avant la stack et le brief.

### 4.2 Les fins négatives

| Statut | Quand |
|--------|-------|
| **KO après échange** **[choix du rédacteur]** | L'intermédiaire ou l'utilisateur ne donne pas suite après le premier échange. |
| **KO CV** | Le client refuse le CV, ou ne donne aucune nouvelle malgré la relance. |
| **KO entretien** | Refus après l'entretien (annoncé par l'intermédiaire) ou entretien catastrophique. |
| **Sans nouvelles / abandonnée** **[choix du rédacteur]** | Plus aucun échange depuis longtemps, ou l'utilisateur laisse tomber (par exemple après avoir signé ailleurs). |

**[choix du rédacteur]** L'utilisateur peut changer de statut librement, y compris revenir en arrière pour corriger une erreur. Chaque changement de statut crée automatiquement une entrée dans le journal des échanges.

## 5. Les données

Modèle conceptuel. Le schéma exact est laissé au builder.

**Toutes les données appartiennent à un utilisateur.** Aucune requête ne doit pouvoir lire ou modifier les données d'un autre.

### Candidature
- Titre de la mission
- Source : étiquette libre avec suggestions (Free-Work, Collective, LeHibou, Malt, LinkedIn, Bouche-à-oreille, Autre)
- Lien de l'annonce (facultatif)
- Texte d'origine de l'annonce (facultatif, conservé tel quel)
- Statut (section 4)
- Intermédiaire (facultatif)
- Contact principal (facultatif)
- **Client final, facultatif** : il est souvent inconnu au départ (le post LinkedIn vient d'un recruteur, l'annonce Free-Work d'une agence) et n'apparaît qu'en cours de route.
- **Stack** **[choix du rédacteur]** : une seule stack par candidature, sous forme de liste structurée de technologies regroupées par catégorie (langages, frameworks, outils, méthodes…) et éditable. Chaque technologie garde son origine (« annonce » ou « fiche métier »). La stack extraite de l'annonce à la création est provisoire. Quand une fiche métier est ajoutée, sa stack extraite **remplace** celle de l'annonce, après validation par l'utilisateur. C'est cette stack qu'affichent la fiche candidature et le calendrier.
- TJM affiché dans l'annonce et TJM demandé
- Lieu et rythme de télétravail
- Date de démarrage souhaitée et durée
- Date de candidature
- Date du dernier échange : **dérivée du journal**, pas saisie
- Notes libres
- Date de démarrage effective (si signé)

### Intermédiaire, contact et client final
**[choix du rédacteur]** Ce sont des entités réutilisables, partagées entre candidatures, avec autocomplétion à la saisie. Un même recruteur envoie souvent plusieurs missions, et un même client peut être proposé par plusieurs agences.
- **Intermédiaire** : nom (agence, ESN, plateforme…), type.
- **Contact** : nom, téléphone, e-mail, lien LinkedIn, intermédiaire de rattachement (facultatif).
- **Client final** : nom, **groupe parent facultatif**, et son brief (voir plus bas). Un même groupe publie souvent des offres pour plusieurs filiales (par exemple BNP Paribas Asset Management et BNP Paribas Real Estate). Chaque filiale est donc un client final distinct, avec ses propres enjeux et son propre brief. Le groupe parent est lui-même un client final, ce qui permet de rattacher plusieurs filiales au même groupe. L'autocomplétion affiche « Filiale (Groupe) ». Le brief d'une filiale comprend une courte section sur le contexte du groupe.

### Journal des échanges
Une entrée = un échange : date, type (appel, message, e-mail, changement de statut, autre) et résumé court. **Noter un échange doit prendre deux clics** : c'est la saisie la plus fréquente, et c'est elle qui alimente la date du dernier échange et les relances.

### Entretien
Date et heure, type (entretien client, entretien blanc avec l'intermédiaire, autre), modalité (visio, sur site, téléphone), interlocuteurs et notes. Un entretien est toujours rattaché à une candidature.

### Fiche métier
Une fiche par candidature au maximum, ajoutée de deux façons :
- dépôt d'un fichier PDF ;
- collage de texte (par exemple un mail).

Le fichier ou le texte d'origine est conservé. La stack qui en est extraite alimente la stack de la candidature (voir plus haut). L'alerte « Fiche métier manquante » dépend de la présence d'une fiche, pas de celle d'une stack.

### Brief client
Texte généré par l'IA à partir du nom du client final : enjeux, chiffre d'affaires, croissance, marché, actualités récentes, **avec les sources**. **[choix du rédacteur]** Le brief est rattaché au **client final**, pas à la candidature : un client rencontré via plusieurs agences n'a qu'un brief, et les notes de l'utilisateur sur ce client sont partagées. Le brief est stocké, l'utilisateur peut le régénérer, et sa date de génération est affichée.

### Profil utilisateur (réglages)
Nom, prénom, e-mail, liens (LinkedIn, profil Free-Work, autres) et clé API Claude (section 8).

## 6. Les pages de la V1

### 6.1 Connexion
- Connexion par e-mail.
- Les nouveaux comptes ne peuvent être créés que par invitation.
- **[choix du rédacteur]** En V1, le porteur du projet envoie les invitations depuis l'interface d'administration de Supabase. Aucun écran d'administration n'est construit.

### 6.2 « Mes candidatures » (page d'accueil)
Disposition validée : **un tableau surmonté d'un bandeau « À faire »**.

**Le bandeau « À faire »** liste les actions dues, chacune cliquable vers la candidature concernée :
- **Relance due** : statut « CV positionné » (ou « Échange intermédiaire ») sans échange depuis N jours. **[choix du rédacteur]** N vaut 7 par défaut et se règle dans les réglages.
- **Fiche métier manquante** : statut « CV positionné » ou plus avancé, sans fiche métier.
- **Client final inconnu** : statut « Entretien planifié » sans client final renseigné, parce qu'on ne peut pas préparer un entretien sans savoir chez qui.
- **Entretien à venir** : entretiens (y compris blancs) dans les 7 prochains jours **[choix du rédacteur]**.
- **Suggestion « sans nouvelles »** : candidature active sans échange depuis 21 jours **[choix du rédacteur]**. L'outil propose de la clore, sans le faire automatiquement.

**[choix du rédacteur]** Chaque alerte peut être **reportée** (3 jours par défaut, ou 7 jours au choix). Une alerte reportée réapparaît à l'échéance si elle est toujours vraie. Noter un échange, changer de statut ou résoudre la cause (ajouter la fiche, renseigner le client) la fait disparaître d'elle-même. Le report est mémorisé par candidature et par type d'alerte. Les entretiens à venir ne se reportent pas.

**Le tableau.**
- Colonnes : mission, intermédiaire, contact, client final, source, statut, date de candidature, dernier échange (en relatif : « il y a 9 j »).
- Recherche texte, filtres par statut et par source, tri par colonne.
- Les candidatures terminées (signées ou KO) sont masquées par défaut, avec une case pour les afficher.
- Un clic sur une ligne ouvre la fiche candidature.

### 6.3 Ajout d'une candidature
1. L'utilisateur clique sur « Nouvelle candidature ».
2. Il colle le texte de l'annonce (ou du post, ou du message), ou choisit « saisie manuelle ».
3. Si un texte est collé et qu'une clé Claude est configurée, l'IA extrait les champs : titre, intermédiaire, contact, client final s'il est mentionné, TJM, lieu et télétravail, démarrage, durée, stack.
4. Le formulaire s'affiche pré-rempli. L'utilisateur corrige et complète. **Rien n'est enregistré avant qu'il valide.**
5. La date de candidature vaut aujourd'hui par défaut, le statut « Postulé » par défaut.

Si l'extraction échoue ou s'il n'y a pas de clé, le formulaire s'affiche vide avec le texte collé conservé, et la saisie manuelle reste possible.

### 6.4 Fiche candidature
Disposition validée sur maquette :
- **En-tête** : titre, intermédiaire, client final (ou « client inconnu »), source, date de candidature, dernier échange. Une frise des étapes avec l'étape courante, un bouton « Passer à l'étape suivante » et un menu « Marquer KO » (qui propose les fins négatives).
- **Infos mission** : tous les champs de la candidature, éditables.
- **Fiche métier** : zone de dépôt (PDF) ou de collage, et la stack extraite sous forme d'étiquettes éditables.
- **Préparation / brief client** :
  - client final inconnu : message « Client inconnu, demande-le à l'intermédiaire » ;
  - client connu : bouton « Générer le brief », puis affichage du brief avec ses sources, et les notes personnelles.
- **Entretiens** : liste, avec ajout, modification et suppression.
- **Journal des échanges** : liste chronologique inversée, avec un ajout rapide.

### 6.5 Calendrier
- Vue mois et vue semaine de tous les entretiens de l'utilisateur, avec une distinction visuelle entre entretien client et entretien blanc.
- Un clic sur un entretien ouvre un panneau avec le descriptif de la mission et sa **stack complète**, pour réviser, et un lien vers la fiche candidature.

### 6.6 Réglages
- Profil : nom, prénom, e-mail, liens.
- Clé API Claude (section 8).
- Délai de relance (N jours, 7 par défaut).
- Bouton « Exporter mes données » (section 9).

## 7. L'IA

Tous les appels à Claude se font **côté serveur**, avec la clé de l'utilisateur, via le SDK officiel `@anthropic-ai/sdk`.

| Usage | Déclencheur | Modèle | Notes |
|---|---|---|---|
| Extraction d'une annonce collée | Ajout d'une candidature | `claude-haiku-5-5` | Sortie structurée (`output_config.format`) validée par un schéma. |
| Extraction de la stack d'une fiche métier | Dépôt ou collage d'une fiche | `claude-haiku-5-5` | Le PDF est envoyé comme bloc `document`. |
| Brief entreprise cliente | Bouton, à la demande uniquement | `claude-sonnet-5-5` + outil `web_search_20260209` | Haiku n'a pas accès à cet outil de recherche web. Limiter `max_uses` (5 par exemple). Sources obligatoires. |

**[choix du rédacteur]** Les modèles sont choisis pour leur coût. Le porteur du projet a exprimé une sensibilité au prix.

**Coût estimé** (tarifs relevés le 2026-10-17) :
- Haiku 5.5 : 0,10 $ / 0,50 $ par million de tokens en entrée / sortie, soit moins de 0,1 centime par extraction.
- Sonnet 5.5 : 2 $ / 10 $ par million de tokens, plus 10 $ pour 1 000 recherches web, soit environ 10 à 15 centimes par brief.
- Pour un usage type (50 candidatures et 10 briefs par mois), cela fait **moins de 2 $ par mois et par utilisateur**.

**Règles :**
- La sortie de l'IA ne fait que **pré-remplir** des champs que l'utilisateur valide. Le texte collé ne doit déclencher aucune autre action, ce qui protège contre une instruction malveillante cachée dans une annonce.
  - **[choix du rédacteur]** Pour la stack extraite d'une fiche métier : elle s'affiche comme un brouillon (étiquettes éditables avec un bouton « Valider ») et ne remplace la stack de la candidature qu'après validation.
  - Pour le brief : il est enregistré directement, puisque l'utilisateur l'a demandé explicitement et que c'est un texte de lecture, pas une donnée qui pilote l'outil.
- Une erreur (clé invalide, quota dépassé, refus, délai d'attente) affiche un message clair et laisse la saisie manuelle disponible.
- La clé API n'apparaît jamais dans les journaux du serveur.

## 8. Clé API Claude par utilisateur

Chaque utilisateur, y compris le porteur du projet, fournit sa propre clé dans les réglages. Il n'existe **pas de clé globale** qui paierait pour tout le monde.

- Le champ est en **écriture seule**. À l'enregistrement, le serveur teste la clé par un appel minimal, puis la stocke **chiffrée** (chiffrement symétrique authentifié, par exemple AES-256-GCM, avec un secret serveur conservé dans une variable d'environnement).
- La clé n'est **jamais renvoyée au navigateur**. L'interface affiche seulement son état (« sk-ant-…4f2a ✓ active ») et les boutons « Remplacer » et « Supprimer ».
- Elle n'est déchiffrée que côté serveur, au moment d'un appel à Claude.
- **Sans clé, l'outil fonctionne entièrement en saisie manuelle.** Les fonctions IA sont désactivées, avec un message qui renvoie vers les réglages.
- **[choix du rédacteur]** On conseille aux utilisateurs, dans l'interface, de fixer un plafond de dépenses mensuel dans la console Anthropic.

## 9. Stack et architecture

**[choix du rédacteur, présenté au porteur du projet sans objection]**

- **Next.js** (App Router) + **TypeScript** + **React** : interface et serveur dans un seul projet. Tout l'accès aux données passe par le serveur (server actions / route handlers).
- **Supabase** : base Postgres, authentification par invitation, stockage des PDF de fiches métier.
  - Le navigateur n'interroge **jamais** la base directement.
  - Les politiques **RLS** sont activées sur toutes les tables, en deuxième barrière.
  - Le stockage des fichiers est privé, par utilisateur.
- **Vercel** pour l'hébergement.
- Secrets (clés Supabase côté serveur, secret de chiffrement) dans des variables d'environnement, jamais exposés au client.

**Coût d'hébergement (décidé par le porteur du projet) : formules gratuites de Supabase et de Vercel en V1.** La formule gratuite de Supabase ne fait aucune sauvegarde automatique et met le projet en pause après une période d'inactivité. Pour compenser :
- **une sauvegarde automatique hebdomadaire** de toutes les données (tâche planifiée, par exemple un cron Vercel). Le format et la destination sont laissés au builder, à condition que la sauvegarde soit hors de Supabase et restaurable ;
- **un bouton « Exporter mes données »** dans les réglages, qui produit un export complet des données de l'utilisateur connecté.

Le passage à une formule payante sera envisagé quand le nombre d'utilisateurs augmentera. Quelques euros par mois sont acceptables pour le porteur du projet si un besoin réel apparaît, mais la V1 reste gratuite.

## 10. Conventions de code

Imposées par le porteur du projet :
- TypeScript strict, **aucun `any`**.
- Fonctions fléchées uniquement ; exports nommés uniquement (sauf ce qu'exige Next.js, comme les `page` et `layout`).
- Un dossier par composant, en kebab-case : `component-name.tsx`, `interfaces.ts`, `index.ts`, et `controller.tsx` (hook `useController`) dès que le composant a une logique non triviale (plus de quatre fonctions internes).
- Pas de multiplication de petits hooks : un composant, un `useController`.
- Aucun `console.log` en production (`console.error` et `console.warn` sont autorisés) ; pas de commentaires sauf logique vraiment complexe ; aucun code mort.
- Noms explicites, même longs.

## 11. Tests

Les tests font partie de la fonctionnalité.
- **Unitaires (Jest + React Testing Library)** : chaque `useController` testé avec `renderHook`, ainsi que les règles du bandeau « À faire », les transitions de statut, le chiffrement et déchiffrement de la clé, et la validation des sorties IA.
- **Isolation des données** : un test qui vérifie qu'un utilisateur ne peut ni lire ni modifier les données d'un autre.
- Les appels à Claude sont simulés dans les tests.

## 12. Laissé au builder

- Le schéma de base exact, les migrations et les noms de tables.
- La bibliothèque de composants UI et celle du calendrier.
- La forme exacte des prompts d'extraction et du brief.
- La gestion fine des fuseaux horaires (utilisateurs en France).
- Le design visuel, dans le respect des dispositions validées.

## 13. V2 et roadmap

**V2 : Potentielles missions**
- Une page « Potentielles missions » qui reçoit les missions repérées (statut « Repérée »). Un bouton « Postuler » transforme une mission en candidature (statut « Postulé ») ; un autre l'ignore.
- Un point d'entrée sécurisé (un jeton par utilisateur) par lequel le bot « career ops » du porteur du projet envoie ses missions, au lieu de Discord.
- Des mots-clés de recherche dans les réglages, consommés par le bot et les futurs outils.

**Plus tard**
- App mobile.
- Aide à la relecture et à la négociation des contrats.
- Autres bots et imports.
