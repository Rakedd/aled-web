# Aled — Mode sombre — Document de conception

Date : 2026-10-20
Statut : brouillon, à valider

Ce document complète la refonte « Atelier » (`2026-10-19-freeclutch-design-atelier-design.md`). Toutes ses contraintes restent valables : conventions de code du porteur, accessibilité, 360 px, tests. Les décisions marquées **[choix du rédacteur]** n'ont pas été demandées explicitement par le porteur.

**Maquette de référence** : `.superpowers/design/aled-dark/index.html` (locale, ignorée par git), variante **« C2 · Anthracite + pêche »**, choisie par le porteur.

---

## 1. Intention

Le porteur veut un mode sombre en plus du mode clair actuel, avec le choix entre les deux. L'identité reste Atelier : le sombre est un fond gris chaud (anthracite) où la pêche devient la couleur d'action.

**Hors périmètre** : e-mails, icône et illustration de l'app, nouvelle mise en page. Le sombre ne change que les couleurs.

**Anti-objectifs** :
- un flash blanc au chargement en mode sombre ;
- un texte illisible quelque part dans un des deux thèmes ;
- une régression du mode clair actuel, qui doit rester identique au pixel près.

## 2. Comportement

- **Trois choix** : Clair, Sombre, Système. **Système** suit le réglage de l'appareil et change en direct s'il change. C'est le choix par défaut, y compris pour un utilisateur qui n'a encore rien choisi.
- **Sélecteur** dans le menu en pilule : un bouton icône de 44 px placé juste avant « Se déconnecter ». Son `aria-label` est « Thème », et son icône montre le thème actif : soleil, lune, ou écran pour Système. Un clic ouvre un petit menu avec Clair, Sombre et Système (icônes soleil, lune, écran). Le choix actif est coché. Le menu suit le motif ARIA des menus radio : `role="menu"` et `menuitemradio` avec `aria-checked`, flèches et Échap, focus rendu au bouton.
- **Mémorisation** : le choix est gardé dans le navigateur. Le mécanisme (cookie ou stockage local) est laissé au builder. Aucune donnée n'est stockée en base.
- **Pas de flash** : la page doit s'afficher directement dans le bon thème, y compris en mode Système et avant l'hydratation de React.
- **Page de connexion** : elle suit le thème mémorisé, Système par défaut. Elle n'a pas de sélecteur **[choix du rédacteur]**.
- La barre du navigateur mobile suit le thème (`theme-color`) **[choix du rédacteur]**.

## 3. Rôles de couleur

Le mode clair utilise aujourd'hui les mêmes jetons pour des rôles différents. En sombre, ces rôles divergent. Il faut donc d'abord **séparer les rôles**, sans rien changer à l'apparence du mode clair, puis donner une valeur sombre à chaque rôle.

| Rôle | Utilisé pour | Clair (actuel) | Sombre (C2) |
|---|---|---|---|
| Fond | page | `#F2F4F1` | `#171513` |
| Surface | cartes, menu, tableaux | `#FFFFFF` | `#211E1B` |
| Surface douce | champs, zones secondaires | `#F7F9F7` | `#2A2622` |
| Filet | séparateurs, pastille « sauge » | `#E6ECE8` | `#34302B` |
| Filet appuyé | | `#DDE3DE` | `#3C3732` |
| Bordure de contrôle | boutons secondaires, champs | `#C9D3CC` | `#423D37` |
| Texte | texte principal | `#16231D` | `#F1ECE6` |
| Texte secondaire | | `#3B4A42` | `#C8BFB5` |
| Texte discret | libellés, dates | `#55625B` | `#A0968B` |
| **Action** | bouton principal, onglet actif, lien actif du menu, filtre pressé, anneau de focus | forêt `#1F5C46`, texte `#FFFFFF` | pêche `#E9A27C`, texte `#1A120C` |
| **Accent texte** | TJM, liens dans le texte | `#1F5C46` | `#EDB08E` |
| **Tuile marque** | tuile « Bonjour », tuile TJM, statut « Signé » | `#1F5C46`, texte `#FFFFFF`, secondaire `#CFE3D8` | `#2D4B3B`, texte `#F1ECE6`, secondaire `#D3DDCF` |
| **Surface profonde** | carte clé Claude, bouton « encre », tuile « missions à traiter » | `#16231D`, texte clair | `#100E0C`, texte `#C8BFB5`, chiffre pêche |
| Pêche (tuiles, pastilles) | prochain entretien, relance, « Entretien planifié » | `#FFB48A`, texte encre | `#E9A27C`, texte `#1A120C` |
| Teinte pêche | fond des cartes « relance » | `#FFF1E8` | `#2D221A` |
| Pêche douce | pastille « 7 à 14 j » | `#FFF1E8` / `#8A4B1F` | `#3A2A1E` / `#F2B48E` |
| Lilas | préparation, fiche métier, entretien blanc, « CV positionné », **compteur du menu en sombre** | `#DCD6F7`, texte encre | `#C9BFE6`, texte `#15132A` |
| Teinte lilas | fond des cartes « fiche métier / client inconnu » | `#F2F0FC` | `#231F2C` |
| Lilas doux | | `#F2F0FC` / encre | `#2B2638` / `#D4CEF5` |
| Forêt douce | pastille « récent », choix coché d'un menu | `#E6ECE8` / `#1F5C46` | `#26302A` / `#A9CBA9` |
| Terre | KO, sans nouvelles, suppression | `#F1E3E1` / `#8A3B32` | `#3A2420` / `#F1A79D` |
| Teinte terre | fond des cartes « sans nouvelles » | `#FBF1EF` | `#2D1E1B` |
| Surface de menu flottant | sélecteur de thème, listes | `#FFFFFF` | `#2A2622` |

Précisions :
- **Compteur du menu** : en sombre, le lien actif est pêche. Le compteur « À traiter » passe donc en lilas pour rester visible, alors qu'il reste pêche en clair.
- **La pastille « récent »** (moins de 7 jours) reste verte en sombre (forêt douce). Elle doit se distinguer de la pastille « 7 à 14 j » (pêche douce). Ceci corrige la maquette C2 **[choix du rédacteur]**.
- **Calendrier** : il passe en sombre par ses variables FullCalendar (surfaces, filets, texte). Le jour courant est cerclé avec la couleur d'action. Les entretiens gardent pêche, lilas et sauge (= filet).
- **Contraste** : chaque paire texte / fond utilisée doit atteindre au moins 4,5:1 **dans les deux thèmes**. La pêche du sombre ne porte jamais de texte discret.
- **Ombres** : en sombre, les ombres portées restent très légères, ou sont remplacées par le filet **[choix du rédacteur]**.

## 4. Contraintes

- Le thème passe **uniquement par les jetons** :
  - aucune classe `dark:` dans les composants (le test qui l'interdit reste en place) ;
  - aucun hexadécimal en dehors de `globals.css` ;
  - le bloc sombre vit dans `globals.css`.
- **Le mode clair ne change pas d'apparence.** La séparation des rôles est une migration à valeurs égales.
- **Les tests de contraste** couvrent les paires de chaque rôle, pour les deux thèmes.
- Le sélecteur est testé :
  - choix et mémorisation ;
  - application immédiate ;
  - motif ARIA ;
  - icône qui suit le thème.
- La règle « pas de flash » est vérifiée par un test sur le script ou le rendu serveur, selon la solution retenue.
- Conventions habituelles : aucun `any`, fonctions fléchées, exports nommés, dossiers kebab-case avec `useController`, pas de commentaires ni de `console.log`, style du dépôt.
- Livraison en un seul lot, déployé par la CI/CD.

## 5. Laissé au builder

- Le mécanisme de mémorisation et d'application sans flash : `next-themes` ou un script maison (vérifier la compatibilité avec Next 16 et React 19).
- Le nom exact des nouveaux jetons de rôle (action, accent texte, tuile marque, surface profonde…).
- L'ordre de migration des usages actuels : `bg-forest`, `bg-ink`, `text-primary-foreground`, `text-forest`, etc.
