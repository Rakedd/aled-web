# Freeclutch — Refonte visuelle « Atelier » — Document de conception

Date : 2026-10-19
Statut : brouillon, à valider

Ce document complète les conceptions V1, V2 et V3 (`2026-10-17-freeclutch-design.md`, `2026-10-18-mes-opportunites-design.md`, `2026-10-18-freeclutch-v3-design.md`). Toutes leurs contraintes restent valables : stack, conventions de code du porteur, sécurité, fuseau Europe/Paris, tests. Les décisions marquées **[choix du rédacteur]** n'ont pas été demandées explicitement par le porteur.

**Maquettes de référence** : https://claude.ai/artifact/LvoepBkNEqKAZdpBe3DotZ (planche privée du porteur). Les sources HTML des maquettes retenues sont copiées dans `docs/superpowers/specs/assets/2026-10-19-atelier/` pour que les builders puissent les lire. Ce sont des maquettes statiques, au format du canevas de design (styles en ligne, balises `x-dc`) : elles servent de référence visuelle, pas de code à reprendre. En cas d'écart, le texte de ce document fait foi. Les maquettes retenues sont listées page par page plus bas. Les autres planches (identités 1, 3, 4, 5, accueils A, B, C, E, fiches A, B, C, E, idées « À faire » 2 à 4, opportunités B à E) ont été écartées. Les textes et chiffres des maquettes sont des exemples, pas des données.

---

## 1. Intention

L'application est aujourd'hui « noir sur blanc ». Le porteur veut qu'elle soit **vivante et qu'elle ait de la gueule**, sans perdre en lisibilité. Il a aussi deux gênes d'usage :

- la **fiche candidature** affiche trop d'informations d'un coup, elle est « agressive » au premier regard ;
- le **bandeau « À faire »** du tableau peut prendre la moitié de l'écran quand il y a beaucoup de tâches, et risque de devenir une corvée.

**Réussite** : chaque page reprend la même identité, la fiche se lit par onglets, « À faire » tient sur une ligne, et l'usage quotidien est plus agréable sans être plus lent.

**Hors périmètre** : mode sombre, application mobile, nouvelles fonctionnalités au-delà de celles listées ici (en particulier le « tri rapide », le bouton « Plus tard », les actions groupées et le bouton « J'ai relancé » vus sur des maquettes écartées).

**Anti-objectifs** : une interface plus lente, des contrastes illisibles, ou une régression sur ce qui marche aujourd'hui (resynchronisation après `router.refresh()`, édition bloc par bloc, préparation d'entretien, filtres Free-Work).

## 2. Identité visuelle « Atelier »

Choisie par le porteur parmi 5 directions (planche « 2 · Atelier »). Ambiance : calme, soignée, chaleureuse, beaucoup d'air, coins arrondis.

### 2.1 Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| Fond | `#F2F4F1` (sauge) | fond de page |
| Surface | `#FFFFFF` | cartes, barres, panneaux |
| Surface douce | `#F7F9F7` | champs de saisie, zones secondaires |
| Encre | `#16231D` | texte principal, boutons foncés |
| Texte secondaire | `#3B4A42` | paragraphes, sous-titres |
| Texte discret | `#55625B` | libellés, dates, légendes |
| Filets | `#E6ECE8`, `#DDE3DE` | séparateurs |
| Bordure des contrôles | `#C9D3CC` | boutons secondaires, champs |
| **Forêt** (action) | `#1F5C46` | bouton principal, onglet actif, élément actif du menu, TJM ; texte blanc dessus |
| **Pêche** (à venir, à faire) | `#FFB48A`, teinte `#FFF1E8` | prochain entretien, compteurs « à faire », relances ; texte encre dessus |
| **Lilas** (info) | `#DCD6F7`, teinte `#F2F0FC` | préparation d'entretien, « nouveau », fiche métier, client inconnu, entretiens blancs |
| **Terre** (KO, alerte) | texte `#8A3B32` sur `#F1E3E1`, teinte `#FBF1EF` | statuts KO, sans nouvelles, suppression |
| Pêche foncé (texte) | `#8A4B1F` sur `#FFF1E8` | ancienneté 7 à 14 jours |

Tout texte respecte un contraste d'au moins 4,5:1 sur son fond. Les couleurs qui doivent se distinguer diffèrent aussi en luminosité, pas seulement en teinte.

### 2.2 Typographie

- **Manrope** (700–800) pour les titres, les chiffres mis en avant (TJM, dates, compteurs) et le logo. Lettrage légèrement resserré sur les gros titres.
- **Figtree** (400–700) pour tout le texte courant, les libellés et les boutons.
- Chargées avec `next/font/google`, à la place de Geist.

### 2.3 Formes et composants de base

- **Boutons** en pilule (rayon complet). Le principal est en forêt avec un texte blanc. Le secondaire est blanc avec une bordure. Le destructif a un texte terre. Les boutons icône font 44 px et portent un `aria-label`.
- **Cartes** blanches à rayon 24–28 px, sans bordure, avec une ombre très légère seulement quand une carte doit ressortir.
- **Pastilles** (badges, filtres, compteurs) en pilule.
- **Champs** à rayon 14–16 px, sur fond surface douce, avec une bordure de contrôle.
- **Onglets** dans une pilule blanche, l'onglet actif en forêt.
- **Correspondance des statuts** **[choix du rédacteur]** :

  | Statut | Style |
  |---|---|
  | Postulé | neutre (fond sauge, bordure filet) |
  | Échange intermédiaire | `#E6ECE8` |
  | CV positionné | lilas |
  | Entretien planifié | pêche |
  | Entretien passé | `#E6ECE8`, texte forêt |
  | Contrat reçu | forêt clair (`#E6ECE8`), texte forêt en gras |
  | Signé | forêt, texte blanc |
  | KO (tous) et sans nouvelles / abandonnée | terre |

- **Icônes** : traits fins en SVG en ligne (crayon, fermer, lien externe), jamais d'emoji.
- Les jetons vivent dans les variables CSS du thème shadcn (`globals.css`), plus des jetons propres (`--peach`, `--lilac`, `--clay`…). Les composants les utilisent via Tailwind, jamais en dur.
- Seul le mode clair est visé **[choix du rédacteur]**. Le bloc `.dark` existant n'a pas à être maintenu.

### 2.4 Menu

Une **barre blanche en pilule en haut** de chaque page de l'application (maquettes « Bento »), avec :

- le logo « Freeclutch » à gauche, qui mène à l'accueil ;
- « Mes candidatures », « Mon calendrier », « Mes opportunités » avec son compteur « À traiter » sur pastille pêche, et « Préférences ».

La page active est en forêt. Sur téléphone, la barre passe à la ligne : elle ne déborde jamais et ne crée jamais de défilement horizontal de la page.

## 3. Pages

Toutes les pages doivent marcher dès 360 px de large. Les rangées de tuiles et les colonnes s'empilent. Tous les libellés restent en français.

### 3.1 Accueil — maquette « D · Bento »

- **Rangée 1** :
  - grande tuile forêt : date du jour, « Bonjour {prénom} » (ou « Bonjour » seul) et une **phrase de résumé** (nouveau) ;
  - tuile pêche **« Prochain entretien »** : jour et heure en très grand, type et mission, **compte à rebours** (nouveau), bouton « Voir mon calendrier ».
- **Rangée 2** :
  - tuile **« À faire »** : jusqu'à 5 rappels en petites cartes colorées par type (relance en pêche, fiche métier et client inconnu en lilas, sans nouvelles en terre, entretien à venir en sauge), avec « Voir mes candidatures » ;
  - tuile **« Ensuite »** : les 2 entretiens suivants, avec leur pavé de date ;
  - deux tuiles chiffres (nouveau) : **« candidatures en cours »** en lilas et **« missions à traiter »** en encre.
- **Rangée 3** : « Missions intéressantes · moins de 48 h », 2 missions en bandeaux avec TJM, « J'ai postulé » et Free-Work, plus le bouton « Voir mes opportunités ».
- Les états vides et les règles de la V3 §5.3 sont inchangés. La tuile « Prochain entretien » affiche « Aucun entretien prévu. » quand il n'y en a pas, et « Ensuite » disparaît alors.

**Les 4 ajouts validés par le porteur :**

1. **Phrase de résumé.** Générée à partir des données, sans IA **[choix du rédacteur]** :
   - le nombre de rappels (« 4 choses à faire ») ;
   - le prochain entretien s'il a lieu dans les 7 jours (« un entretien client mardi ») ;
   - sinon le nombre de missions intéressantes de moins de 48 h.

   Quand il n'y a rien : « Rien d'urgent aujourd'hui. » Accords et pluriels corrects.
2. **Compte à rebours** du prochain entretien, en jours calendaires Europe/Paris : « aujourd'hui », « demain », puis « dans N jours ».
3. **« Candidatures en cours »** : les candidatures dont le statut n'est pas terminal (ni signé, ni KO, ni sans nouvelles / abandonnée).
4. **« Missions à traiter »** : le même nombre que le compteur du menu.

### 3.2 Mes candidatures — tableau

- Titre « Mes candidatures » et bouton « + Nouvelle candidature ».
- **« À faire » en une ligne** (idée « 1 · Une ligne de résumé ») : une barre blanche en pilule « À faire · N », avec une pastille par type d'alerte et son nombre (« 8 relances », « 6 sans nouvelles », « 5 fiches métier », « 4 clients inconnus », « 2 entretiens à venir »), aux couleurs du §2.1.
  - **Un clic sur une pastille filtre le tableau** sur les candidatures qui portent ce type d'alerte, et s'ajoute aux autres filtres. Un second clic retire le filtre. La pastille active est en forêt.
  - **« Tout déplier »** affiche la liste détaillée actuelle, avec ses actions existantes comme le report. Elle est repliée par défaut **[choix du rédacteur]**.
  - Les types sans alerte n'ont pas de pastille. S'il n'y a aucune alerte, la barre affiche « Rien à faire pour l'instant ».
- **Couleurs d'ancienneté** sur la colonne « Dernier échange », avec une légende près des filtres :
  - moins de 7 jours : fond `#E6ECE8`, texte forêt ;
  - de 7 à 14 jours : pêche ;
  - plus de 14 jours : terre.

  Les jours sont comptés en jours calendaires Europe/Paris. Les candidatures terminées gardent un style neutre **[choix du rédacteur]**, puisqu'il n'y a plus personne à relancer.
- Le tableau lui-même (colonnes, tri, filtres de statut et de source, case des terminées) est inchangé, seul son style change. Il est dans une carte blanche et défile horizontalement dans sa boîte sur petit écran.

### 3.3 Fiche candidature — maquette « D · Bento + onglets »

- **En-tête**, toujours visible :
  - **une carte blanche** avec :
    - le lien « ← Mes candidatures » et le crayon de l'en-tête ;
    - le titre ;
    - la ligne client final · intermédiaire · source · date de candidature · lien de l'annonce ;
    - le statut en pastille, « étape N sur 7 » et « Changer le statut ». Ce bouton donne accès au changement de statut et au KO actuels, sans changer leur fonctionnement.
  - **trois tuiles** à côté :
    - **TJM demandé** en forêt (sinon le TJM annoncé, sinon « TJM non renseigné ») ;
    - **prochain entretien** en pêche, avec le compte à rebours du §3.1 (« Aucun entretien prévu » sinon) ;
    - **préparation d'entretien** en lilas, avec le bouton du brief et ses libellés V3 (« Générer le brief » / « Brief généré · voir mon brief »), qui ouvre la fenêtre existante.
- **Quatre onglets** dans une pilule, avec leur compteur quand il a un sens :
  - **Aperçu** : bloc infos mission et bloc contact (crayon par bloc), puis « Supprimer la candidature » tout en bas ;
  - **Mission** : bloc stack (crayon) et fiche métier (dépôt PDF ou texte, validation de la stack) ;
  - **Entretiens · N** : la liste des entretiens et « Nouvel entretien » ;
  - **Journal · N** : la frise des échanges, avec « Noter un échange » à côté (en dessous sur téléphone).
- **Onglet ouvert par défaut** : **Entretiens** si un entretien a lieu dans les 7 prochains jours (Europe/Paris), sinon **Aperçu**. Règle validée par le porteur.
- L'onglet choisi est reflété dans l'URL (`?onglet=apercu|mission|entretiens|journal`), pour qu'un lien ou un retour arrière rouvre le même onglet **[choix du rédacteur]**. Un paramètre absent ou inconnu applique la règle par défaut.
- Changer d'onglet ne perd pas une saisie en cours : un bloc en modification reste dans son état. La règle V2/V3 (`router.refresh()` n'écrase jamais une saisie) continue de s'appliquer.
- Les onglets sont accessibles au clavier, avec le motif ARIA des onglets : flèches, `aria-selected`, panneau associé.

### 3.4 Mes opportunités — maquette « A · Liste de cartes » + filtres de la « E »

- **En-tête** : titre, indicateur de fraîcheur (« Free-Work · mis à jour il y a N min », avec l'alerte V2 existante), et lien « Mes filtres Free-Work » vers les préférences.
- **Ligne de recherche** : la recherche V3 et, à côté, les **filtres rapides** (nouveau) :
  - **« Trier par TJM »** : un interrupteur qui trie par TJM effectif décroissant, TJM non communiqué en dernier, puis par date de publication décroissante ;
  - **« Présentiel »** : trois pastilles combinables **Full remote · Hybride · Sur site**. Aucune pastille active veut dire tous les modes. Une mission sans mode connu n'apparaît que si aucune pastille n'est active.
- Les filtres rapides **s'ajoutent** aux filtres Free-Work des préférences et à la recherche, sans les remplacer. Ils s'appliquent à l'onglet affiché, et les compteurs des onglets en tiennent compte, comme pour la recherche (V3 §5.4).
- Ils sont faits **côté serveur**, dans la requête de liste, pour rester justes avec la pagination par curseur.
- **Ils ne sont pas enregistrés** : ils valent pour la session de la page. Ils peuvent être reflétés dans l'URL **[choix du rédacteur]**.
- Ils ne changent ni le compteur du menu ni les missions mises en avant sur l'accueil.
- **Onglets** À traiter · Postulées · Ignorées en pilule, avec leurs compteurs.
- **Cartes** :
  - titre et mention « nouveau » en lilas ;
  - TJM en gros à droite, en forêt ;
  - ligne client · mode · lieu · durée · ancienneté ;
  - 2 à 3 lignes de description avec « Afficher la suite » ;
  - « J'ai postulé » en bouton principal et « Voir sur Free-Work » en secondaire, avec « Pas intéressé » discret en bout de ligne. L'onglet Ignorées garde « Remettre ».
  - Les états V2/V3 (« Création… », « Candidature créée · Voir la candidature ») sont conservés.

### 3.5 Mon calendrier

- **En-tête** : mois en cours, précédent / suivant, « Aujourd'hui », légende (Client en pêche, Blanc en lilas) et choix de vue Mois / Semaine / Liste en pilule.
- **FullCalendar** est restylé aux couleurs Atelier : cases arrondies, jour courant cerclé de forêt, entretiens client en pêche et blancs en lilas.
- **Panneau de détail** : le panneau existant (`InterviewRevisionPanel`) est restylé. Il s'affiche à droite sur grand écran et en dessous sur petit écran. Il montre le type, la date, la mission, le client, le TJM, le lieu, le démarrage, la durée et la stack en pastilles, avec « Ouvrir la fiche ».
- **« Voir mon brief »** mène à la fiche sur l'onglet Entretiens **[choix du rédacteur]**, sans ouvrir la fenêtre du brief depuis le calendrier.

### 3.6 Préférences

- Menu secondaire à gauche (Profil · Opportunités · Free-Work), qui passe au-dessus sur téléphone.
- **Profil** :
  - une carte formulaire (prénom, nom, relance après N jours, liens en pastilles avec « + Ajouter un lien ») ;
  - une carte **clé Claude** sur fond encre, avec la clé masquée et les actions existantes (remplacer, supprimer avec confirmation) ;
  - une carte **« Mes données »** en lilas, avec « Exporter mes données ».
- **Free-Work** :
  - les mots-clés en pastilles colorées par rôle : inclure en sauge, exclure toujours en terre, exclure sauf rattrapage en pêche, rattrapage en lilas ;
  - le TJM minimum par mode, dans trois champs ;
  - les régions en pastilles à cocher ;
  - « Enregistrer les filtres ».

  Les règles et validations V2 sont inchangées. Les boîtes de mots-clés s'ajustent à leur contenu, sans hauteur minimale qui crée du vide (retour du porteur).

### 3.7 Nouvelle candidature

- Deux colonnes, empilées sur téléphone :
  - **« 1 · Colle l'annonce »** en lilas : le texte de l'annonce et « Pré-remplir avec l'IA » ;
  - **« 2 · Vérifie »** : le formulaire actuel rangé en blocs (La mission, Les personnes, Les conditions), la source en pastilles, et « Créer la candidature ».
- Une mention « Pré-rempli par Claude » apparaît après un pré-remplissage réussi.
- Les champs, validations et messages actuels sont inchangés, y compris « Ajoute ta clé Claude dans tes préférences ».

### 3.8 Connexion

- À gauche, un panneau forêt avec le logo, l'accroche « Toutes tes missions freelance, au même endroit. » et une phrase de présentation. À droite, la carte de connexion :
  - champ « Adresse e-mail » ;
  - bouton « Recevoir un lien de connexion » ;
  - mention « Accès sur invitation uniquement. »
- Sur téléphone, le panneau passe au-dessus et devient plus court.
- Les états actuels (envoi, envoyé, erreur) sont conservés.

## 4. Contraintes

- Toutes celles des V1 à V3 :
  - aucun `any` ;
  - fonctions fléchées ;
  - exports nommés ;
  - un dossier kebab-case par composant, avec son `useController` ;
  - pas de `console.log` ni de commentaires ;
  - isolation par utilisateur ;
  - la clé Claude ne quitte jamais le serveur ;
  - dates en Europe/Paris.
- Les nouveaux calculs ont des tests unitaires, y compris les cas Europe/Paris autour de minuit :
  - phrase de résumé ;
  - compte à rebours ;
  - compteurs ;
  - onglet par défaut ;
  - couleurs d'ancienneté ;
  - filtre par pastille ;
  - filtres rapides.
- Les filtres rapides ont des tests d'intégration, comme la recherche V3 : combinaison avec les filtres Free-Work et la recherche, compteurs, pagination.
- Accessibilité : contrastes du §2.1, vrais `<button>` et `<a>`, motif ARIA des onglets, `aria-pressed` sur les pastilles de filtre, focus visible.
- Pas de nouvelle migration de schéma attendue. Si l'implémentation en a besoin, elle est additive.
- Chaque lot se livre et se déploie seul, via la CI/CD : un push sur `main`.

## 5. Découpage en lots **[choix du rédacteur]**

1. **Fondations** : jetons de couleur, polices, composants de base (boutons, champs, cartes, pastilles, badges de statut, onglets) et menu en pilule. À ce stade, toutes les pages prennent déjà les couleurs et polices Atelier, sans changer de structure.
2. **Accueil Bento**, avec les 4 ajouts.
3. **Fiche candidature** en Bento + onglets.
4. **Mes candidatures** : « À faire » en une ligne, filtre par pastille, couleurs d'ancienneté.
5. **Mes opportunités** : cartes et filtres rapides.
6. **Calendrier, préférences, nouvelle candidature et connexion**.

## 6. Précisions **[choix du rédacteur, après relecture]**

1. **Types d'entretien.** Les trois types existants (`client` « Entretien client », `mock` « Entretien blanc », `other` « Autre ») comptent tous comme des entretiens partout :
   - la tuile « Prochain entretien » et « Ensuite » ;
   - la phrase de résumé, qui reprend le libellé du type ;
   - le compte à rebours ;
   - la tuile de la fiche et la règle d'onglet par défaut.

   C'est ce que fait déjà l'accueil V3 (« client et blanc »). Couleurs : client en pêche, blanc en lilas, autre en sauge (`#E6ECE8`), y compris dans la légende du calendrier. Un entretien du jour dont l'heure est passée est ignoré : on prend le suivant à venir.
2. **Pastilles « À faire ».** Elles reposent sur le calcul d'alertes existant (`computeTodoAlerts`, reports compris) :
   - **une pastille compte des alertes** d'un type ;
   - « À faire · N » est la somme des pastilles, donc le nombre total d'alertes, comme aujourd'hui ;
   - les alertes reportées sont exclues des compteurs comme du filtre ;
   - le filtre d'une pastille garde les candidatures qui ont au moins une alerte non reportée de ce type ;
   - après un « Reporter » dans la liste dépliée, les compteurs et le filtre se mettent à jour au rafraîchissement.
3. **« Étape N sur 7 »** ne s'affiche que pour les 7 statuts du parcours (« étape 7 sur 7 » pour Signé). Pour les statuts KO et « sans nouvelles / abandonnée », la fiche affiche seulement la pastille terre du statut, sans numéro d'étape. Rien n'est stocké en plus, pas de migration.
4. **TJM effectif** : c'est la fonction existante `getOpportunityEffectiveRate` (déjà utilisée par les filtres Free-Work et les missions mises en avant). Une mission pour laquelle elle renvoie `null` est « non communiquée ». La devise n'entre pas en compte : les missions Free-Work sont en euros. Le tri par TJM se fait au même endroit que la recherche V3, sur les positions déjà chargées et avant la pagination, avec un curseur qui inclut le TJM. Pas de migration ni de colonne calculée.
5. **État des filtres.** Les filtres du tableau des candidatures sont aujourd'hui un état de composant, côté client. Le filtre par pastille « À faire » suit le même modèle : il n'est pas dans l'URL et se réinitialise en quittant la page. Les filtres rapides des opportunités restent aussi un état de page (le §3.4 laisse l'URL au choix du builder). Seul l'onglet de la fiche est dans l'URL (`?onglet=`).
6. **Lot 1** : les composants shadcn existants (`button`, `input`, `label`) et les classes partagées sont **restylés sur place**, pour que toutes les pages changent d'un coup. Il n'y a pas de composants « Atelier » en parallèle. Les tests qui vérifiaient des classes de style sont mis à jour. Les tests de comportement ne doivent pas changer.

## 7. Laissé au builder

- Le nommage exact des jetons et leur branchement dans le thème shadcn.
- Le comportement exact du menu en pilule sur très petit écran : retour à la ligne, défilement interne ou menu repliable, du moment qu'il ne crée pas de défilement horizontal de la page.
- Les détails d'animation et de transition. Ils restent sobres et respectent `prefers-reduced-motion`.
- L'ordre exact des pastilles « À faire » et des mots de la phrase de résumé, dans l'esprit décrit.
