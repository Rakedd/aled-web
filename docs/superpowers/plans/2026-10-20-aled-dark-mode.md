# Aled — Mode sombre — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Ajouter un mode sombre « Anthracite + pêche » (C2) avec le choix Clair / Sombre / Système, sans flash au chargement et sans changer un seul pixel du mode clair.

**Architecture :**
- On sépare d'abord les rôles de couleur en jetons sémantiques **à valeurs claires égales** (action, accent texte, tuile marque, surface profonde, panneau lilas…). Ensuite, un seul bloc `:root[data-theme='dark']` dans `globals.css` redéfinit les valeurs. Les alias (`--background: var(--sage)`, `--ring: var(--primary)`…) suivent tout seuls, parce que `var()` est résolu sur `<html>`, qui porte les deux blocs.
- Pour éviter le flash, un petit script inline est placé dans le `<head>` du layout racine (Server Component). Il lit `localStorage`, pose `data-theme` sur `<html>` avant la première peinture, suit `prefers-color-scheme` en direct en mode Système et met à jour `theme-color`. `next-themes` n'est pas retenu : son `ThemeScript` rend un `<script>` depuis un composant client, ce qui déclenche l'avertissement React 19 « Encountered a script tag while rendering React component » (aucun correctif en 0.4.6). Le guide Next 16 « Preventing flash before hydration » recommande justement le script inline dans le layout.
- Le sélecteur « Thème » est un `Menu` base-ui (`role="menu"`, `menuitemradio`, flèches, Échap, focus rendu au bouton), placé dans `AppShell` avec un `useController` qui reçoit un store de préférence injecté.

**Tech Stack :** Next.js 16.4 (App Router), React 19.3, TypeScript strict, Tailwind v4 (`@theme inline`) + shadcn/base-ui 1.9 (`Menu`), lucide-react (`Sun`, `Moon`, `Monitor`, `Check`), FullCalendar 7.1.3 (thème classic, variables `--fc-classic-*`), Jest + React Testing Library.

**Spec :** [docs/superpowers/specs/2026-10-20-aled-dark-mode-design.md](../specs/2026-10-20-aled-dark-mode-design.md). Maquette (référence visuelle, la spec fait foi, y compris ses corrections) : `.superpowers/design/aled-dark/index.html`, variante C2.

## Global Constraints

- **Les Global Constraints du plan Atelier s'appliquent** (`docs/superpowers/plans/2026-10-19-freeclutch-atelier.md`) :
  - aucun `any`, fonctions fléchées, exports nommés (`export default` seulement pour les pages et layouts Next) ;
  - dossiers kebab-case (`interfaces.ts`, `index.ts`, `controller.tsx` avec un seul `useController` et des dépendances injectées) ;
  - pas de `console.log`, pas de commentaires, pas de code mort ;
  - guillemets simples, sans point-virgule ;
  - textes d'interface en français ;
  - « on ne teste pas des listes de classes » : les tons se vérifient par `data-tone`.
- **Thème uniquement par les jetons :**
  - aucune classe `dark:` dans un `.tsx` ;
  - pas de `@custom-variant dark`, pas de classe `.dark` ;
  - le seul bloc sombre est `:root[data-theme='dark'] { … }` dans `src/app/globals.css` ;
  - aucun hexadécimal hors de `globals.css` (fichiers de test exceptés).
- **Mode clair identique au pixel près :** toute valeur claire d'un nouveau jeton est la valeur actuelle de l'usage qu'il remplace (table ci-dessous). Aucune classe n'est ajoutée ou retirée en dehors de ce que la table de migration impose.
- **Contraste :** chaque paire texte / fond de la liste `ROLE_CONTRAST_PAIRS` (tâche 2) atteint au moins 4,5:1 **dans les deux thèmes**. La pêche du sombre ne porte jamais de texte discret.
- **Mémorisation :** clé `localStorage` `aled-theme`, valeurs `'light' | 'dark' | 'system'`. Une valeur absente ou invalide vaut `'system'`. Rien n'est stocké en base, aucun cookie.
- **Libellés exacts :** bouton `aria-label="Thème"`, menu `aria-label="Thème"`, choix « Clair », « Sombre », « Système » dans cet ordre, avec les icônes `Sun`, `Moon` et `Monitor` (`strokeWidth={1.75}`, `aria-hidden`).
- **Git :**
  - on commite sur la branche courante, sans pousser et sans créer de branche ;
  - les messages de commit n'ont aucune mention d'IA ni de ligne `Co-Authored-By` ;
  - livraison en un seul lot, déployée par la CI/CD une fois que le porteur a poussé.

### Table des jetons de rôle

La colonne « Clair » doit être exacte dès la tâche 1. La colonne « Sombre » est ajoutée à la tâche 2. Les jetons sans ligne ici (`--card`, `--surface-soft`, `--hairline`…) gardent leur nom.

| Jeton (`--…`) | Rôle | Clair | Sombre |
|---|---|---|---|
| `sage` | fond de page (`--background`) | `#F2F4F1` | `#171513` |
| `card` | surface | `#FFFFFF` | `#211E1B` |
| `surface-soft` | surface douce (`--muted`, `--secondary`) | `#F7F9F7` | `#2A2622` |
| `hairline` | filet, pastille « sauge » | `#E6ECE8` | `#34302B` |
| `hairline-strong` | filet appuyé | `#DDE3DE` | `#3C3732` |
| `control-border` | bordure de contrôle (`--input`) | `#C9D3CC` | `#423D37` |
| `ink` | texte (`--foreground`) | `#16231D` | `#F1ECE6` |
| `ink-secondary` | texte secondaire | `#3B4A42` | `#C8BFB5` |
| `ink-muted` | texte discret | `#55625B` | `#A0968B` |
| `primary` | **action** | `#1F5C46` | `#E9A27C` |
| `primary-foreground` | texte sur action | `#FFFFFF` | `#1A120C` |
| `accent-text` | **accent texte** (TJM, liens) | `#1F5C46` | `#EDB08E` |
| `brand-tile` | **tuile marque** | `#1F5C46` | `#2D4B3B` |
| `on-brand-tile` | texte fort sur tuile marque | `#FFFFFF` | `#F1ECE6` |
| `on-brand-tile-secondary` | texte secondaire sur tuile marque | `#CFE3D8` | `#D3DDCF` |
| `deep-surface` | **surface profonde** | `#16231D` | `#100E0C` |
| `on-deep-surface` | texte fort (carte clé Claude) | `#FFFFFF` | `#F1ECE6` |
| `on-deep-surface-secondary` | texte secondaire de la carte clé | `#E6ECE8` | `#C8BFB5` |
| `on-deep-surface-soft` | libellé du bouton encre et de la tuile « missions », contour de focus | `#CFE3D8` | `#C8BFB5` |
| `peach` | pêche (tuiles, pastilles, chiffre sur surface profonde) | `#FFB48A` | `#E9A27C` |
| `on-peach` | texte sur pêche | `#16231D` | `#1A120C` |
| `peach-tint` | fond des cartes « relance » | `#FFF1E8` | `#2D221A` |
| `peach-soft` | fond de la pastille « 7 à 14 j » | `#FFF1E8` | `#3A2A1E` |
| `peach-ink` | texte de la pastille « 7 à 14 j » | `#8A4B1F` | `#F2B48E` |
| `lilac` | lilas (tuiles, pastilles, compteur du menu en sombre) | `#DCD6F7` | `#C9BFE6` |
| `on-lilac` | texte sur lilas | `#16231D` | `#15132A` |
| `lilac-tint` | fond des cartes « fiche métier / client inconnu » | `#F2F0FC` | `#231F2C` |
| `lilac-soft` / `on-lilac-soft` | lilas doux | `#F2F0FC` / `#16231D` | `#2B2638` / `#D4CEF5` |
| `lilac-panel` | panneau lilas qui contient des contrôles (voir tâche 1) | `#DCD6F7` | `#2B2638` |
| `forest-soft` / `on-forest-soft` | forêt douce : pastille « récent », choix coché d'un menu | `#E6ECE8` / `#1F5C46` | `#26302A` / `#A9CBA9` |
| `clay` | texte terre (`--destructive`) | `#8A3B32` | `#F1A79D` |
| `clay-soft` | fond de la pastille terre | `#F1E3E1` | `#3A2420` |
| `clay-tint` | fond des cartes « sans nouvelles » | `#FBF1EF` | `#2D1E1B` |
| `popover` | surface de menu flottant | `#FFFFFF` | `#2A2622` |
| `menu-counter` / `on-menu-counter` | compteur « À traiter » du menu | `var(--peach)` / `var(--on-peach)` | `var(--lilac)` / `var(--on-lilac)` |
| `settings-navigation-active` / `on-settings-navigation-active` | lien actif du menu des préférences | `var(--deep-surface)` / `var(--on-deep-surface)` | `var(--primary)` / `var(--primary-foreground)` |

## Review Focus

1. **Premier passage en mode Système sur un appareil sombre, ou `localStorage` qui lève une exception** (Safari privé, stockage bloqué). La page doit s'afficher directement en sombre, sans erreur et sans flash. → Tâche 3 : test du script avec `getItem` qui lève et `matchMedia` sombre.
2. **L'appareil passe du sombre au clair pendant que la page est ouverte**, y compris sur la page de connexion, qui n'a pas de sélecteur. En Système, le thème suit en direct. Avec un choix explicite « Sombre », il ne bouge pas. → Tâche 3 : deux tests sur l'écouteur `change` posé par le script.
3. **Panneaux lilas qui contiennent un formulaire, en sombre** : « 1 · Colle l'annonce », « Mes données », tuile Préparation avec son `select`, son bouton encre et son message d'erreur. Libellés, liens, erreurs et champs doivent rester lisibles. → Tâche 2 : paires `ink-muted`, `destructive` et `accent-text` sur `lilac-panel` dans les deux thèmes.
4. **Calendrier en sombre** : entretiens pêche et lilas dans la vue semaine (texte foncé sur l'aplat), lignes de la vue liste (texte clair sur la surface), jour courant cerclé en pêche. → Tâche 2 : `contrastColor` par type d'entretien, et test CSS qui vérifie que `.fc-atelier-event` n'impose plus `var(--ink)`.
5. **« Mes opportunités » actif avec son compteur, et anneau de focus sur une action pêche, en sombre.** Le lien est pêche, le compteur lilas avec son texte lisible, et le focus reste visible sur la surface comme sur la page. → Tâche 2 : paires `on-menu-counter`/`menu-counter`, plus un contraste non textuel ≥ 3:1 de `primary` sur `card` et `sage` et de `on-deep-surface-soft` sur `deep-surface`. Tâche 4 : le ton `counter` du compteur dans `app-shell.test.tsx`.

---

### Task 1 : Séparer les rôles de couleur à valeurs claires égales

**Files :**
- Modify : `src/app/globals.css` (`:root`, `@theme inline`, `@utility focus-ring-on-dark`)
- Modify (migration, voir la table) : `src/components/ui/button.tsx`, `pill/pill.tsx`, `pill/interfaces.ts`, `pill-toggle/pill-toggle.tsx`, `status-badge/status-badge.tsx`, `pill-tabs/pill-tabs.tsx`, `app-shell/app-shell.tsx`, `settings-navigation/settings-navigation.tsx`, `home-dashboard/home-dashboard.tsx`, `job-application-highlights/job-application-highlights.tsx`, `opportunity-card/opportunity-card.tsx`, `opportunities-board/opportunities-board.tsx`, `activity-log/activity-log.tsx`, `interview-revision-panel/interview-revision-panel.tsx`, `anthropic-api-key-form/anthropic-api-key-form.tsx`, `new-job-application-form/new-job-application-form.tsx`, `markdown-content/markdown-content.tsx`, `header-view/header-view.tsx`, `missing-anthropic-api-key-notice/missing-anthropic-api-key-notice.tsx`, `interview-preparation-modal/interview-preparation-modal.tsx`, `contact-view/contact-view.tsx`, `interviews-calendar/interviews-calendar.css`, `interviews-calendar/controller.tsx`, `src/app/login/page.tsx`, `src/app/(app)/preferences/page.tsx`, `src/app/(app)/candidatures/[jobApplicationId]/page.tsx`
- Test : `src/app/atelier-theme.test.ts`, `src/components/ui/button.test.tsx`, `src/components/pill-toggle/pill-toggle.test.tsx`, `src/components/status-badge/status-badge.test.tsx`, `src/components/interviews-calendar/controller.test.tsx`

**Interfaces :**
- Produit (`globals.css`) :
  - `:root` contient tous les jetons de la table, avec la colonne « Clair » ;
  - `--primary` porte le hex directement ;
  - `--ring: var(--primary)` ;
  - `--forest` et `--on-forest` sont supprimés, ainsi que les jetons `--chart-*` et `--sidebar-*` et leurs entrées `@theme`, qu'aucun fichier n'utilise ;
  - `@theme inline` expose chaque nouveau jeton en `--color-<nom>: var(--<nom>)` ;
  - `@utility focus-ring-on-dark` dessine son contour en `var(--on-deep-surface-soft)`.
- Produit (`pill/interfaces.ts`) :
  ```ts
  type PillTone = 'neutral' | 'sage' | 'forest-soft' | 'brand' | 'action' | 'peach' | 'peach-soft' | 'lilac' | 'lilac-soft' | 'clay' | 'counter'
  ```
  - `forest` est remplacé par `brand` (« Signé ») et par `action` (`PillToggle` pressé) ;
  - `ink` est supprimé (aucun usage) ;
  - `counter` est nouveau (compteur du menu, branché à la tâche 4).
- Produit (`interviews-calendar/controller.tsx`) : `contrastColor` par ton :
  - `peach` → `'var(--on-peach)'` ;
  - `lilac` → `'var(--on-lilac)'` ;
  - `sage` → `'var(--ink)'`.

**Table de migration** (classe actuelle → classe cible) :

| Rôle | Fichiers | Avant → après |
|---|---|---|
| Action | `app-shell` (lien actif), `pill-tabs` (onglet choisi) | `bg-forest text-primary-foreground` (+ `hover:` équivalents) → `bg-primary text-primary-foreground` |
| Action | `interview-revision-panel` | `focus-visible:outline-forest` → `focus-visible:outline-ring` |
| Action | `interviews-calendar.css` | `var(--forest)` → `var(--primary)` (bouton actif, `--fc-classic-primary`, cercle du jour). `--fc-classic-button-outline` et `:focus-visible` → `var(--ring)` |
| Action | `job-application-header`, `stack-view`, `job-spec-section`, `interview-preparation-modal` (`border-primary/30`) | inchangés : `primary` est déjà le rôle action |
| Accent texte | `opportunity-card` (TJM), `opportunities-board` (lien Free-Work) | `text-forest` → `text-accent-text` |
| Accent texte | liens : `button.tsx` (variante `link`), `markdown-content`, `header-view`, `missing-anthropic-api-key-notice`, `interview-preparation-modal`, `contact-view`, lien retour de `candidatures/[jobApplicationId]/page.tsx` | `text-primary` → `text-accent-text` |
| Accent texte | `activity-log` (pastille de la frise) | `bg-forest` → `bg-accent-text` |
| Tuile marque | `home-dashboard` (« Bienvenue »), `job-application-highlights` (TJM) | `bg-forest text-on-forest` → `bg-brand-tile text-on-brand-tile-secondary` |
| Tuile marque | `login/page.tsx` | section : `bg-forest text-on-forest` → `bg-brand-tile text-on-brand-tile-secondary` ; logo et `h1` : `text-primary-foreground` → `text-on-brand-tile` |
| Tuile marque | `pill.tsx` ton `brand` (« Signé ») | `bg-brand-tile text-on-brand-tile` |
| Surface profonde | `button.tsx` variante `ink` | `bg-deep-surface font-bold text-on-deep-surface-soft hover:bg-deep-surface/90 focus-visible:border-deep-surface focus-visible:ring-2 focus-visible:ring-deep-surface focus-visible:ring-offset-2 focus-visible:ring-offset-card` |
| Surface profonde | `home-dashboard` (« missions à traiter ») | `bg-ink text-on-forest` → `bg-deep-surface text-on-deep-surface-soft`, le chiffre garde `text-peach` |
| Surface profonde | `preferences/page.tsx` (carte clé Claude) | `bg-ink text-primary-foreground` → `bg-deep-surface text-on-deep-surface` ; `text-hairline` → `text-on-deep-surface-secondary` ; `bg-primary-foreground/10` → `bg-on-deep-surface/10` |
| Surface profonde | `anthropic-api-key-form` | `text-hairline` (3) → `text-on-deep-surface-secondary` ; `border-hairline/30` → `border-on-deep-surface-secondary/30` ; `text-peach` et `text-ink` sur les contrôles inchangés |
| Menu des préférences | `settings-navigation` | `bg-ink text-primary-foreground hover:bg-ink hover:text-primary-foreground` → `bg-settings-navigation-active text-on-settings-navigation-active` (+ `hover:` équivalents) |
| Pêche | `home-dashboard` (prochain entretien), `job-application-highlights` (prochain entretien) | `bg-peach text-ink` → `bg-peach text-on-peach` |
| Lilas | `home-dashboard` (« candidatures en cours ») | `bg-lilac text-ink` → `bg-lilac text-on-lilac` ; `DAY_BLOCK_CLASS_NAMES[0]` `'bg-lilac'` → `'bg-lilac text-on-lilac'` |
| Panneau lilas | `job-application-highlights` (tuile Préparation), `preferences/page.tsx` (« Mes données »), `new-job-application-form` (« 1 · Colle l'annonce ») | `bg-lilac` → `bg-lilac-panel`, le texte garde les jetons normaux (`text-ink`, `text-ink-secondary`, `Label`, erreurs) |
| Tons de `Pill` | `pill.tsx` | `forest-soft` : `bg-forest-soft text-on-forest-soft` ; `peach` : `bg-peach text-on-peach` ; `peach-soft` : `bg-peach-soft text-peach-ink` ; `lilac` : `bg-lilac text-on-lilac` ; `lilac-soft` : `bg-lilac-soft text-on-lilac-soft` ; `action` : `bg-primary text-primary-foreground` ; `counter` : `bg-menu-counter text-on-menu-counter` ; `neutral`, `sage`, `clay` inchangés |
| Tons | `pill-toggle` | `isPressed ? 'forest'` → `isPressed ? 'action'` |
| Tons | `status-badge` | `signed: 'forest'` → `signed: 'brand'` |

Pourquoi un **panneau lilas** à part : en sombre, un aplat lilas `#C9BFE6` ne peut pas porter des champs `bg-muted`, des libellés `ink-muted` ni des erreurs terre (contraste 1,12:1 pour `#F1A79D`). En clair, sa valeur reste `#DCD6F7`, donc rien ne change. En sombre, il prend le lilas doux `#2B2638`, sur lequel tous les jetons de texte habituels passent 4,5:1.

- [ ] **Step 1 : Tests qui échouent**
  - `atelier-theme.test.ts` :
    - remplacer `extractRootColours` par `resolveThemeColours(): Record<string, string>`. Elle lit le bloc `:root { … }` et suit les `var(--x)` jusqu'à un hex ;
    - nouveau test `keeps every light colour at its current value` : `expect(resolveThemeColours()).toMatchObject({...})` avec **toute** la colonne « Clair » de la table, `menu-counter` et `settings-navigation-active` compris, plus `background: '#F2F4F1'`, `foreground: '#16231D'`, `ring: '#1F5C46'`, `destructive: '#8A3B32'`, `muted: '#F7F9F7'`, `input: '#C9D3CC'` ;
    - nouveau test `no component uses a retired colour class`. Aucun `.ts`/`.tsx` sous `src` (tests exclus) ne correspond à `/\b(bg|text|border|ring|outline)-(forest|on-forest)\b(?!-)/`, `/\b(bg|ring|border)-ink\b(?![-/])/`, `/\btext-primary\b(?!-)/` ni `/\btext-hairline\b/` ;
    - mettre à jour : contour de `focus-ring-on-dark` en `var(--on-deep-surface-soft)`, et carte clé Claude avec `bg-deep-surface` et `focus-ring-on-dark` ;
    - `CONTRAST_PAIRS` (qui cite `forest` et `on-forest`, supprimés) est remplacée par `ROLE_CONTRAST_PAIRS`, la liste complète de la tâche 2, testée ici sur le thème clair seulement : tout doit déjà passer 4,5:1 avec les valeurs claires.
  - `button.test.tsx` : la variante `ink` contient `bg-deep-surface`, `text-on-deep-surface-soft`, `hover:bg-deep-surface/90`, `focus-visible:ring-deep-surface` ; la variante `link` contient `text-accent-text`.
  - `pill-toggle.test.tsx` : `data-tone="action"` une fois pressé (au lieu de `forest`).
  - `status-badge.test.tsx` : `signed` → `data-tone="brand"`.
  - `interviews-calendar/controller.test.tsx` : `EVENT_STYLES_BY_KIND` attend `contrastColor` `'var(--on-peach)'` (client), `'var(--on-lilac)'` (mock), `'var(--ink)'` (other).
- [ ] **Step 2 :** `npm test -- atelier-theme button pill-toggle status-badge interviews-calendar`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter `globals.css`, puis appliquer la table de migration. Ensuite, `grep -rn "forest\|bg-ink\|text-primary\b\|text-hairline" src --include='*.tsx'` ne doit plus montrer que `forest-soft`, `text-primary-foreground` à côté de `bg-primary`, et `hover:bg-ink/10` (survol de `keyword-tags-input`, qui reste un voile d'encre).
- [ ] **Step 4 :** `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 : Contrôle visuel du clair.** `npm run dev`, puis comparer avec `main` avant la tâche, au même zoom, sur : accueil, fiche candidature (tuiles + onglets + étape courante), Mes candidatures (pastilles d'ancienneté), Mes opportunités (onglet actif, compteur, TJM), calendrier (mois, semaine, liste), Préférences (carte clé, Mes données, menu des préférences), nouvelle candidature, connexion. Attendu : aucune différence.
- [ ] **Step 6 :** Commit `refactor(design): split colour roles into semantic tokens at equal light values`.

### Task 2 : Bloc sombre C2 et contrastes des deux thèmes

**Files :**
- Modify : `src/app/globals.css`, `src/components/interviews-calendar/interviews-calendar.css`
- Test : `src/app/atelier-theme.test.ts`, `src/components/interviews-calendar/interviews-calendar-styles.test.ts`

**Interfaces :**
- Consomme : les jetons de la tâche 1.
- Produit (`globals.css`) :
  - `:root { color-scheme: light; … }` ;
  - juste après `:root`, un bloc `:root[data-theme='dark'] { color-scheme: dark; … }` qui redéfinit **uniquement** les jetons de la colonne « Sombre » (les hex, plus les quatre alias `menu-counter`, `on-menu-counter`, `settings-navigation-active` et `on-settings-navigation-active`) ;
  - les alias shadcn (`--background`, `--foreground`, `--muted`, `--border`, `--ring`…) ne sont pas répétés ;
  - les ombres ne changent pas : `shadow-md` et `shadow-xl` sont du noir à 10 %, presque invisible sur l'anthracite, ce qui répond à « très légères ». Le menu flottant a un filet (tâche 4).
- Produit (`interviews-calendar.css`) : la déclaration `color: var(--ink)` de `.interviews-calendar .fc-atelier-event` est supprimée. Les aplats prennent alors `--fc-event-contrast-color` (le `contrastColor` par type de la tâche 1), et les lignes de liste prennent `--fc-classic-foreground` (`var(--ink)`). Aucune variable FullCalendar propre au sombre : elles pointent toutes sur des jetons.

- [ ] **Step 1 : Tests qui échouent** (`atelier-theme.test.ts`)
  - `resolveThemeColours` prend un paramètre `theme: 'light' | 'dark'`. Elle fusionne `:root` et, pour `'dark'`, le bloc `:root[data-theme='dark']`, puis résout les `var()` ;
  - `pins every dark colour from the spec` : `expect(resolveThemeColours('dark')).toMatchObject({...})` avec toute la colonne « Sombre », alias résolus compris (`'menu-counter': '#C9BFE6'`, `'on-settings-navigation-active': '#1A120C'`, `background: '#171513'`, `ring: '#E9A27C'`) ;
  - `ROLE_CONTRAST_PAIRS: Array<[string, string]>`, testé avec `describe.each(['light', 'dark'])` puis `it.each(ROLE_CONTRAST_PAIRS)` ≥ 4,5 :
    `ink/sage`, `ink-secondary/sage`, `ink-muted/sage`, `ink/card`, `ink-muted/card`, `ink-muted/surface-soft`, `ink/hairline`, `ink-muted/hairline`, `ink/popover`, `primary-foreground/primary`, `accent-text/card`, `accent-text/sage`, `accent-text/surface-soft`, `on-brand-tile/brand-tile`, `on-brand-tile-secondary/brand-tile`, `on-deep-surface/deep-surface`, `on-deep-surface-secondary/deep-surface`, `on-deep-surface-soft/deep-surface`, `peach/deep-surface`, `on-peach/peach`, `on-lilac/lilac`, `ink/peach-tint`, `ink-muted/peach-tint`, `peach-ink/peach-soft`, `ink/lilac-tint`, `ink-muted/lilac-tint`, `on-lilac-soft/lilac-soft`, `ink/lilac-panel`, `ink-secondary/lilac-panel`, `ink-muted/lilac-panel`, `destructive/lilac-panel`, `accent-text/lilac-panel`, `on-forest-soft/forest-soft`, `clay/clay-soft`, `clay/clay-tint`, `ink/clay-tint`, `ink-muted/clay-tint`, `destructive/card`, `destructive/sage`, `on-menu-counter/menu-counter`, `on-settings-navigation-active/settings-navigation-active` ;
  - `keeps focus indicators visible` (≥ 3:1, deux thèmes) : `primary/card`, `primary/sage`, `on-deep-surface-soft/deep-surface` ;
  - `ships one dark token block and no dark variant` remplace `does not ship a dark mode in the stylesheet` : exactement une occurrence de `:root[data-theme='dark']`, et ni `.dark` ni `@custom-variant dark` ;
  - `does not use dark variants in any component` reste tel quel ;
  - `keeps hex colours inside globals.css` : aucun `.ts`, `.tsx` ou `.css` sous `src` (sauf `globals.css` et `*.test.*`) ne correspond à `/#[0-9A-Fa-f]{3,8}\b/`.
- [ ] **Step 2 : Test calendrier qui échoue** (`interviews-calendar-styles.test.ts`) : `lets events take their per-kind contrast colour`, avec `expect(componentCss).not.toMatch(/\.fc-atelier-event\s*\{[^}]*color:\s*var\(--ink\)/)`.
- [ ] **Step 3 :** `npm test -- atelier-theme interviews-calendar`. Attendu : FAIL.
- [ ] **Step 4 :** Implémenter le bloc sombre et retirer la déclaration de couleur.
- [ ] **Step 5 :** `npm test && npm run lint && npm run build`. Attendu : PASS. Puis, dans le navigateur, poser `document.documentElement.dataset.theme = 'dark'` à la main et parcourir les pages de l'étape 5 de la tâche 1, en particulier les points 3 à 5 de la Review Focus. Retirer l'attribut : le clair est identique.
- [ ] **Step 6 :** Commit `feat(design): anthracite and peach dark tokens with contrast checks for both themes`.

### Task 3 : Application du thème sans flash

**Files :**
- Create : `src/lib/theme/theme-preference.ts`, `src/lib/theme/theme-init-script.ts`
- Modify : `src/app/layout.tsx`
- Test : `src/lib/theme/theme-preference.test.ts`, `src/lib/theme/theme-init-script.test.ts`, `src/app/layout.test.tsx`

**Interfaces :**
- Produit (`theme-preference.ts`) :
  ```ts
  export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const
  export type ThemePreference = (typeof THEME_PREFERENCES)[number]
  export type ResolvedTheme = 'light' | 'dark'
  export const THEME_STORAGE_KEY = 'aled-theme'
  export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
  export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string>
  export const parseThemePreference: (storedValue: string | null) => ThemePreference
  export const resolveTheme: (preference: ThemePreference, prefersDarkColorScheme: boolean) => ResolvedTheme
  export type ThemePreferenceStore = {
    read: () => ThemePreference
    save: (preference: ThemePreference) => void
    subscribe: (listener: () => void) => () => void
  }
  export const browserThemePreferenceStore: ThemePreferenceStore
  ```
  - `THEME_PREFERENCE_LABELS` vaut `{ light: 'Clair', dark: 'Sombre', system: 'Système' }` ;
  - `read` lit `localStorage` dans un `try` et renvoie `'system'` en cas d'échec ;
  - `save` écrit dans `localStorage` (dans un `try`), applique tout de suite le thème résolu (`document.documentElement.dataset.theme` et la balise `meta[name="theme-color"]`), puis prévient les abonnés.
- Produit (`theme-init-script.ts`) : `export const THEME_INIT_SCRIPT: string`. C'est une IIFE ES5 autonome : pas de hex, pas de `</script>`, tout dans un `try`. Elle fait quatre choses :
  - lire `localStorage[THEME_STORAGE_KEY]` (une erreur vaut `'system'`) ;
  - poser `data-theme` sur `<html>` avec `'light'` ou `'dark'` ;
  - créer ou mettre à jour `meta[name="theme-color"]` avec la valeur calculée de `--background`. Si elle est vide, parce que la feuille n'est pas encore chargée, on recommence une fois au `DOMContentLoaded` ;
  - écouter `change` sur `matchMedia(DARK_COLOR_SCHEME_QUERY)` et réappliquer **seulement si** la préférence relue vaut `'system'`.
  Les constantes viennent de `theme-preference.ts`, interpolées dans la chaîne.
- Produit (`layout.tsx`) : `<html … suppressHydrationWarning>` et `<head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>` avant `<body>`. Le layout reste un Server Component, et on garde le style actuel du fichier.

- [ ] **Step 1 : Tests qui échouent**
  - `theme-preference.test.ts` :
    - `parseThemePreference` : `'dark'` → `'dark'`, `null` → `'system'`, `'sepia'` → `'system'` ;
    - `resolveTheme` : (`'system'`, `true`) → `'dark'`, (`'system'`, `false`) → `'light'`, (`'light'`, `true`) → `'light'` ;
    - `browserThemePreferenceStore.save('dark')` : `localStorage.getItem('aled-theme') === 'dark'`, `document.documentElement.dataset.theme === 'dark'`, et l'abonné est appelé une fois ;
    - `save('system')` avec `matchMedia` sombre → `data-theme` vaut `'dark'` ;
    - `read()` quand `getItem` lève → `'system'`.
  - `theme-init-script.test.ts` exécute `new Function(THEME_INIT_SCRIPT)()` après avoir bouchonné `window.matchMedia` (objet avec `matches` et `addEventListener`) et `window.getComputedStyle` (qui renvoie `'canvas'` pour `--background`) :
    - rien en mémoire et appareil sombre → `data-theme="dark"` (Review Focus 1) ;
    - `getItem` qui lève et appareil sombre → `data-theme="dark"`, sans exception (Review Focus 1) ;
    - `'light'` en mémoire et appareil sombre → `data-theme="light"` ;
    - en Système, l'écouteur `change` déclenché avec `matches: false` → `data-theme="light"` (Review Focus 2) ;
    - avec `'dark'` en mémoire, le même événement laisse `data-theme="dark"` (Review Focus 2) ;
    - une balise `meta[name="theme-color"]` existe avec `content="canvas"` ;
    - la chaîne ne contient ni `#` suivi d'un hex, ni `</script>`.
  - `layout.test.tsx` bouchonne `next/font/google` (`Manrope` et `Figtree` renvoient `{ variable: 'font' }`). Avec `renderToStaticMarkup(<RootLayout>…</RootLayout>)`, le balisage contient `<head><script>${THEME_INIT_SCRIPT}</script>`, et ce script vient avant `<body`.
- [ ] **Step 2 :** `npm test -- theme-preference theme-init-script layout`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter les deux modules et le layout.
- [ ] **Step 4 :** `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS. Puis, en `npm run build && npm run start`, avec un appareil en sombre et le cache vidé, recharger `/login` et `/` : aucun flash clair, aucun avertissement d'hydratation dans la console. `localStorage.setItem('aled-theme', 'light')` suivi d'un rechargement donne le clair.
- [ ] **Step 5 :** Commit `feat(theme): apply the remembered theme before first paint`.

### Task 4 : Sélecteur « Thème » dans le menu en pilule

**Files :**
- Create : `src/components/theme-menu/{theme-menu.tsx,controller.tsx,interfaces.ts,index.ts,theme-menu.test.tsx}`
- Modify : `src/components/app-shell/app-shell.tsx` (sélecteur et ton `counter`)
- Test : `src/components/theme-menu/theme-menu.test.tsx`, `src/components/app-shell/app-shell.test.tsx`

**Interfaces :**
- Consomme : `ThemePreference`, `ThemePreferenceStore`, `browserThemePreferenceStore`, `THEME_PREFERENCES`, `THEME_PREFERENCE_LABELS` et `parseThemePreference` (tâche 3) ; les tons `forest-soft` et `counter` (tâche 1).
- Produit :
  ```ts
  type ThemeMenuProps = { themePreferenceStore?: ThemePreferenceStore }
  const ThemeMenu: (props: ThemeMenuProps) => JSX.Element
  const useController: (dependencies: { themePreferenceStore: ThemePreferenceStore }) => {
    themePreference: ThemePreference
    selectThemePreference: (value: string) => void
  }
  ```
  - `themePreferenceStore` vaut `browserThemePreferenceStore` par défaut ;
  - `useController` utilise `useSyncExternalStore(store.subscribe, store.read, () => 'system')`. Le rendu serveur et l'hydratation montrent donc l'écran, puis l'icône réelle ;
  - `selectThemePreference` passe par `parseThemePreference`, puis appelle `store.save`. Le composant l'appelle avec `String(value)`, car base-ui ne type pas la valeur du groupe radio.
- Rendu (`Menu` de `@base-ui/react/menu`) :
  - `Menu.Trigger` rend `Button variant="outline" size="icon"` (44 px) avec `aria-label="Thème"`. Son icône suit la préférence : `Sun` pour `light`, `Moon` pour `dark`, `Monitor` pour `system`, chacune avec `data-icon="sun" | "moon" | "monitor"` ;
  - `Menu.Popup` porte `aria-label="Thème"` et les classes `rounded-2xl border border-hairline bg-popover p-1.5` ;
  - `Menu.RadioGroup value={themePreference} onValueChange={selectThemePreference}` contient trois `Menu.RadioItem` (`h-11`, icône et libellé de `THEME_PREFERENCE_LABELS`, `Menu.RadioItemIndicator` avec `Check`) ;
  - le choix coché est en `bg-forest-soft text-on-forest-soft`, avec les attributs d'état exposés par base-ui.
- `AppShell` :
  - `<ThemeMenu />` est placé entre l'e-mail et le `<form>` « Se déconnecter » ;
  - le compteur passe de `<Pill tone="peach">` à `<Pill tone="counter">`.

- [ ] **Step 1 : Tests qui échouent**
  - `theme-menu.test.tsx` passe un store en mémoire (`read`, `save` en `jest.fn` qui notifie, `subscribe`), sauf pour un dernier test d'intégration avec le store du navigateur :
    - sans choix enregistré, le bouton « Thème » montre `[data-icon="monitor"]` ;
    - un clic ouvre `getByRole('menu', { name: 'Thème' })` avec trois `menuitemradio` dans l'ordre Clair, Sombre, Système, et « Système » a `aria-checked="true"` ;
    - un clic sur « Sombre » appelle `save('dark')`, ferme le menu, rend le focus au bouton, et l'icône devient `[data-icon="moon"]` ;
    - clavier : focus sur le bouton, `ArrowDown` ouvre et place le focus dans le menu, `ArrowDown` passe au suivant, `Escape` ferme et rend le focus au bouton ;
    - avec `read` qui renvoie `'light'` au montage : `[data-icon="sun"]`, et « Clair » est coché ;
    - avec `browserThemePreferenceStore` : choisir « Sombre » donne aussitôt `document.documentElement.dataset.theme === 'dark'` et `localStorage['aled-theme'] === 'dark'`.
  - `app-shell.test.tsx` :
    - le test du compteur attend `data-tone="counter"` (au lieu de `peach`), avec le même nom accessible ;
    - nouveau test : le bouton « Thème » précède immédiatement « Se déconnecter » dans le DOM (`compareDocumentPosition`).
  - Si base-ui a besoin de `ResizeObserver` ou de `PointerEvent` sous jsdom, ajouter un bouchon minimal dans le fichier de test, pas dans `jest.setup.ts`.
- [ ] **Step 2 :** `npm test -- theme-menu app-shell`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter `ThemeMenu` et le brancher dans `AppShell`.
- [ ] **Step 4 :** `npm test && npm run lint && npm run typecheck`. Attendu : PASS. À 360 px, le menu en pilule passe à la ligne sans défilement horizontal, et le menu flottant reste dans l'écran.
- [ ] **Step 5 :** Commit `feat(theme): light, dark and system choice in the pill menu`.

### Task 5 : Vérification finale et README

**Files :**
- Modify : `README.md` (section « Identité Atelier »)

- [ ] **Step 1 :** Mettre à jour `README.md` :
  - **Jetons** : les jetons de rôle (`primary` = action, `accent-text`, `brand-tile`, `deep-surface`, `lilac-panel`, `menu-counter`…) et le bloc `:root[data-theme='dark']` ;
  - « Aucun hexadécimal ni classe `dark:` dans les composants » est conservé, et « mode clair seulement » est retiré ;
  - **Tons de `Pill`** : `neutral`, `sage`, `forest-soft`, `brand`, `action`, `peach`, `peach-soft`, `lilac`, `lilac-soft`, `clay`, `counter` ;
  - **Thème** : Clair / Sombre / Système dans le menu en pilule, mémorisé dans `localStorage` (`aled-theme`), appliqué avant la première peinture par le script de `src/lib/theme/theme-init-script.ts` ;
  - **Contraste** : ≥ 4,5:1 dans les deux thèmes, vérifié par `atelier-theme.test.ts`.
- [ ] **Step 2 :** `npm test && npm run test:tz && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 3 :** Parcours manuel en `npm run start`, en Clair, Sombre puis Système (en basculant le réglage de l'appareil page ouverte) : les cinq points de la Review Focus, la carte clé Claude (focus visible au clavier sur « Remplacer » et sur le champ), et le dialogue de suppression d'une candidature.
- [ ] **Step 4 :** Commit `docs: dark mode tokens and theme choice in the readme`. Le porteur pousse, puis le contrôleur vérifie le run GitHub Actions « CI/CD » et le déploiement Vercel.
