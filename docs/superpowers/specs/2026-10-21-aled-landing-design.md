# Aled — Landing page `aled.work` — Document de conception

Date : 2026-10-21
Statut : brouillon, à valider

La landing vit dans le même projet Next.js que l'app. Toutes les contraintes des documents précédents restent valables : conventions de code du porteur, identité Atelier (`2026-10-19-freeclutch-design-atelier-design.md`), mode sombre (`2026-10-20-aled-dark-mode-design.md`), accessibilité, 360 px, tests. Les décisions marquées **[choix du rédacteur]** n'ont pas été demandées explicitement par le porteur.

**Maquette de référence** : `.superpowers/brainstorm/44159-1792545134/content/full-page-v1.html` (locale, ignorée par git), validée par le porteur. Les logos sont dans `public/brand/` (`aled-logo-on-light.png`, `aled-logo-on-dark.png`).

---

## 1. Intention

Quelqu'un qui cherche du boulot arrive sur `aled.work`, le plus souvent depuis un lien partagé, sur son téléphone. En cinq secondes, il doit se dire : « c'est l'outil qui va m'accompagner, de la candidature jusqu'à mon premier jour ».

Sa douleur : il postule sur des dizaines de sites, puis tout se perd dans sa boîte mail. Qui a répondu, qui relancer, pour quelle mission était cet appel. Aled rassemble tout et l'accompagne à chaque étape.

La landing sort **en même temps** que l'inscription publique de l'app. Avant ce lancement, elle n'est pas publique (voir §7).

**Objectifs** :
- faire comprendre la promesse « du premier clic au premier jour » ;
- envoyer le visiteur vers l'inscription ;
- être partageable : ton taquin, aperçu soigné sur les réseaux, pour faire parler d'Aled ;
- être rapide, y compris sur mobile.

**Hors périmètre** :
- l'inscription elle-même (page, compte, accueil) : c'est un projet séparé, conçu ensuite ;
- le CDI : la cible est pour l'instant la recherche de missions, mais les textes ne ferment pas la porte ;
- tarifs, blog, liste d'attente, newsletter, langues autres que le français.

**Anti-objectifs** :
- le mot « freelance » où que ce soit dans les textes visibles (demande du porteur) : on parle de missions, de projets, de boulot ;
- une promesse que l'app ne tiendra pas au lancement ;
- se moquer d'une marque ou d'une personne nommée : on se moque de la galère, pas des autres. Aucun nom de plateforme dans les textes **[choix du rédacteur]** ;
- une landing ralentie par l'authentification ou par Supabase ;
- le contenu de la landing indexé aussi sous `app.aled.work`, ou l'app indexée par les moteurs ;
- un flash de mauvais thème au chargement.

## 2. Contenu

Ton **taquin** d'un bout à l'autre (choix du porteur : « ça se démarque plus »). Les textes ci-dessous sont ceux de la maquette validée. Le porteur les peaufinera plus tard : ils doivent donc vivre à un seul endroit du code, faciles à modifier **[choix du rédacteur]**.

### Barre du haut
Logo Aled (version claire ou sombre selon le thème, comme dans le header de l'app), sélecteur de thème, lien « Se connecter ».

### 1. Accroche
- Titre (seul `h1` de la page) : « Trouver du boulot ~~en traversant la rue~~ depuis ton canapé. » Le passage « en traversant la rue » est barré visuellement, avec un trait pêche épais. Il doit rester compréhensible pour un lecteur d'écran, par exemple via `<del>` ou un texte alternatif. La technique est laissée au builder.
- Sous-titre : « Les missions arrivent toutes seules, Aled suit tes candidatures, te dit qui relancer et prépare tes entretiens. Toi, tu choisis. »
- Bouton : « Je reste sur mon canapé » → inscription (§3).

### 2. La douleur
- Titre : « 300 sites. 1 boîte mail. **0 idée** de qui t'a répondu. », avec « 0 idée » surligné en pêche.
- Texte : « Tu postules partout, et après ? Les réponses se perdent entre deux newsletters, tu relances la mauvaise personne et tu découvres un entretien la veille. »
- Illustration : une pile de quatre faux e-mails décalés, en HTML et CSS, pas en image :
  - « **Re: Re: Fwd:** Mission React — 3 mois — Lyon ? »
  - « **Votre candidature a bien été reçue** (laquelle ?) »
  - « **Toujours dispo ?** On en parle demain ? »
  - « **Rappel :** entretien demain 9 h (avec qui déjà ?) »

  Cette illustration est décorative pour les lecteurs d'écran.

### 3. Le parcours
- Titre : « Du premier clic au premier jour. »
- Texte : « Aled t'accompagne à chaque étape. Tu n'as plus qu'à être bon en entretien. »
- Sept étapes numérotées, en grille. La dernière est mise en valeur sur la surface profonde :
  1. **Trouver** : « Les missions qui te correspondent arrivent toutes seules. Fini le tour des 300 sites. »
  2. **Postuler** : « Un clic, c'est noté. Tu sais toujours où tu as envoyé quoi. »
  3. **Suivre** : « Qui t'a répondu, qui t'a ghosté, quel intermédiaire pour quelle mission : tout est là. »
  4. **Relancer** : « Aled te dit qui relancer avant que tu oublies. Toi, tu as l'air organisé. »
  5. **Préparer l'entretien** : « Le brief du client et ta préparation, prêts avant le café. »
  6. **Relire le contrat** : « Les clauses qui piquent, repérées avant que tu signes. »
  7. **Premier jour** : « Là, on te laisse. Il te reste juste à trouver la machine à café. »

  La relecture du contrat n'existe pas encore dans l'app. Le porteur s'engage à la livrer avant le lancement : elle est présentée comme les autres étapes, **sans** étiquette « bientôt » (décision du porteur).

### 4. Cri du cœur (conclusion)
Sur le fond vert de marque, centré :
- le logo, en version pour fond sombre ;
- titre, guillemets compris : « ALED, je sais plus à qui j'ai postulé. » ;
- texte : « Normal. Aled s'en souvient pour toi. » ;
- bouton pêche : « Aled, sauve-moi » → inscription (§3).

### Pied de page
« © Aled » et liens « Mentions légales » et « Confidentialité ».

## 3. Comportement

- **Boutons d'appel à l'action** (accroche et conclusion) : ce sont des liens vers la page d'inscription de l'app, `{APP_ORIGIN}/inscription`. Le nom de route `/inscription` est un **[choix du rédacteur]**, cohérent avec les routes françaises de l'app (`/candidatures`, `/opportunites`). Cette page sera livrée par le projet « inscription ». Ce n'est pas un bloquant, puisque la landing n'est pas publique avant (§7).
- **« Se connecter »** : lien vers `{APP_ORIGIN}/login`.
- **Thème** : mêmes trois choix que l'app (Clair, Sombre, Système), mêmes tokens, même script anti-flash dans le `<head>`. Le sélecteur de thème de l'app (`ThemeMenu`) est réutilisé dans la barre du haut **[choix du rédacteur]**. Le navigateur sépare le stockage de `aled.work` et celui de `app.aled.work`, donc le choix n'est pas partagé entre les deux domaines. C'est accepté.
- **Mesure d'audience** : Vercel Web Analytics (`@vercel/analytics`), choix du porteur, chargé **uniquement** sur la landing **[choix du rédacteur]**. Il ne pose pas de cookie, donc aucun bandeau de consentement n'est nécessaire. La page Confidentialité le mentionne.
- **Partage sur les réseaux** : titre, description et image d'aperçu de 1200×630 px (fond vert de marque, logo, accroche) pour LinkedIn, X, WhatsApp et Slack **[choix du rédacteur]**. URL canonique : `https://aled.work`.
- **Référencement** :
  - landing indexable, avec un `sitemap.xml` ;
  - app non indexable : `robots.txt` qui interdit tout sur `app.aled.work`, et `noindex` sur les pages de l'app ;
  - le `robots.txt` servi dépend donc du domaine.
- **Pages légales**, sur le domaine de la landing :
  - `/mentions-legales` : éditeur, directeur de publication, hébergeur (Vercel Inc.), contact. Le porteur fournira ces informations plus tard (décision du porteur). En attendant, la page affiche des emplacements visiblement marqués, par exemple `[À COMPLÉTER : nom de l'éditeur]`. Seules les coordonnées de l'hébergeur sont écrites définitivement ;
  - `/confidentialite` : données collectées par la landing, c'est-à-dire aucune hormis la mesure d'audience sans cookie. Cette page deviendra la politique de confidentialité unique d'Aled : la partie qui concerne l'app (compte, candidatures, clé API) sera ajoutée par le projet « inscription », qui crée les premiers comptes publics. En attendant, la page ne renvoie vers aucune page inexistante **[choix du rédacteur]**.

## 4. Architecture

### Routage par domaine
- Le proxy (`src/proxy.ts`) regarde d'abord le nom d'hôte.
- **Domaines de la landing** : une liste lue dans la variable d'environnement `LANDING_HOSTNAMES`, séparée par des virgules. Production : `aled.work,www.aled.work`. Local : `aled.localhost`, que Chrome et Firefox résolvent nativement vers 127.0.0.1.
- **Sur un domaine de landing** : le proxy réécrit le chemin vers le segment interne `/vitrine` (`/` → `/vitrine`, `/mentions-legales` → `/vitrine/mentions-legales`, etc.). Il renvoie la réponse **avant** de créer le client Supabase : aucune session, aucun appel réseau. `www.aled.work` redirige de façon permanente vers `aled.work` **[choix du rédacteur]**.
- **Chemins de l'app demandés sur le domaine de la landing** (`/login`, `/auth/confirm`, `/candidatures/...`, `/api/...`, etc.) : redirection permanente vers le même chemin sur `{APP_ORIGIN}`. Aujourd'hui, Vercel redirige `aled.work` vers l'app en gardant le chemin : les favoris et les liens déjà partagés continuent donc de fonctionner après le lancement. Tout autre chemin inconnu renvoie la 404 de la landing. Le mécanisme est laissé au builder : le matcher du proxy exclut aujourd'hui `/api` **[choix du rédacteur]**.
- **Sur tout autre domaine** : le proxy se comporte exactement comme aujourd'hui. Un accès direct à `/vitrine` y renvoie une 404, pour ne pas dupliquer la landing sous `app.aled.work`.
- **Exception pour la relecture** : sur les déploiements de prévisualisation Vercel (`VERCEL_ENV !== 'production'`) et en développement, `/vitrine` reste accessible directement. Le porteur peut ainsi relire la landing avant le lancement, sans DNS **[choix du rédacteur]**.

### Liens vers l'app
- Variable d'environnement `APP_ORIGIN`, par exemple `https://app.aled.work` en production et `http://localhost:3000` en local.
- Aucun domaine n'est écrit en dur dans le code, comme aujourd'hui.
- Les deux nouvelles variables vont dans `.env.example` et dans le README.

### Fichiers
- Segment `src/app/vitrine/` : layout propre à la landing, sans `AppShell` ni appel serveur authentifié, avec la page d'accueil, `mentions-legales`, `confidentialite` et l'image d'aperçu.
- Le layout racine (polices, script de thème) reste partagé.
- Les pages de la landing sont **statiques** (prérendues au build).
- Le découpage en composants suit les conventions du porteur : un dossier par composant, `interfaces.ts`, `index.ts`, et un `useController` seulement si la logique le justifie.

### À vérifier par le builder
- Le matcher du proxy laisse déjà passer les images et `/_next`. L'image d'aperçu et le `robots.txt` doivent être servis correctement sur chaque domaine.
- Les en-têtes de sécurité de `next.config.ts` s'appliquent aussi à la landing. C'est voulu.

## 5. Design

- **Identité Atelier :**
  - tokens de `globals.css` uniquement, aucun hexadécimal ni classe `dark:` dans les composants (règle vérifiée par `atelier-theme.test.ts`) ;
  - Manrope pour les titres, Figtree pour le texte ;
  - pilules et grands rayons.
- **Couleurs par section :**
  - fond de page `--background` ;
  - douleur sur `--card` ;
  - dernière étape du parcours sur `--deep-surface` ;
  - conclusion sur `--brand-tile`, avec le bouton en `--peach` / `--on-peach`.

  Les deux thèmes doivent être lisibles, avec les contrastes minimums déjà testés pour l'app.
- **Mobile d'abord :** lisible et sans défilement horizontal dès 360 px. Sur mobile, les étapes du parcours passent sur une colonne.
- **Accessibilité :**
  - un seul `h1`, une hiérarchie de titres correcte ;
  - focus visible ;
  - textes alternatifs des logos (« Aled ») ;
  - illustration de mails décorative ;
  - animations, s'il y en a, désactivées avec `prefers-reduced-motion`.
- **Performance :** pas de JavaScript client au-delà du sélecteur de thème et de la mesure d'audience.

## 6. Tests

Conformément aux règles du porteur, les tests font partie de la fonctionnalité :
- **Proxy :**
  - domaine de landing → réécriture vers `/vitrine`, sans appel à Supabase ;
  - `www` → redirection ;
  - chemin de l'app sur le domaine de la landing → redirection vers `{APP_ORIGIN}` avec le même chemin ;
  - `/vitrine` sur le domaine de l'app en production → 404 ;
  - `/vitrine` en prévisualisation → accessible ;
  - domaine de l'app → comportement inchangé (tests existants).
- **Pages :** présence des sections et textes clés ; les deux boutons pointent vers `{APP_ORIGIN}/inscription` et « Se connecter » vers `{APP_ORIGIN}/login`.
- **Garde-fou :** aucun texte de la landing ne contient le mot « freelance », quelle que soit la casse.
- **Garde-fou du lancement :** un test vérifie qu'il ne reste aucun emplacement `[À COMPLÉTER` dans les pages légales. Il est marqué comme ignoré (`it.skip` ou équivalent, avec la mention « à activer avant le lancement ») tant que le porteur n'a pas fourni les informations. L'activer fait partie de la checklist du §7 **[choix du rédacteur]**.
- **Référencement :** `robots.txt` différent selon le domaine.
- **Mesure d'audience :** présente dans le layout de la landing, absente de l'app.

## 7. Mise en ligne

1. La landing est développée et relue sur les déploiements de prévisualisation (`/vitrine`). Pendant ce temps, `aled.work` continue de rediriger vers `app.aled.work` (procédure « Domaine de production » du README).
2. Prérequis du lancement :
   - l'inscription publique existe sur `app.aled.work/inscription` ;
   - la relecture du contrat est livrée ;
   - les emplacements des mentions légales sont remplis et le test de garde-fou correspondant est activé ;
   - la politique de confidentialité couvre l'app.
3. Le jour du lancement :
   - dans Vercel, renseigner `LANDING_HOSTNAMES` et `APP_ORIGIN` pour la production ;
   - activer Web Analytics sur le projet ;
   - retirer la redirection de `aled.work` ;
   - déployer.
4. Le README documente le routage par domaine, les deux variables et la façon d'ouvrir la landing en local (`http://aled.localhost:3000`).
