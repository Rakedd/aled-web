# Freeclutch « Atelier » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Livrer la refonte visuelle « Atelier » en six lots déployables seuls : fondations, accueil Bento, fiche en onglets, « À faire » en une ligne, opportunités avec filtres rapides, puis calendrier, préférences, nouvelle candidature et connexion.

**Architecture :**
- Les jetons vivent dans `src/app/globals.css` (thème shadcn + jetons propres exposés en couleurs Tailwind). Les composants shadcn existants sont restylés sur place, sans composants parallèles.
- Quatre briques partagées : `Pill`, `PillToggle`, `PillTabs` (motif ARIA des onglets) et le `StatusBadge` remappé.
- Tous les nouveaux calculs sont des fonctions pures de `src/domain` (Europe/Paris via `paris-time`), testées avec des valeurs exactes. Les filtres rapides des opportunités s'ajoutent côté serveur dans `buildOpportunityListing`, comme la recherche V3.

**Tech Stack :** Next.js 16 (App Router), TypeScript strict, Tailwind v4 + shadcn (base-ui), `next/font/google`, Supabase, FullCalendar 7, Jest et React Testing Library, tests d'intégration sur Supabase local.

**Spec :** [docs/superpowers/specs/2026-10-19-freeclutch-design-atelier-design.md](../specs/2026-10-19-freeclutch-design-atelier-design.md). Maquettes (référence visuelle seulement, le texte de la spec fait foi) : `docs/superpowers/specs/assets/2026-10-19-atelier/*.html`.

## Global Constraints

- **Les Global Constraints des plans V1, V2 et V3 s'appliquent toutes** (`docs/superpowers/plans/2026-10-17-freeclutch-v1.md`, `2026-10-18-mes-opportunites.md`, `2026-10-18-freeclutch-v3.md`). En résumé :
  - aucun `any`, fonctions fléchées, exports nommés ;
  - un dossier kebab-case par composant (`interfaces.ts`, `index.ts`, `controller.tsx` avec un seul `useController` et des actions injectées quand la logique dépasse quatre fonctions) ;
  - pas de `console.log`, pas de commentaires, pas de code mort (imports, props ou composants devenus inutiles sont supprimés) ;
  - `server-only` dans `src/server`, types partagés dans `src/domain`, les fichiers `'use server'` n'exportent que des actions, filtre `user_id` dans les repositories ;
  - dates en Europe/Paris via `src/domain/paris-time.ts` ;
  - textes d'interface en français, style du dépôt (guillemets simples, sans point-virgule).
- **Couleurs :** uniquement via les classes Tailwind des jetons (`bg-forest`, `text-ink-muted`, `bg-peach-tint`…). Aucun hexadécimal dans les composants. Seule exception : `globals.css`, et les couleurs FullCalendar passées en `var(--…)`.
- **Contraste :** tout texte ≥ 4,5:1 sur son fond. `text-muted-foreground` / `text-ink-muted` (`#55625B`) est **interdit sur fond pêche** (`#FFB48A`, 3,70:1) : on y utilise `text-ink` ou `text-ink-secondary`.
- **Polices :**
  - Manrope (700, 800) en `font-heading` pour les titres, les chiffres mis en avant et le logo ;
  - Figtree (400 à 700) en `font-sans` pour le reste ;
  - les deux via `next/font/google`, Geist est retiré.
- **Mode clair seulement :** le bloc `.dark`, la variante `@custom-variant dark` et toutes les classes `dark:` sont supprimés.
- **Formes :**
  - boutons et pastilles en pilule (`rounded-full`) ;
  - cartes `rounded-2xl` (`--radius: 0.875rem`, donc 24,5 px), blanches, sans bordure ;
  - champs `rounded-lg` (14 px) sur `bg-muted` (surface douce) avec `border-input` ;
  - boutons icône de 44 px (`size-11`) avec `aria-label`.
- **Icônes :** `lucide-react` (SVG en ligne, `strokeWidth={1.75}`, `aria-hidden`). Jamais d'emoji.
- **Mouvement :** transitions sobres, coupées par `motion-reduce:transition-none`.
- **Petits écrans :** chaque page fonctionne dès 360 px, sans défilement horizontal de la page. Les tableaux défilent dans leur carte.
- **Pluriels français :** 0 et 1 au singulier (`pluralizeFrench`, tâche 4).
- **Tests de style :** on ne teste pas des listes de classes. Les tons sont exposés par `data-tone` sur `Pill` et `PillToggle`, et ce sont eux qu'on vérifie. Les tests de comportement existants ne changent pas, seuls les libellés imposés par la spec sont mis à jour.
- **Données :**
  - aucune migration ;
  - la seule évolution côté données est la lecture de colonnes existantes (`rate_min`, `rate_max`, `remote_mode`) dans `listOpportunityDecisions` ;
  - si une migration devenait nécessaire, elle serait additive et signalée au porteur avant tout commit.
- **`npm run test:tz`** couvre aussi les nouveaux calculs datés : on ajoute `home-summary job-application-tabs last-activity-aging` à la liste de motifs du script (tâches 4, 6, 9).
- **Git :**
  - on commite sur `main`, sans jamais pousser ni créer de branche ;
  - les messages de commit ne contiennent aucune mention d'IA ni de ligne `Co-Authored-By` ;
  - chaque lot se termine par un point de déploiement fait par le contrôleur : le porteur pousse, puis le contrôleur vérifie le run GitHub Actions « CI/CD » (checks, integration, deploy) et le déploiement Vercel.

## Review Focus

1. **Saisie en cours dans un bloc de l'onglet Aperçu, puis changement d'onglet et `router.refresh()`** (par exemple après « Ajouter » dans Journal). On s'attend à retrouver la saisie intacte en revenant sur Aperçu. → Tâche 8 : les panneaux restent montés (`hidden`), et un test le vérifie.
2. **Fiche ouverte sur `?onglet=journal`, puis rafraîchie par le serveur.** L'onglet choisi reste ouvert : le `initialTab` recalculé par le serveur n'écrase pas le choix de l'utilisateur. → Tâche 8 : test de re-rendu avec un autre `initialTab`.
3. **Pastille « À faire » active dont la dernière alerte vient d'être reportée.** Après le rafraîchissement, la pastille disparaît : le tableau ne doit pas rester filtré sur un type absent et vide, sans moyen de retirer le filtre. → Tâche 10 : un type sélectionné absent des compteurs vaut « aucun filtre ».
4. **Onglet du navigateur ouvert avant le déploiement du lot 5, qui envoie un curseur sans `rate` à « Voir plus ».** Le curseur est accepté (`rate` absent vaut `null`) au lieu d'afficher « Onglet ou page invalide ». → Tâche 11 : test de validation.
5. **Entretien du jour dont l'heure est passée.** Il n'apparaît ni dans la tuile « Prochain entretien », ni dans la phrase de résumé, ni dans la règle d'onglet. On prend le suivant, et le compte à rebours n'affiche jamais un passé. → Tâches 4 et 6 : tests dédiés.

---

## Lot 1 — Fondations

### Task 1 : Jetons, polices et contrôles de base

**Files :**
- Modify : `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`
- Create : `src/lib/control-class-names.ts`
- Modify (remplacer les chaînes de classes de `select`/`textarea` dupliquées par les constantes) : `mission-details-form`, `new-job-application-form`, `interviews-section` (2 endroits), `job-spec-section`, `activity-log`, `interview-preparation-modal` (2), `stack-chips-editor`, `header-edit-form`, `interview-preparation-button`, `job-application-header`
- Modify : toutes les occurrences de `dark:` sous `src/components` (18)
- Test : `src/app/atelier-theme.test.ts`, `src/components/ui/button.test.tsx`

**Interfaces :**
- Produit (`globals.css`) :
  - les variables brutes de `:root`, avec les valeurs exactes de la spec §2.1 :
    - `--sage #F2F4F1`, `--surface-soft #F7F9F7`, `--ink #16231D`, `--ink-secondary #3B4A42`, `--ink-muted #55625B` ;
    - `--hairline #E6ECE8`, `--hairline-strong #DDE3DE`, `--control-border #C9D3CC`, `--forest #1F5C46` ;
    - `--on-forest #CFE3D8` (texte secondaire sur forêt) ;
    - `--peach #FFB48A`, `--peach-tint #FFF1E8`, `--peach-ink #8A4B1F`, `--lilac #DCD6F7`, `--lilac-tint #F2F0FC` ;
    - `--clay #8A3B32`, `--clay-soft #F1E3E1`, `--clay-tint #FBF1EF` ;
  - les couleurs Tailwind associées dans `@theme inline` (`--color-forest: var(--forest)`, etc.) ;
  - le branchement du thème shadcn :
    - `--background` sauge, `--foreground` encre, `--card` et `--popover` `#FFFFFF` ;
    - `--primary` forêt, `--primary-foreground` `#FFFFFF` ;
    - `--secondary` et `--muted` surface douce, `--muted-foreground` texte discret ;
    - `--accent` filet, `--destructive` terre ;
    - `--border` filet, `--input` bordure des contrôles, `--ring` forêt ;
    - `--radius: 0.875rem` ;
  - `--font-sans: var(--font-figtree)`, `--font-heading: var(--font-manrope)`, sans redéfinir `--font-mono` ;
  - en base : `h1, h2, h3` en `font-heading` avec `tracking-tight`.
- Produit (`src/lib/control-class-names.ts`) : `NATIVE_SELECT_CLASS_NAME: string` et `TEXTAREA_CLASS_NAME: string`. Mêmes rayon, fond et anneau de focus que `Input`. Les dimensions propres à chaque appel (`min-h-24`, `w-full`…) sont ajoutées avec `cn`.
- Produit (`button.tsx`) :
  - toutes les tailles en `rounded-full` ;
  - `default` en `h-10 px-4`, `sm` en `h-9 px-3.5`, `lg` en `h-11 px-5` ;
  - `icon`, `icon-sm` et `icon-lg` en `size-11` ; `icon-xs` reste réservé aux boutons « retirer » dans une pastille ;
  - variantes :
    - `default` : forêt et texte blanc ;
    - `outline` : bouton secondaire, `bg-card` avec `border-input` ;
    - `destructive` : `bg-card`, `border-input` et `text-destructive` ;
    - `ghost` et `link` : inchangés hors couleurs.

- [ ] **Step 1 : Tests qui échouent**
  - `atelier-theme.test.ts` lit `src/app/globals.css` avec `fs` et extrait les variables `--nom: #hex` de `:root`. Il calcule le contraste WCAG avec une fonction locale au test, et chaque paire suivante doit atteindre au moins 4,5 :
    - texte sur fond : `ink`/`sage`, `ink-secondary`/`sage`, `ink-muted`/`sage`, `ink-muted`/`#FFFFFF`, `ink-muted`/`surface-soft`, `ink-muted`/`hairline` ;
    - forêt : `#FFFFFF`/`forest`, `on-forest`/`forest`, `forest`/`hairline`, `forest`/`#FFFFFF` ;
    - pêche et lilas : `ink`/`peach`, `ink-secondary`/`peach`, `ink`/`lilac`, `ink-muted`/`lilac`, `peach-ink`/`peach-tint` ;
    - terre : `clay`/`clay-soft`, `clay`/`clay-tint` ;
    - encre : `#FFFFFF`/`ink`, `peach`/`ink`.
  - Le même test vérifie :
    - que `globals.css` ne contient ni `.dark` ni `@custom-variant dark` ;
    - qu'aucun fichier `.tsx` sous `src` ne contient `dark:` (parcours récursif avec `fs`).
  - `button.test.tsx` :
    - `buttonVariants()` contient `rounded-full` et `bg-primary` ;
    - `buttonVariants({ size: 'icon' })` contient `size-11` ;
    - `buttonVariants({ variant: 'destructive' })` contient `text-destructive`.
- [ ] **Step 2 :** `npm test -- atelier-theme button`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter :
  - `layout.tsx` charge `Manrope({ variable: '--font-manrope', subsets: ['latin'], weight: ['700', '800'] })` et `Figtree({ variable: '--font-figtree', subsets: ['latin'], weight: ['400', '500', '600', '700'] })` ;
  - `Input` passe en `h-11 rounded-lg bg-muted px-3.5`, `Label` en `font-semibold text-ink-muted` ;
  - on remplace les chaînes de contrôle dupliquées et on supprime les `dark:`.
- [ ] **Step 4 :** `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS, sans aucun test de comportement modifié.
- [ ] **Step 5 :** Commit `feat(design): atelier tokens, fonts and restyled base controls`.

### Task 2 : Pastilles, badge de statut et onglets en pilule

**Files :**
- Create : `src/components/pill/{pill.tsx,interfaces.ts,index.ts,pill.test.tsx}`, `src/components/pill-toggle/{pill-toggle.tsx,interfaces.ts,index.ts,pill-toggle.test.tsx}`, `src/components/pill-tabs/{pill-tabs.tsx,interfaces.ts,index.ts,pill-tabs.test.tsx}`
- Modify : `src/components/status-badge/status-badge.tsx` ; Create : `src/components/status-badge/status-badge.test.tsx`
- Modify : `src/components/opportunities-board/opportunities-board.tsx` et `opportunities-board.test.tsx` (onglets via `PillTabs`)

**Interfaces :**
- Produit :
  ```ts
  type PillTone = 'neutral' | 'sage' | 'forest-soft' | 'forest' | 'peach' | 'peach-soft' | 'lilac' | 'lilac-soft' | 'clay' | 'ink'
  const PILL_TONE_CLASS_NAMES: Record<PillTone, string>
  const Pill: (props: { tone: PillTone; children: ReactNode; className?: string }) => JSX.Element
  const PillToggle: (props: { isPressed: boolean; onPressedChange: (isPressed: boolean) => void; children: ReactNode; tone?: PillTone; disabled?: boolean }) => JSX.Element
  type PillTabItem<TabKey extends string> = { key: TabKey; label: string; count?: number; tabId: string; panelId: string }
  const PillTabs: <TabKey extends string>(props: { label: string; tabs: PillTabItem<TabKey>[]; selectedTab: TabKey; onSelect: (tab: TabKey) => void; isDisabled?: boolean }) => JSX.Element
  const STATUS_BADGE_TONES: Record<JobApplicationStatus, PillTone>
  ```
- Classes des tons :
  - `neutral` : `border border-hairline bg-background text-ink` ;
  - `sage` : `bg-hairline text-ink` ;
  - `forest-soft` : `bg-hairline text-forest` ;
  - `forest` : `bg-forest text-primary-foreground` ;
  - `peach` : `bg-peach text-ink` ;
  - `peach-soft` : `bg-peach-tint text-peach-ink` ;
  - `lilac` : `bg-lilac text-ink` ;
  - `lilac-soft` : `bg-lilac-tint text-ink` ;
  - `clay` : `bg-clay-soft text-clay` ;
  - `ink` : `bg-ink text-primary-foreground`.
- `Pill` rend un `<span data-tone>`. `PillToggle` rend un `<button type="button" aria-pressed data-tone>`, en `forest` quand il est pressé et en `tone` sinon (`'neutral'` par défaut), avec un focus visible (`focus-visible:ring-3 ring-ring/40`).
- **Correspondance des statuts (§2.3)** :

  | Statut | Ton |
  |---|---|
  | `applied` | `neutral` |
  | `intermediary_contact` | `sage` |
  | `cv_submitted` | `lilac` |
  | `interview_scheduled` | `peach` |
  | `interview_done` | `forest-soft` |
  | `contract_received` | `forest-soft` + `font-bold` |
  | `signed` | `forest` |
  | `ko_after_contact`, `ko_cv`, `ko_interview`, `no_news_abandoned` | `clay` |

- `PillTabs` suit le motif ARIA des onglets à activation automatique :
  - `role="tablist"` avec `aria-label` ;
  - chaque onglet a `role="tab"`, `aria-selected`, `aria-controls={panelId}`, et `tabIndex` à 0 pour le sélectionné, -1 pour les autres ;
  - libellé `${label} · ${count}` quand `count` est défini ;
  - clavier : `ArrowRight`/`ArrowLeft` (en boucle), `Home`, `End`, qui déplacent le focus et appellent `onSelect` ;
  - l'onglet actif est en forêt dans une pilule blanche.

- [ ] **Step 1 : Tests qui échouent**
  - `status-badge.test.tsx` :
    - pour les 11 statuts, le libellé de `JOB_APPLICATION_STATUS_LABELS` et le `data-tone` du tableau ci-dessus ;
    - « Contrat reçu » porte `font-bold`.
  - `pill-toggle.test.tsx` :
    - `aria-pressed="false"` et `data-tone="neutral"` au repos, puis `aria-pressed="true"` et `data-tone="forest"` une fois pressé ;
    - un clic appelle `onPressedChange(true)`.
  - `pill-tabs.test.tsx`, avec trois onglets `a`, `b` et `c` (dont `b` avec `count: 2`) :
    - le nom accessible « B · 2 » ;
    - `aria-selected` et `tabIndex` ;
    - `ArrowRight` sur `c` sélectionne `a` et lui donne le focus ;
    - `End` sélectionne `c` ;
    - `aria-controls` vaut le `panelId`.
  - `opportunities-board.test.tsx` : l'onglet s'appelle « À traiter · 3 » (au lieu de « À traiter (3) »), et `ArrowRight` déclenche `listOpportunities('applied', …)`.
- [ ] **Step 2 :** `npm test -- pill status-badge opportunities-board`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. `OpportunitiesBoard` passe les trois onglets à `PillTabs` avec `panelId: 'opportunities-panel'`, et `isDisabled` reprend la condition actuelle.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(design): pills, status badge tones and keyboard pill tabs`.

### Task 3 : Menu en pilule et surfaces partagées

**Files :**
- Modify : `src/components/app-shell/app-shell.tsx`, `app-shell.test.tsx`
- Modify : `src/components/settings-navigation/settings-navigation.tsx` (pilules)
- Modify (surfaces passées en carte blanche `rounded-2xl bg-card`, tons de jetons au lieu des `amber-*`/`muted/40`) : `todo-banner`, `opportunity-card`, `opportunity-feed-freshness` (alerte de fraîcheur en `bg-peach-tint text-ink`), `missing-anthropic-api-key-notice`, `job-applications-table` (enveloppe du tableau)

**Interfaces :** consomme `Pill` (compteur du menu en ton `peach`).

Rendu du menu :
- `<header>` contenant une barre `bg-card rounded-full` (passe en `rounded-3xl` et à la ligne sous `sm`) ;
- logo « Freeclutch » en `font-heading font-extrabold` vers `/` ;
- liens en pilule, le lien actif en `bg-forest text-primary-foreground` ;
- « Se déconnecter » en bouton `outline` en bout de barre ;
- `<main>` en `max-w-7xl` ;
- la barre utilise `flex-wrap` et ne fixe aucune largeur minimale : aucun défilement horizontal à 360 px.

- [ ] **Step 1 : Tests qui échouent** (en plus des tests existants, inchangés) :
  - le compteur « 3 » est rendu dans un élément `data-tone="peach"`, et le nom accessible reste « Mes opportunités, 3 à traiter » ;
  - le bouton « Se déconnecter » est présent ;
  - le lien actif porte `aria-current="page"` (déjà testé).
- [ ] **Step 2 :** `npm test -- app-shell`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(design): pill navigation bar and atelier surfaces`.

> **Point de déploiement lot 1** (contrôleur) : le porteur pousse `main`. Le contrôleur suit le run GitHub Actions « CI/CD » jusqu'au vert (checks, integration, deploy), vérifie que Vercel est « Ready », puis contrôle en production que chaque page s'affiche en couleurs et polices Atelier, sans défilement horizontal à 360 px.

---

## Lot 2 — Accueil Bento

### Task 4 : Calculs de l'accueil (résumé, compte à rebours, compteurs)

**Files :**
- Modify : `src/domain/paris-time.ts`, `src/domain/paris-time.test.ts`, `src/domain/job-application-status.ts`, `src/domain/job-application-status.test.ts`
- Create : `src/domain/french-plural.ts` et son test, `src/domain/home-summary.ts`, `src/domain/home-summary.test.ts`
- Modify : `package.json` (ajouter `home-summary` aux motifs de `test:tz`)

**Interfaces :**
- Produit :
  ```ts
  formatInterviewCountdown(startsAt: Date, now: Date): string
  formatParisLongDate(date: Date): string
  formatParisDayBlock(date: Date): { weekday: string; day: string }
  formatParisTime(date: Date): string
  pluralizeFrench(count: number, singular: string, plural: string): string
  countActiveJobApplications(jobApplications: { status: JobApplicationStatus }[]): number
  type HomeSummaryInput = {
    reminderCount: number
    nextInterview: Pick<Interview, 'startsAt' | 'kind'> | null
    recentOpportunityCount: number
    now: Date
  }
  buildHomeSummarySentence(input: HomeSummaryInput): string
  ```
- Règles :
  - **Compte à rebours :** il compte les jours calendaires Paris (`countParisCalendarDaysBetween(now, startsAt)`) et affiche 0 → « aujourd'hui », 1 → « demain », N → « dans N jours ».
  - **`pluralizeFrench` :** il renvoie seulement le mot, au singulier si `count <= 1`.
  - **`countActiveJobApplications` :** il compte les statuts `isActiveStatus`.
  - **Phrase de résumé :**
    - première partie : « N chose(s) à faire » si `reminderCount > 0` ;
    - seconde partie, si `nextInterview` est à venir (`startsAt > now`) et à au plus `UPCOMING_INTERVIEW_WINDOW_DAYS` (7) jours calendaires : « un entretien client » / « un entretien blanc » / « un entretien » (pour `other`), suivi du jour :
      - « aujourd'hui », « demain » ;
      - le nom du jour en minuscules pour 2 à 6 jours ;
      - « {jour} prochain » à 7 jours ;
    - sinon, si `recentOpportunityCount > 0` : « N mission(s) intéressante(s) de moins de 48 h » ;
    - assemblage : les deux parties jointes par « et », première lettre en majuscule, point final ;
    - aucune partie : « Rien d'urgent aujourd'hui. »

- [ ] **Step 1 : Tests qui échouent**, avec `NOW = 2026-10-19T08:00:00Z` (lundi 10 h à Paris) sauf mention contraire :
  - `formatInterviewCountdown` :
    - `2026-10-19T14:00Z` → « aujourd'hui » ;
    - `2026-10-22T08:00Z` → « dans 3 jours » ;
    - minuit : now `2026-10-19T21:30Z`, entretien `2026-10-19T22:30Z` → « demain » ;
    - changement d'heure : now `2026-10-24T22:30Z`, entretien `2026-10-25T23:30Z` → « demain » ;
    - changement d'heure : now `2026-10-24T21:30Z`, même entretien → « dans 2 jours ».
  - `formatParisLongDate(NOW)` → « Lundi 19 octobre », et `formatParisLongDate(2026-10-19T22:30Z)` → « Mardi 20 octobre ».
  - `formatParisDayBlock(2026-10-22T08:00Z)` → `{ weekday: 'JEU', day: '22' }`.
  - `formatParisTime(2026-10-22T08:00Z)` → « 10h00 ».
  - `pluralizeFrench` avec `'chose', 'choses'` : 0 → `chose`, 1 → `chose`, 2 → `choses`.
  - `countActiveJobApplications` : un exemplaire de chacun des 11 statuts → 6.
  - `buildHomeSummarySentence` :
    - `{0, null, 0}` → « Rien d'urgent aujourd'hui. » ;
    - `{4, client 2026-10-22T08:00Z, 0}` → « 4 choses à faire et un entretien client jeudi. » ;
    - `{1, null, 0}` → « 1 chose à faire. » ;
    - `{0, mock 2026-10-19T14:00Z, 2}` → « Un entretien blanc aujourd'hui. » ;
    - `{0, other 2026-10-23T08:00Z, 0}` → « Un entretien vendredi. » ;
    - `{0, client 2026-10-26T08:00Z, 0}` → « Un entretien client lundi prochain. » ;
    - `{2, client 2026-10-27T08:00Z, 3}` → « 2 choses à faire et 3 missions intéressantes de moins de 48 h. » ;
    - `{0, null, 1}` → « 1 mission intéressante de moins de 48 h. » ;
    - `{0, client 2026-10-27T08:00Z, 0}` → « Rien d'urgent aujourd'hui. » ;
    - entretien déjà passé, `{0, client 2026-10-19T07:00Z, 0}` → « Rien d'urgent aujourd'hui. » ;
    - minuit : now `2026-10-19T21:30Z`, `{3, client 2026-10-19T22:30Z, 0}` → « 3 choses à faire et un entretien client demain. ».
- [ ] **Step 2 :** `npm test -- paris-time home-summary french-plural job-application-status`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter, puis ajouter `home-summary` à `test:tz`.
- [ ] **Step 4 :** `npm test -- paris-time home-summary french-plural job-application-status && npm run test:tz`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(home): summary sentence, interview countdown and counters`.

### Task 5 : Accueil Bento

**Files :**
- Modify : `src/domain/opportunities.ts` (type), `src/server/opportunities/highlighted-opportunities.ts`, `src/server/actions/opportunity-actions.ts`, `tests/integration/highlighted-opportunities.test.ts`
- Modify : `src/app/(app)/page.tsx`, `src/components/home-dashboard/{home-dashboard.tsx,interfaces.ts,home-dashboard.test.tsx,controller.test.tsx}`
- Modify : `src/components/todo-banner/format-todo-alert.ts` et son test ; `todo-banner.tsx` et `interfaces.ts` (retrait de `maximumVisibleAlerts` et `seeAllHref`, devenus inutiles)

**Interfaces :**
- Consomme : tâche 4, `findNextInterview`, `formatParisInterviewDateTime`, `formatTodoAlertMessage`, `countOpportunitiesToProcess()`, `Pill`.
- Produit :
  - `type HighlightedOpportunities = { opportunities: OpportunityListItem[]; recentOpportunityCount: number }`, avec `listHighlightedOpportunities(): Promise<ActionResult<HighlightedOpportunities>>`. `recentOpportunityCount` est le nombre de missions « À traiter » (filtres de l'utilisateur appliqués) publiées depuis moins de 48 h, sans plafond de 2.
  - `TODO_ALERT_KIND_TAG_LABELS: Record<AlertKind, string>` : « Relance », « Fiche métier », « Client inconnu », « Sans nouvelles », « Entretien à venir ».
  - `TODO_ALERT_KIND_TONES: Record<AlertKind, PillTone>` : `follow_up_due` en `peach`, `job_spec_missing` et `end_client_unknown` en `lilac`, `no_news_suggestion` en `clay`, `upcoming_interview` en `sage`. Le fond de chaque petite carte reprend la teinte correspondante (`peach-tint`, `lilac-tint`, `clay-tint`, `hairline`).
  - `HomeDashboardProps` gagne `activeJobApplicationCount: number`, `opportunitiesToProcessCount: number` et `recentOpportunityCount: number`. La page appelle `countOpportunitiesToProcess()` dans son `Promise.all`.

**Rendu (maquette `AccueilBento.html`) :**
- **Rangée 1 :**
  - tuile `bg-forest` : `formatParisLongDate(now)` en `text-on-forest`, `<h1>` « Bonjour {prénom} » ou « Bonjour », puis la phrase de résumé ;
  - tuile `bg-peach` : `<h2>` « Prochain entretien · {compte à rebours} », la date via `formatParisInterviewDateTime` en `font-heading` très grand, le libellé du type, le titre de la mission et le client, puis le lien « Voir mon calendrier ». Sans entretien : `<h2>` « Prochain entretien », « Aucun entretien prévu. » et le même lien.
- **Rangée 2 :**
  - tuile « À faire » : au plus 5 alertes en petites cartes-liens vers la fiche, avec l'étiquette `Pill` et le message `formatTodoAlertMessage`, puis « Voir mes candidatures ». Sans alerte : « Rien d'urgent aujourd'hui. » ;
  - tuile « Ensuite » : le 2ᵉ et le 3ᵉ entretien, avec le pavé `formatParisDayBlock`, puis `formatParisTime` · type · mission. Elle n'est rendue que s'il existe au moins un entretien après le prochain ;
  - tuile `bg-lilac` : chiffre et « candidature(s) en cours » ;
  - tuile `bg-ink` : chiffre en `text-peach` et « mission(s) à traiter ».
- **Rangée 3 :** `<h2>` « Missions intéressantes · moins de 48 h », les cartes compactes existantes, « Voir mes opportunités », et l'état vide V3 inchangé.
- Les rangées sont en `flex-wrap` et s'empilent sous `md`.

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration (`highlighted-opportunities`)** :
    - le scénario existant à 4 missions renvoie `opportunities` à 650 puis 600, et `recentOpportunityCount === 3` ;
    - une nouvelle ligne vérifie qu'avec 3 missions récentes et éligibles, on obtient 2 `opportunities` et `recentOpportunityCount === 3`.
  - **`format-todo-alert.test.ts`** : les deux tables de correspondance (5 clés chacune).
  - **Rendu (`home-dashboard.test.tsx`)**, avec `NOW = 2026-10-19T08:00:00Z` :
    - « Lundi 19 octobre » et `heading` « Bonjour Rayan » ;
    - avec 4 alertes et un entretien client le `2026-10-22T08:00Z` : le texte « 4 choses à faire et un entretien client jeudi. », le titre « Prochain entretien · dans 3 jours », « jeu. 22/10 · 10h00 », et le lien « Voir mon calendrier » vers `/calendar` ;
    - sans entretien : « Aucun entretien prévu. », et aucun titre « Ensuite » ;
    - avec 4 entretiens, « Ensuite » liste exactement le 2ᵉ et le 3ᵉ ;
    - avec 6 alertes, 5 liens d'alerte. Le premier, de type `follow_up_due`, a une étiquette « Relance » en `data-tone="peach"` ;
    - « 6 » et « candidatures en cours », « 1 » et « candidature en cours », « 12 » et « missions à traiter » ;
    - `heading` « Missions intéressantes · moins de 48 h », l'état vide « Pas de nouvelle mission intéressante depuis 48 h. », et « Voir mes opportunités » vers `/opportunites` ;
    - les tests « J'ai postulé » existants restent verts.
- [ ] **Step 2 :** `npm run test:integration -- highlighted-opportunities && npm test -- home-dashboard format-todo-alert todo-banner`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(home): bento dashboard with summary, countdown and counters`.

> **Point de déploiement lot 2** (contrôleur) : le porteur pousse `main`. Le contrôleur vérifie le run « CI/CD » et Vercel, puis l'accueil en production à 360 px et sur grand écran (phrase, compte à rebours, deux compteurs, compteur égal à celui du menu).

---

## Lot 3 — Fiche candidature en Bento et onglets

### Task 6 : Onglet par défaut, URL et étape du parcours

**Files :**
- Create : `src/domain/job-application-tabs.ts`, `src/domain/job-application-tabs.test.ts`
- Modify : `src/domain/routes.ts` et `routes.test.ts`, `src/domain/job-application-status.ts` et son test, `package.json` (`job-application-tabs` dans `test:tz`)

**Interfaces :**
- Produit :
  ```ts
  const JOB_APPLICATION_TABS = ['apercu', 'mission', 'entretiens', 'journal'] as const
  type JobApplicationTab = (typeof JOB_APPLICATION_TABS)[number]
  const JOB_APPLICATION_TAB_LABELS: Record<JobApplicationTab, string>
  const JOB_APPLICATION_TAB_SEARCH_PARAMETER = 'onglet'
  isJobApplicationTab(candidate: unknown): candidate is JobApplicationTab
  resolveJobApplicationTab(requestedTab: string | string[] | undefined, interviews: Pick<Interview, 'startsAt'>[], now: Date): JobApplicationTab
  jobApplicationTabRoute(jobApplicationId: string, tab: JobApplicationTab): string
  formatPipelineStep(status: JobApplicationStatus): string | null
  ```
- Libellés des onglets : « Aperçu », « Mission », « Entretiens », « Journal ».
- `resolveJobApplicationTab` :
  - une chaîne valide l'emporte ;
  - sinon (absente, inconnue, ou tableau), il renvoie `'entretiens'` si un entretien vérifie `startsAt > now` et `countParisCalendarDaysBetween(now, startsAt) <= UPCOMING_INTERVIEW_WINDOW_DAYS` ;
  - sinon `'apercu'`.
- `formatPipelineStep` renvoie « étape N sur 7 » pour les statuts de `PIPELINE_STATUSES` (N = index + 1), et `null` pour les KO et « sans nouvelles ».

- [ ] **Step 1 : Tests qui échouent**, avec `NOW = 2026-10-19T08:00:00Z` :
  - `resolveJobApplicationTab` :
    - `'journal'` avec un entretien demain → `journal` ;
    - `'inconnu'` sans entretien → `apercu` ;
    - `['mission']` → la règle par défaut ;
    - entretien `2026-10-26T20:00Z` (7 jours) → `entretiens` ;
    - entretien `2026-10-27T06:00Z` (8 jours) → `apercu` ;
    - entretien passé `2026-10-19T07:00Z` → `apercu` ;
    - minuit : now `2026-10-19T21:30Z`, entretien `2026-10-26T22:30Z` (lundi 23 h 30, 7 jours) → `entretiens`, et `2026-10-26T23:30Z` (mardi 0 h 30, 8 jours) → `apercu`.
  - `jobApplicationTabRoute('a1', 'entretiens')` → `/candidatures/a1?onglet=entretiens`.
  - `formatPipelineStep` :
    - `applied` → « étape 1 sur 7 », `interview_scheduled` → « étape 4 sur 7 », `signed` → « étape 7 sur 7 » ;
    - `ko_cv`, `ko_after_contact`, `ko_interview` et `no_news_abandoned` → `null`.
- [ ] **Step 2 :** `npm test -- job-application-tabs routes job-application-status`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter, puis ajouter `job-application-tabs` à `test:tz`.
- [ ] **Step 4 :** Relancer, puis `npm run test:tz`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(application): default tab rule, tab route and pipeline step`.

### Task 7 : En-tête de fiche et trois tuiles

**Files :**
- Create : `src/components/job-application-highlights/{job-application-highlights.tsx,interfaces.ts,index.ts,job-application-highlights.test.tsx}`
- Modify : `src/components/header-view/{header-view.tsx,interfaces.ts,header-view.test.tsx}`, `src/components/job-application-header/{job-application-header.tsx}` ; Create : `src/components/job-application-header/job-application-header.test.tsx`
- Modify : `src/components/interview-preparation-button/interview-preparation-button.tsx` (style seulement), `src/app/(app)/candidatures/[jobApplicationId]/page.tsx` (zone d'en-tête)
- Delete : `src/components/job-application-summary/*` (remplacé par la tuile)

**Interfaces :**
- Consomme : `formatInterviewCountdown`, `formatPipelineStep`, `findNextInterview`, `formatDailyRate`, `formatParisInterviewDateTime`, `StatusBadge`.
- Produit :
  - `JobApplicationHighlightsProps = { requestedDailyRate: number | null; postedDailyRate: number | null; nextInterview: Interview | null; now: Date; preparation: ReactNode }` ;
  - `HeaderViewData` gagne `title` et perd `lastActivityAt` ; `HeaderViewProps` perd `now`.
- **Carte d'en-tête** (blanche) :
  - le lien « Mes candidatures » précédé d'une flèche `ArrowLeft` `aria-hidden`, vers `/candidatures` ;
  - le `JobApplicationBlock` d'en-tête existant, dont la vue `HeaderView` rend `<h1>` (titre) et une ligne unique : `{client final ou « Client inconnu »} · via {intermédiaire (type)} · {source} · {formatParisDate(appliedOn)} · « Voir l'annonce »`. Les parties absentes sont omises, sans « — » ;
  - `JobApplicationHeader` :
    - `StatusBadge` et `formatPipelineStep` en `text-ink-muted` ;
    - un bouton `outline` « Changer le statut » (`aria-expanded`, `aria-controls`) qui déplie les contrôles existants, sans changer leur fonctionnement : la frise d'avancement, « Passer à « … » », les boutons KO, et le `select`, dont le libellé devient « Choisir un statut ».
- **Tuiles :**
  - **TJM**, en `bg-forest` :
    - « TJM demandé » avec `{formatDailyRate(requested)}/j` ;
    - sinon « TJM annoncé » avec le TJM annoncé ;
    - sinon « TJM non renseigné » ;
  - **Prochain entretien**, en `bg-peach` : « Prochain entretien · {compte à rebours} », la date via `formatParisInterviewDateTime` et le type. Sinon « Aucun entretien prévu » ;
  - **Préparation**, en `bg-lilac` : le slot `preparation`, qui reçoit `InterviewPreparationButton` (libellés V3 inchangés).
- Mise en page : la carte occupe 3/5 et les tuiles 2/5 sur `lg`. Tout s'empile en dessous.

- [ ] **Step 1 : Tests qui échouent**
  - `job-application-highlights`, avec `NOW = 2026-10-19T08:00:00Z` :
    - requested 650 et posted 600 → « TJM demandé » et `/650\s€\/j/` ;
    - posted seul 600 → « TJM annoncé » et `/600\s€\/j/` ;
    - aucun TJM → « TJM non renseigné » ;
    - entretien client `2026-10-21T08:00Z` → « Prochain entretien · dans 2 jours », « mer. 21/10 · 10h00 », « Entretien client » ;
    - sans entretien → « Aucun entretien prévu » ;
    - le contenu de `preparation` est rendu.
  - `header-view` :
    - `heading` de niveau 1 avec le titre ;
    - la ligne « BNP Paribas AM · via Hays (ESN) · Free-Work · 06/10/2026 · Voir l'annonce » ;
    - sans source ni annonce : « Client inconnu · via Hays (ESN) · 06/10/2026 ».
  - `job-application-header` :
    - `interview_scheduled` → la pastille « Entretien planifié » en `data-tone="peach"` et « étape 4 sur 7 » ;
    - `ko_cv` → aucun texte `/étape/` ;
    - « Changer le statut » a `aria-expanded="false"`. Après un clic, il passe à `"true"` et « Passer à « Entretien passé » » est visible ;
    - le `select` « Choisir un statut » réglé sur `signed` appelle `changeJobApplicationStatus('application-1', 'signed')`.
- [ ] **Step 2 :** `npm test -- job-application-highlights header-view job-application-header`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter, puis supprimer `job-application-summary`.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(application): bento header card with rate, interview and preparation tiles`.

### Task 8 : Les quatre onglets de la fiche

**Files :**
- Create : `src/components/job-application-tabs/{job-application-tabs.tsx,controller.tsx,interfaces.ts,index.ts,controller.test.tsx,job-application-tabs.test.tsx}`
- Modify : `src/app/(app)/candidatures/[jobApplicationId]/page.tsx` (typée `PageProps<'/candidatures/[jobApplicationId]'>`, lit `searchParams.onglet`), `src/components/activity-log/activity-log.tsx` (deux colonnes)

**Interfaces :**
- Consomme : `PillTabs`, `resolveJobApplicationTab`, `JOB_APPLICATION_TAB_LABELS`, `JOB_APPLICATION_TAB_SEARCH_PARAMETER`.
- Produit :
  - `JobApplicationTabsProps = { initialTab: JobApplicationTab; interviewCount: number; activityLogEntryCount: number; panels: Record<JobApplicationTab, ReactNode> }` ;
  - `useController({ initialTab, onTabChanged }: { initialTab: JobApplicationTab; onTabChanged: (tab: JobApplicationTab) => void }) => { selectedTab, selectTab }`. Le composant injecte `onTabChanged = (tab) => window.history.replaceState(null, '', `?onglet=${tab}`)`.
- **Panneaux :**
  - **Aperçu** : « Infos mission » puis « Contact », chacun avec son crayon, et `DeleteJobApplicationButton` tout en bas ;
  - **Mission** : le bloc « Stack » puis `JobSpecSection` ;
  - **Entretiens · N** : `InterviewsSection`, avec N = `interviewsResult.data.length` ;
  - **Journal · N** : `ActivityLog`, avec N = `activityLogEntriesResult.data.length`.
- Les quatre panneaux sont **toujours montés**. Les inactifs portent `hidden`, chacun a `role="tabpanel"` et `aria-labelledby` vers son onglet. La liste d'onglets s'appelle « Sections de la candidature ».
- `ActivityLog` : la frise « Journal des échanges » à gauche, et une colonne `<h2>` « Noter un échange » qui contient le formulaire existant (champs et bouton « Ajouter » inchangés). La colonne passe en dessous sous `lg`.

- [ ] **Step 1 : Tests qui échouent**
  - **Contrôleur :**
    - `selectTab('mission')` met à jour `selectedTab` et appelle `onTabChanged('mission')` ;
    - un re-rendu avec `initialTab: 'apercu'` après `selectTab('journal')` garde `journal`.
  - **Rendu :**
    - les onglets « Aperçu », « Mission », « Entretiens · 2 » et « Journal · 5 » ;
    - `initialTab: 'entretiens'` : cet onglet a `aria-selected="true"` et son panneau est visible, les trois autres ont `hidden` ;
    - `ArrowRight` depuis Journal sélectionne Aperçu, et le focus le suit ;
    - un clic sur Mission appelle `window.history.replaceState(null, '', '?onglet=mission')` (espion Jest) ;
    - une saisie dans un `<input>` du panneau Aperçu est conservée après un aller-retour Journal → Aperçu ;
    - le panneau visible a `aria-labelledby` égal à l'`id` de son onglet.
- [ ] **Step 2 :** `npm test -- job-application-tabs activity-log`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. La page calcule `resolveJobApplicationTab(onglet, interviewsResult.data, now)`.
- [ ] **Step 4 :** Relancer, puis `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(application): four keyboard-accessible tabs reflected in the URL`.

> **Point de déploiement lot 3** (contrôleur) : le porteur pousse `main`. Le contrôleur vérifie « CI/CD » et Vercel, puis en production :
> - une fiche avec un entretien dans la semaine s'ouvre sur Entretiens ;
> - `?onglet=journal` s'ouvre sur Journal ;
> - un bloc en cours de modification survit à un changement d'onglet ;
> - la fiche s'affiche correctement à 360 px.

---

## Lot 4 — Mes candidatures

### Task 9 : Compteurs par type, filtre par pastille et ancienneté

**Files :**
- Modify : `src/domain/todo-alerts.ts` et son test, `src/components/todo-banner/format-todo-alert.ts` et son test, `src/domain/job-applications-filters.ts` et son test
- Create : `src/domain/last-activity-aging.ts`, `src/domain/last-activity-aging.test.ts`
- Modify : `package.json` (`last-activity-aging` dans `test:tz`)

**Interfaces :**
- Produit :
  ```ts
  const TODO_SUMMARY_KIND_ORDER: readonly AlertKind[] // follow_up_due, no_news_suggestion, job_spec_missing, end_client_unknown, upcoming_interview
  type TodoAlertKindCount = { kind: AlertKind; count: number }
  countTodoAlertsByKind(alerts: TodoAlert[]): TodoAlertKindCount[]
  formatTodoAlertKindCount(kind: AlertKind, count: number): string
  // JobApplicationsTableFilters gagne : alertKind: AlertKind | null
  filterAndSortJobApplications(jobApplications, filters, sort, alerts: TodoAlert[]): JobApplication[]
  type LastActivityAging = 'recent' | 'aging' | 'stale'
  getLastActivityAging(jobApplication: { status: JobApplicationStatus; lastActivityAt: Date | null }, now: Date): LastActivityAging | null
  ```
- **`countTodoAlertsByKind` :** il suit l'ordre de `TODO_SUMMARY_KIND_ORDER` et omet les types à zéro. Sa somme vaut `alerts.length`, ce qui donne « À faire · N ».
- **Filtre par pastille :** avec `alertKind` non nul, le tableau ne garde que les candidatures qui ont au moins une alerte de ce type dans `alerts`. Ce filtre s'ajoute aux autres. Les alertes reportées sont déjà exclues par `computeTodoAlerts`.
- **Ancienneté :**
  - les jours sont comptés par `countParisCalendarDaysBetween(lastActivityAt, now)` : 0 à 6 → `recent`, 7 à 14 → `aging`, 15 et plus → `stale` ;
  - `null` si le statut est terminal ou si `lastActivityAt` est `null` (la cellule affiche alors « — ») ;
  - une date future compte comme `recent`.

- [ ] **Step 1 : Tests qui échouent**
  - **`countTodoAlertsByKind` :**
    - avec 2 `follow_up_due`, 1 `job_spec_missing` et 1 `upcoming_interview` → `[{follow_up_due,2},{job_spec_missing,1},{upcoming_interview,1}]` ;
    - via `computeTodoAlerts` avec deux relances dont une reportée (`snoozedUntil > now`) → `follow_up_due` vaut 1 ;
    - `[]` → `[]`.
  - **`formatTodoAlertKindCount` :**
    - relances : « 1 relance », « 8 relances » ;
    - sans nouvelles : « 1 sans nouvelles », « 6 sans nouvelles » ;
    - fiches métier : « 1 fiche métier », « 5 fiches métier » ;
    - clients inconnus : « 1 client inconnu », « 4 clients inconnus » ;
    - entretiens à venir : « 1 entretien à venir », « 2 entretiens à venir ».
  - **`filterAndSortJobApplications` :**
    - `alertKind: 'follow_up_due'` garde seulement les candidatures avec une relance ;
    - combiné à `statuses: ['cv_submitted']`, on obtient l'intersection ;
    - `alertKind: null` ne change rien ;
    - une candidature dont l'alerte n'est pas dans `alerts` (car reportée) est exclue.
  - **`getLastActivityAging`**, avec now `2026-10-19T10:00Z` :
    - il y a 3 jours → `recent` ;
    - il y a 7 jours (`2026-10-12T10:00Z`) → `aging` ;
    - 14 jours (`2026-10-05T10:00Z`) → `aging` ;
    - 15 jours (`2026-10-04T10:00Z`) → `stale` ;
    - statuts `signed`, `ko_cv` ou `no_news_abandoned` à 30 jours → `null` ;
    - `lastActivityAt: null` → `null` ;
    - minuit : now `2026-10-19T21:30Z`, dernier échange `2026-10-12T22:30Z` (6 jours) → `recent`, et `2026-10-12T21:30Z` (7 jours) → `aging`.
- [ ] **Step 2 :** `npm test -- todo-alerts format-todo-alert job-applications-filters last-activity-aging`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Dans cette tâche, le contrôleur du tableau appelle `filterAndSortJobApplications(…, [])` avec `alertKind: null` pour rester vert. La tâche 10 branche les vraies alertes.
- [ ] **Step 4 :** Relancer, puis `npm run test:tz`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(applications): alert counts by kind, alert filter and last activity aging`.

### Task 10 : « À faire » en une ligne et couleurs d'ancienneté

**Files :**
- Create : `src/components/todo-summary-bar/{todo-summary-bar.tsx,interfaces.ts,index.ts,todo-summary-bar.test.tsx}`
- Modify : `src/components/job-applications-table/{controller.tsx,interfaces.ts,job-applications-table.tsx,controller.test.tsx}` ; Create : `job-applications-table.test.tsx`
- Modify : `src/app/(app)/candidatures/page.tsx`, `src/components/todo-banner/todo-banner.tsx` (titre « Tous les rappels »)

**Interfaces :**
- Consomme : tâche 9, `PillToggle`, `Pill`, `TodoBanner`.
- Produit :
  - `TodoSummaryBarProps = { kindCounts: TodoAlertKindCount[]; selectedAlertKind: AlertKind | null; onToggleAlertKind: (kind: AlertKind) => void; isExpanded: boolean; onToggleExpanded: () => void; detailsId: string }` ;
  - `JobApplicationsTableProps` gagne `alerts: TodoAlert[]` et `todoDetails: ReactNode` (la page y passe le `<TodoBanner …/>` existant) ;
  - le contrôleur ajoute `kindCounts`, `selectedAlertKind`, `toggleAlertKind(kind)`, `isTodoListExpanded` et `toggleTodoListExpanded()`. Un `alertKind` sélectionné qui n'est plus dans `kindCounts` est traité comme `null`.
- **Barre :**
  - `section` blanche en pilule, avec `<h2>` « À faire · N » ;
  - une `PillToggle` par type (libellé `formatTodoAlertKindCount`), de la couleur du type au repos et forêt quand elle est pressée ;
  - un bouton `ghost` « Tout déplier » / « Tout replier » (`aria-expanded`, `aria-controls={detailsId}`), replié par défaut ;
  - sans alerte : « Rien à faire pour l'instant », sans pastille ni bouton.
- **En-tête de page :** le bouton s'appelle « + Nouvelle candidature » (au lieu de « Nouvelle candidature »).
- **Légende** près des filtres : « Dernier échange : » suivi de trois `Pill` : « moins de 7 j » (`forest-soft`), « 7 à 14 j » (`peach-soft`), « plus de 14 j » (`clay`).
- **Cellule « Dernier échange » :** `formatRelativeDaysAgo` dans un `Pill` du ton `recent → forest-soft`, `aging → peach-soft`, `stale → clay`. Si `getLastActivityAging` renvoie `null`, la cellule reste en texte simple.
- Le tableau est dans une carte blanche avec `overflow-x-auto`.

- [ ] **Step 1 : Tests qui échouent**
  - **`todo-summary-bar` :**
    - `heading` « À faire · 23 », et les boutons « 8 relances », « 6 sans nouvelles », « 5 fiches métier », « 4 clients inconnus » avec `aria-pressed="false"` ;
    - un clic sur « 8 relances » appelle `onToggleAlertKind('follow_up_due')` ;
    - sélectionnée, elle a `aria-pressed="true"` et `data-tone="forest"` ;
    - « Tout déplier » a `aria-expanded="false"` et `aria-controls`. Déplié, le bouton s'appelle « Tout replier » ;
    - `kindCounts: []` → « Rien à faire pour l'instant », sans bouton « Tout déplier ».
  - **Contrôleur :**
    - `toggleAlertKind('follow_up_due')` deux fois → `null` ;
    - passer de `follow_up_due` à `job_spec_missing` ;
    - `visibleJobApplications` est filtré et combiné au filtre de statut ;
    - après un re-rendu avec des `alerts` sans relance, le filtre `follow_up_due` ne masque plus rien.
  - **Rendu du tableau :**
    - pour un dernier échange à 3, 9 et 21 jours : des `data-tone` `forest-soft`, `peach-soft` et `clay` ;
    - une candidature `ko_cv` à 30 jours (avec terminées affichées) n'a pas de `data-tone` ;
    - la légende « moins de 7 j », « 7 à 14 j », « plus de 14 j » est présente ;
    - déplié, le contenu de `todoDetails` est rendu.
- [ ] **Step 2 :** `npm test -- todo-summary-bar job-applications-table pill-toggle`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(applications): one-line to-do bar with filter pills and aging colours`.

> **Point de déploiement lot 4** (contrôleur) : le porteur pousse `main`. Le contrôleur vérifie « CI/CD » et Vercel, puis en production :
> - une pastille filtre le tableau, et un second clic retire le filtre ;
> - « Tout déplier » puis « Reporter 3 j » met les compteurs à jour ;
> - le tableau défile dans sa carte à 360 px.

---

## Lot 5 — Mes opportunités

### Task 11 : Filtres rapides côté serveur

**Files :**
- Modify : `src/domain/opportunities.ts` et `opportunities.test.ts`
- Modify : `src/server/repositories/opportunity-decisions-repository.ts`, `src/server/opportunities/opportunity-listing.ts` et `opportunity-listing.test.ts`, `src/server/opportunities/highlighted-opportunities.ts`, `src/server/actions/opportunity-actions.ts`
- Test : `tests/integration/opportunity-actions.test.ts` (nouveau `describe('quick filters')`)

**Interfaces :**
- Produit (domaine) :
  ```ts
  type OpportunityQuickFilters = { sortByRate: boolean; remoteModes: RemoteMode[] }
  const NO_OPPORTUNITY_QUICK_FILTERS: OpportunityQuickFilters // { sortByRate: false, remoteModes: [] }
  type OpportunityListingOrder = 'publication' | 'rate'
  type OpportunityListingPosition = { publishedAt: Date; id: string; rate: number | null }
  type OpportunityListingCursor = { publishedAt: string; id: string; rate: number | null }
  type OpportunityListingRequest = { tab: OpportunityTab; after: OpportunityListingPosition | null; search: string; quickFilters: OpportunityQuickFilters }
  validateOpportunityListingRequest(tab: unknown, cursor: unknown, search: unknown, quickFilters: unknown): ActionResult<OpportunityListingRequest>
  compareOpportunityListingPositions(order: OpportunityListingOrder): (first: OpportunityListingPosition, second: OpportunityListingPosition) => number
  matchesRemoteModeQuickFilter(remoteMode: RemoteMode | null, remoteModes: readonly RemoteMode[]): boolean
  ```
- Produit (action) : `listOpportunities(tab, cursor, search, quickFilters: OpportunityQuickFilters = NO_OPPORTUNITY_QUICK_FILTERS)`.
- Produit (repository) : `StoredOpportunityDecision` gagne `opportunityRateMin: number | null`, `opportunityRateMax: number | null` et `opportunityRemoteMode: RemoteMode | null`. On lit `rate_min, rate_max, remote_mode` dans la jointure `opportunities(...)`.
- **Règles :**
  - `rate = getOpportunityEffectiveRate(...)` ;
  - l'ordre `'rate'` trie par taux décroissant, `null` en dernier, puis par `publishedAt` décroissant, puis par `id` décroissant. L'ordre `'publication'` reste l'actuel ;
  - les positions sont triées avec l'ordre demandé, et `selectPositionsAfter` utilise le même comparateur ;
  - `matchesRemoteModeQuickFilter` : une liste vide accepte tout (y compris `null`). Sinon, il faut `remoteMode !== null` et faire partie de la liste ;
  - le filtre de présentiel s'applique aux trois onglets avant le comptage. Les `counts` en tiennent compte, comme pour la recherche ;
  - `countOpportunitiesToProcessForUser` et `buildHighlightedOpportunities` ne reçoivent pas de filtres rapides. `buildHighlightedOpportunities` réutilise `compareOpportunityListingPositions('rate')` à la place de son comparateur local ;
  - validation :
    - `remoteModes` est dédupliqué, rangé dans l'ordre de `REMOTE_MODES`, et chaque valeur doit satisfaire `isRemoteMode` ;
    - `sortByRate` doit être un booléen ;
    - toute autre forme est refusée avec un nouveau message, `OPPORTUNITY_VALIDATION_MESSAGES.invalidQuickFilters = 'Filtres rapides invalides'` ;
    - le `rate` du curseur vaut `null` s'il est absent, et il est refusé s'il n'est pas un nombre fini ≥ 0.

- [ ] **Step 1 : Tests qui échouent**
  - **Domaine :**
    - `compareOpportunityListingPositions('rate')` range `[700 récente, 700 ancienne, 650, 500, null récente, null ancienne]` dans cet ordre, et départage les égalités complètes par `id` décroissant ;
    - `matchesRemoteModeQuickFilter` : `(null, [])` → true, `(null, ['full'])` → false, `('none', ['full','none'])` → true ;
    - la validation accepte `{ sortByRate: true, remoteModes: ['none','full','full'] }` et le normalise en `['full','none']` ;
    - elle refuse `remoteModes: ['moon']` et `sortByRate: 'yes'` avec « Filtres rapides invalides » ;
    - un curseur sans `rate` est accepté avec `rate: null` ;
    - un curseur avec `rate: '650'` ou `-1` est refusé avec « Onglet ou page invalide ».
  - **Intégration** (missions semées avec un mot-clé unique et cherchées par ce mot-clé ; `SeededOpportunity` gagne `rateMin?`, `rateMax?: number | null` et `remoteMode?: string | null`) :
    - **Tri par TJM :** A (500, il y a 1 h), B (`null`, 10 min), C (700, 3 h), D (700, 2 h) et E (`rateMin` 650, `rateMax` null, 4 h) → `[D, C, E, A, B]` ;
    - **Présentiel :** pour `full`, `partial`, `none` et `null`, `remoteModes: ['full','none']` → les missions `full` et `none` seulement, et `[]` → les quatre ;
    - **Compteurs :** avec `['full']`, `counts.to_process === 1`. Une mission `none` ignorée donne `counts.dismissed === 0` avec `['full']`, et 1 sans filtre ;
    - **Combinaison avec les filtres Free-Work :** filtres `includeKeywords: ['react']`, missions React full, Java full et React partial, filtre `['full']` → seulement React full ;
    - **Pagination triée par TJM :** 60 missions, dont les taux valent `null` si `index % 3 === 0` et `400 + index` sinon. La 1ʳᵉ page fait 50 éléments, la suite 10. Le curseur porte le `rate` du dernier élément, la réunion fait 60 identifiants distincts, et la concaténation suit l'ordre global ;
    - **Onglet Postulées trié par TJM :** deux candidatures à 500 et 700 → 700 d'abord ;
    - **Compteur du menu :** avec `includeKeywords: [motClé]` et 3 missions dont une seule `full`, la liste filtrée sur `['full']` compte 1, mais `countOpportunitiesToProcess()` renvoie 3.
- [ ] **Step 2 :** `npm test -- opportunities opportunity-listing && npm run test:integration -- opportunity-actions highlighted-opportunities`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Le dictionnaire de recherche de `buildSearchPredicate` devient un dictionnaire de faits par `id` (`title`, `company`, `locationLabel`, `rateMin`, `rateMax`, `remoteMode`), alimenté par les décisions puis par les résumés récents, comme aujourd'hui.
- [ ] **Step 4 :** Relancer, puis `npm run test:tz && npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(opportunities): server-side rate sort and remote mode quick filters`.

### Task 12 : Liste de cartes et filtres rapides

**Files :**
- Modify : `src/components/opportunities-board/{controller.tsx,interfaces.ts,opportunities-board.tsx,controller.test.tsx,opportunities-board.test.tsx}`
- Modify : `src/components/opportunity-card/{opportunity-card.tsx,opportunity-card.test.tsx}`, `src/components/opportunity-feed-freshness/{opportunity-feed-freshness.tsx,opportunity-feed-freshness.test.tsx}`, `src/app/(app)/opportunites/page.tsx`

**Interfaces :**
- Consomme : tâche 11, `PillToggle`, `Pill`, `PillTabs`, `REMOTE_MODE_LABELS`, `FREE_WORK_PREFERENCES_ROUTE`.
- Produit :
  - `ListOpportunities = (tab, cursor, search, quickFilters: OpportunityQuickFilters) => Promise<ActionResult<OpportunityListing>>` ;
  - le contrôleur ajoute `quickFilters`, `toggleSortByRate()` et `toggleRemoteMode(mode: RemoteMode)`. Chaque changement recharge l'onglet courant depuis le début (curseur `null`), sans délai, avec la recherche appliquée. Les réponses obsolètes sont ignorées (même mécanisme que la recherche) ;
  - `selectTab` et `loadMore` passent les filtres courants ;
  - `toListingCursor` ajoute `rate: getOpportunityEffectiveRate(dernierÉlément)` ;
  - les filtres ne sont pas mis dans l'URL.
- **Rendu (maquettes `OppListe.html` et `OppTableau.html`) :**
  - **En-tête :** le fil de fraîcheur « Free-Work · mis à jour il y a {formatDistance} » (alerte V2 conservée), et le lien « Mes filtres Free-Work » vers `/preferences/opportunites/free-work`.
  - **Ligne de recherche :** le champ existant, puis :
    - `PillToggle` « Trier par TJM » ;
    - `role="group"` `aria-label="Présentiel"` avec trois `PillToggle` : « Full remote », « Hybride », « Sur site ».
  - **État vide :**
    - recherche active → message V3 ;
    - sinon, avec `remoteModes` non vide → « Aucune mission ne correspond à ces filtres. ».
  - **Carte :**
    - titre et `Pill` « nouveau » en `lilac` ;
    - TJM `formatOpportunityRate` en `font-heading text-forest` à droite ;
    - faits sans le TJM : entreprise · mode · lieu · durée · ancienneté ;
    - description sur 3 lignes avec « Afficher la suite » ;
    - boutons dans l'ordre : « J'ai postulé » (principal), « Voir sur Free-Work » (`outline`), puis « Pas intéressé » (`ghost`, `ml-auto`). Ignorées garde « Remettre » ;
    - les états « Création… » et « Candidature créée · Voir la candidature » sont conservés ;
    - la variante compacte de l'accueil suit le même rendu, sur une ligne, sans description.

- [ ] **Step 1 : Tests qui échouent**
  - **Contrôleur :**
    - `toggleSortByRate()` appelle `listOpportunities('to_process', null, '', { sortByRate: true, remoteModes: [] })` ;
    - `toggleRemoteMode('none')` puis `toggleRemoteMode('full')` → le dernier appel reçoit `remoteModes: ['full','none']`. Un second `toggleRemoteMode('full')` le retire ;
    - `loadMore` envoie le curseur `{ publishedAt, id, rate: 650 }` pour un dernier élément à `rateMax: 650`, avec les filtres courants ;
    - `selectTab('applied')` garde les filtres ;
    - une réponse arrivée après une réponse plus récente est ignorée.
  - **Rendu :**
    - « Trier par TJM » avec `aria-pressed="false"`, puis `"true"` après un clic ;
    - le `group` « Présentiel » contient trois boutons à `aria-pressed` ;
    - le lien « Mes filtres Free-Work » pointe vers `/preferences/opportunites/free-work` ;
    - l'état vide filtré affiche « Aucune mission ne correspond à ces filtres. ».
  - **Carte :**
    - « nouveau » en `data-tone="lilac"` ;
    - le TJM « 650 €/j » est hors de la liste des faits ;
    - les boutons sont dans l'ordre « J'ai postulé », « Voir sur Free-Work », « Pas intéressé ».
  - **Fraîcheur :** « Free-Work · mis à jour il y a 25 minutes ».
- [ ] **Step 2 :** `npm test -- opportunities-board opportunity-card opportunity-feed-freshness home-dashboard`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. La page passe `NO_OPPORTUNITY_QUICK_FILTERS` au premier appel.
- [ ] **Step 4 :** Relancer, puis `npm test && npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(opportunities): card list with rate sort and remote mode pills`.

> **Point de déploiement lot 5** (contrôleur) : le porteur pousse `main`. Le contrôleur vérifie « CI/CD » (les intégrations des filtres rapides) et Vercel, puis en production :
> - le tri par TJM puis « Voir plus » donne des pages sans doublon ;
> - Hybride + Sur site met les compteurs d'onglets à jour ;
> - le compteur du menu ne change pas.

---

## Lot 6 — Calendrier, préférences, nouvelle candidature et connexion

### Task 13 : Calendrier et panneau de détail

**Files :**
- Modify : `src/components/interviews-calendar/{controller.tsx,interviews-calendar.tsx,controller.test.tsx}` ; Create : `src/components/interviews-calendar/interviews-calendar.css`
- Modify : `src/components/interview-revision-panel/{interfaces.ts,interview-revision-panel.tsx,interview-revision-panel.test.tsx}`

**Interfaces :**
- Produit :
  - `EVENT_STYLES_BY_KIND` :
    - `client` : `{ className: 'interview-client', color: 'var(--peach)', contrastColor: 'var(--ink)' }` ;
    - `mock` : `{ className: 'interview-mock', color: 'var(--lilac)', contrastColor: 'var(--ink)' }` ;
    - `other` : `{ className: 'interview-other', color: 'var(--hairline)', contrastColor: 'var(--ink)' }` ;
  - `INTERVIEW_KIND_TONES: Record<InterviewKind, PillTone>` (`peach`, `lilac`, `sage`) pour la légende ;
  - `InterviewRevisionPanelContent` gagne `briefHref: string` (= `jobApplicationTabRoute(id, 'entretiens')`).
- **Calendrier :**
  - la barre FullCalendar existante est restylée en CSS (`interviews-calendar.css`, sous `.fc`, avec les variables de jetons) :
    - boutons précédent / suivant / « Aujourd'hui » en pilule ;
    - vues Mois / Semaine / Liste en pilule, la vue active en forêt ;
    - cases de jour arrondies, jour courant cerclé de forêt ;
  - la légende reprend les trois types avec un `Pill` par type.
- **Panneau :**
  - le panneau n'est plus une fenêtre modale. C'est un `<aside aria-labelledby>` en ligne, à droite du calendrier sur `lg` (`grid lg:grid-cols-[1fr_22rem]`) et en dessous sur petit écran ;
  - il est rendu seulement quand un entretien est sélectionné. Le focus va sur son titre à l'ouverture et revient sur le calendrier à la fermeture (« Fermer », ou `Escape` dans le panneau) ;
  - le contenu existant est conservé ;
  - la stack est en `Pill` `sage` ;
  - « Ouvrir la candidature » devient « Ouvrir la fiche » (`jobApplicationHref`), suivi d'un lien `outline` « Voir mon brief » (`briefHref`).

- [ ] **Step 1 : Tests qui échouent**
  - **Contrôleur :**
    - les trois entrées de `EVENT_STYLES_BY_KIND` ci-dessus ;
    - `toRevisionPanelContent` donne `briefHref` = `/candidatures/a1?onglet=entretiens`.
  - **Panneau :**
    - un `complementary` nommé par le titre de la mission ;
    - le lien « Ouvrir la fiche » pointe vers `/candidatures/a1`, et « Voir mon brief » vers `/candidatures/a1?onglet=entretiens` ;
    - les éléments de stack ont `data-tone="sage"` ;
    - « Fermer » et `Escape` appellent `onClose` ;
    - les tests de contenu existants sont adaptés du rôle `dialog` au rôle `complementary`.
- [ ] **Step 2 :** `npm test -- interviews-calendar interview-revision-panel`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(calendar): atelier calendar and inline interview panel`.

### Task 14 : Préférences

**Files :**
- Modify : `src/components/settings-navigation/settings-navigation.tsx` et son test, `src/app/(app)/preferences/page.tsx`, `src/app/(app)/preferences/opportunites/free-work/page.tsx`
- Modify : `src/components/keyword-tags-input/{keyword-tags-input.tsx,interfaces.ts}` ; Create : `keyword-tags-input.test.tsx`
- Modify : `src/components/opportunity-filters-form/{opportunity-filters-form.tsx,controller.tsx,controller.test.tsx,opportunity-filters-form.test.tsx}`, `src/components/profile-form/profile-form.tsx`, `src/components/anthropic-api-key-form/anthropic-api-key-form.tsx` (style seulement)

**Interfaces :**
- Produit :
  - `KeywordTagsInputProps` gagne `tone: PillTone`. Chaque mot est un `Pill` du ton, avec un bouton retirer (`X` de lucide, `aria-label` « Retirer {mot} »), et la liste n'a pas de hauteur minimale ;
  - les tons par section :
    - « inclure » (`includeKeywords`) → `sage` ;
    - `alwaysExcludeKeywords` → `clay` ;
    - `rescuableExcludeKeywords` → `peach` ;
    - `rescueKeywords` → `lilac` ;
  - le contrôleur des filtres remplace `setRegions` par `toggleRegion(region: string)`. Il retire toutes les valeurs dont `normalizeForKeywordMatch` est égal, sinon il ajoute la région.
- **Rendu :**
  - **Navigation :** un menu secondaire (« Profil », « Opportunités · Free-Work ») en pilules, vertical à gauche sur `lg` et horizontal au-dessus sur petit écran ;
  - **Profil**, en trois cartes :
    - le formulaire : prénom, nom, relance, et les lignes de liens existantes en lignes arrondies, avec le bouton « + Ajouter un lien » ;
    - la clé Claude sur `bg-ink`, texte `text-primary-foreground` et secondaire `text-hairline` (actions et confirmation inchangées) ;
    - « Mes données » sur `bg-lilac`, avec « Exporter mes données ».
  - **Free-Work :**
    - les quatre listes de mots-clés ;
    - le TJM minimum en trois champs sur une ligne (empilés sous `sm`) ;
    - « Régions » en `PillToggle` sur l'union triée (`localeCompare` `fr`) des régions connues et des régions sélectionnées ;
    - le bouton « Enregistrer les filtres ».

- [ ] **Step 1 : Tests qui échouent**
  - **`keyword-tags-input` :**
    - le mot « react » est rendu en `data-tone="clay"` quand `tone='clay'` ;
    - « Retirer react » appelle `onChange` sans « react ».
  - **Contrôleur des filtres :**
    - `toggleRegion('Île-de-France')` ajoute la région ;
    - avec `regions: ['ile-de-france']`, `toggleRegion('Île-de-France')` la retire.
  - **Formulaire des filtres :**
    - la région connue « Bretagne » est un bouton `aria-pressed="false"`, et une région sélectionnée absente des connues est rendue `aria-pressed="true"` ;
    - le bouton s'appelle « Enregistrer les filtres ».
  - **`settings-navigation` :** les libellés et `aria-current` sont inchangés.
- [ ] **Step 2 :** `npm test -- keyword-tags-input opportunity-filters-form settings-navigation profile-form`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(preferences): atelier profile cards and coloured Free-Work filters`.

### Task 15 : Nouvelle candidature, connexion et vérification finale

**Files :**
- Modify : `src/components/new-job-application-form/{new-job-application-form.tsx,controller.tsx,controller.test.tsx,new-job-application-form.test.tsx}`, `src/app/(app)/candidatures/new/page.tsx`
- Modify : `src/app/login/page.tsx`, `src/components/login-form/login-form.tsx` ; Create : `src/components/login-form/login-form.test.tsx`
- Modify : `README.md`

**Interfaces :**
- Le contrôleur de la nouvelle candidature ajoute `isPrefilledByClaude: boolean`. Il passe à `true` quand `extract` réussit, et à `false` après une saisie manuelle ou un échec.
- **Nouvelle candidature :**
  - **colonne 1**, carte `bg-lilac`, `<h2>` « 1 · Colle l'annonce » :
    - à l'étape `paste` : le texte de l'annonce, puis le bouton « Pré-remplir avec l'IA » (au lieu de « Pré-remplir ») et « Saisie manuelle » ;
    - à l'étape `form` : la zone « Texte de l'annonce » du formulaire et « Réessayer le pré-remplissage » en cas d'échec ;
  - **colonne 2**, carte blanche, `<h2>` « 2 · Vérifie » :
    - à l'étape `paste` : « Le formulaire apparaît ici après le pré-remplissage ou en saisie manuelle. » ;
    - à l'étape `form` :
      - trois `fieldset` : « La mission » (titre, source, lien, statut, date de candidature), « Les personnes » (intermédiaire, contact, e-mail, téléphone, client final, groupe) et « Les conditions » (TJM annoncé, lieu, télétravail, démarrage, durée) ;
      - « Technologies », puis « Créer la candidature » ;
      - la source en `PillToggle` sur `SOURCE_SUGGESTIONS`, pressée si `formValues.source` est égal à la suggestion. Un clic écrit la suggestion dans le champ « Source », qui reste éditable ;
      - le `Pill` `lilac` « Pré-rempli par Claude » à côté du titre quand `isPrefilledByClaude` est vrai ;
  - les deux colonnes s'empilent sous `lg`. Champs, validations et messages inchangés.
- **Connexion :**
  - un panneau `bg-forest` contient « Freeclutch » (`font-heading`), `<h1>` « Toutes tes missions freelance, au même endroit. » et la phrase « Candidatures, entretiens, briefs et nouvelles missions Free-Work, sans rien oublier. ». Il est à gauche sur `lg`, et au-dessus en plus court sur petit écran ;
  - à droite, une carte blanche :
    - `<h2>` « Connexion » ;
    - le message de lien invalide existant ;
    - `LoginForm`, inchangé hors style ;
    - sous le formulaire, « Accès sur invitation uniquement. », affiché aussi dans l'état « envoyé ».

- [ ] **Step 1 : Tests qui échouent**
  - **Nouvelle candidature :**
    - les titres « 1 · Colle l'annonce » et « 2 · Vérifie » ;
    - le bouton « Pré-remplir avec l'IA », désactivé sans clé, avec la note « Ajoute ta clé Claude dans tes préférences » ;
    - après une extraction réussie (`extractJobPosting` simulé), « Pré-rempli par Claude » est visible, mais pas après « Saisie manuelle » ;
    - un clic sur la pastille « Malt » met « Malt » dans le champ « Source » et passe la pastille à `aria-pressed="true"` ;
    - les `group` « La mission », « Les personnes » et « Les conditions » existent ;
    - le test « TJM invalide » existant reste vert.
  - **Contrôleur :** `isPrefilledByClaude` vaut `true` après une extraction réussie et `false` après un échec.
  - **`login-form` :**
    - « Accès sur invitation uniquement. » dans les états initial et envoyé ;
    - « Recevoir un lien de connexion » ;
    - « Envoi en cours… » pendant l'envoi.
- [ ] **Step 2 :** `npm test -- new-job-application-form login-form`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Le README gagne une section courte « Identité Atelier » : où vivent les jetons, la liste des tons de `Pill` et la règle sur le contraste en fond pêche.
- [ ] **Step 4 :** `npm run lint && npm run typecheck && npm test && npm run test:tz && npm run test:integration && npm run build`. Attendu : tout passe. Ensuite, `grep -rn "dark:\|#[0-9A-Fa-f]\{6\}" src --include=*.tsx` ne renvoie rien.
- [ ] **Step 5 :** Commit `feat(design): atelier new application and login pages`.

> **Point de déploiement lot 6** (contrôleur) : le porteur pousse `main`. Le contrôleur vérifie « CI/CD » et Vercel, puis en production, à 360 px et sur grand écran :
> - calendrier, couleurs et panneau ;
> - « Voir mon brief » ouvre l'onglet Entretiens ;
> - préférences (enregistrement des filtres) ;
> - nouvelle candidature avec pré-remplissage ;
> - connexion par lien magique.
