# Lien LinkedIn et alerte doublon de positionnement — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deux petites demandes du porteur, sur le web (Freeclutch) et le mobile (aled-mobile).
1. **LinkedIn en lecture.** En mode lecture, un lien LinkedIn s'affiche comme le logo LinkedIn suivi du mot « LinkedIn » en bleu, cliquable. L'URL brute ne s'affiche plus.
2. **Alerte doublon.** À la saisie d'une candidature, si le même client final a reçu une candidature de moins d'un mois par une autre agence, on affiche « Ce positionnement risque de faire doublon, attention. ». C'est un avertissement : il ne bloque pas l'enregistrement.

**Architecture :**
- Un composant web `linkedin-link`, avec un SVG inline en `currentColor` (lucide 1.x n'a plus de logos de marques) et un token de couleur `--linkedin`.
- Côté mobile, l'équivalent dans le composant de détail.
- Un domaine pur `src/domain/duplicate-positioning.ts`, recopié à l'identique sur le mobile. Il compare par nom normalisé, car les formulaires saisissent les noms, pas des identifiants.
- Les listes de candidatures déjà chargées alimentent l'alerte.

**Spec (conversation du 2026-10-23, réponses du porteur) :**
- « Linkedin mettre le lien mais sur la view mode juste afficher le logo linkedin avec le mot "Linkedin" en bleu ».
- « si je met le même client final alors que j'ai une autre candidature récente (moins d'un mois) faut que j'ai un message "ce positionnement risque de faire doublon attention" … si un cv est envoyé par 2 agences différentes au même client c'est KO la mission ».
- Règles par défaut annoncées au porteur, sans objection de sa part :
  - même client final, ou même groupe ;
  - candidature à moins de 30 jours ;
  - agence différente ou inconnue ;
  - les candidatures KO comptent aussi ;
  - l'alerte apparaît dans le formulaire de nouvelle candidature, dans la modification du client final (web) et dans la vérification de « J'ai eu un call » (mobile).

## Global Constraints

- CLAUDE.md du porteur :
  - fonctions fléchées, `export const` (sauf `page.tsx`/`layout.tsx` et les routes expo-router) ;
  - jamais de `any`, aucun `console.log`, pas de commentaire ;
  - noms explicites ;
  - aucun import inutilisé ;
  - un dossier par composant avec `interfaces.ts`, `index.ts` et `controller.tsx` si la logique dépasse 4 fonctions.
- Style : guillemets simples, pas de point-virgule. Ne jamais lancer de formateur.
- Web : couleurs uniquement par tokens de `src/app/globals.css`, avec un bloc clair et un bloc sombre ; `src/app/atelier-theme.test.ts` doit rester vert.
- Mobile : couleurs uniquement par le thème existant (clair et sombre). Les fichiers `src/domain/*` sont des copies **à l'identique** du web.
- Git : committer sur la branche courante, ne jamais créer ni changer de branche, **jamais de `git push`**. Pas de ligne `Co-Authored-By` ni de mention d'IA. Utiliser `git add <chemins>`.
- Commandes :
  - web : `npm test -- <motif>`, `npm run typecheck`, `npm run lint` ;
  - mobile : `npx jest <motif>`, `npm run typecheck`, `npm run lint` ;
  - PATH : `export PATH="/usr/local/bin:$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Review Focus

1. **Les URL LinkedIn invalides** (pas http(s), `javascript:`) ne deviennent jamais des liens : on garde la règle `isExternalLinkUrl`.
2. **Les noms de client écrits différemment** (« Société Générale » contre « societe generale », espaces en trop) sont reconnus comme le même client.
3. **La candidature en cours de modification** ne se signale jamais elle-même.
4. **Même agence à moins d'un mois :** pas d'alerte, ce n'est pas un doublon d'agence.
5. **La limite des 30 jours** se compte en jours calendaires de Paris, et vaut dans les deux sens : une candidature datée après la nouvelle compte aussi.

---

### Task 1: Domaine `duplicate-positioning` (web)

**Files:** Create `src/domain/duplicate-positioning.ts`, `src/domain/duplicate-positioning.test.ts`

**Interfaces — Produces:**
- `DUPLICATE_POSITIONING_WINDOW_DAYS = 30`
- `DUPLICATE_POSITIONING_MESSAGES = { warning: 'Ce positionnement risque de faire doublon, attention.', detail: "Ce client a déjà reçu ton CV il y a moins d'un mois par une autre agence. Si deux agences le présentent, la mission est souvent perdue." }`
- `type PositioningCandidate = { jobApplicationId: string | null; endClientName: string | null; endClientParentName: string | null; intermediaryName: string | null; appliedOn: Date }`
- `type PositionedJobApplication = { id: string; title: string; endClientName: string | null; endClientParentName: string | null; intermediaryName: string | null; appliedOn: Date }`
- `normalizeOrganisationName(name: string | null): string`. Elle passe en minuscules, retire les accents (NFD puis suppression des marques diacritiques), remplace tout ce qui n'est pas une lettre ou un chiffre par un espace, réduit les espaces et rogne. Le vide donne `''`.
- `findDuplicatePositioningRisks(candidate: PositioningCandidate, jobApplications: PositionedJobApplication[]): PositionedJobApplication[]`. Elle garde une candidature si **toutes** ces conditions sont vraies :
  - son id est différent de `candidate.jobApplicationId` ;
  - l'ensemble normalisé non vide `{candidate.endClientName, candidate.endClientParentName}` croise `{endClientName, endClientParentName}` ;
  - `Math.abs(countParisCalendarDaysBetween(...)) <= 30`, dans un ordre de dates ou dans l'autre ;
  - les agences normalisées diffèrent, ou l'une des deux est vide.

  Le résultat est trié par `appliedOn`, de la plus récente à la plus ancienne. Sans client final, la liste est vide.
- `describeDuplicatePositioning(jobApplication: PositionedJobApplication): string` renvoie `${title} · ${intermediaryName ?? 'agence inconnue'} · ${formatParisDate(appliedOn)}`.

- [ ] **Step 1: Write the failing tests.** Un `it` par point du Review Focus 2 à 5, plus les cas suivants :
  - même groupe : le parent du candidat est égal au client de l'existante ;
  - pas de client final ;
  - candidatures KO incluses : le statut ne compte pas ;
  - tri ;
  - libellé.
- [ ] **Step 2: Run** — `npm test -- duplicate-positioning` → FAIL.
- [ ] **Step 3: Implement.** N'importer que `@/domain/*` (`paris-time`).
- [ ] **Step 4: Run** — PASS, puis `npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(job-applications): detect a duplicate positioning on the same end client"`

### Task 2: Alerte doublon sur le web

**Files:**
- Create `src/components/duplicate-positioning-warning/`, qui rend `null` sans risque. Sinon :
  - un encadré `role="status"` ;
  - le titre `warning` en gras, puis `detail` ;
  - une liste de liens `describeDuplicatePositioning`, chacun vers `jobApplicationRoute(id)`.
- Modify `src/components/new-job-application-form/` (le controller calcule les risques à partir des valeurs saisies : client final, groupe, agence, `appliedOn`) et `src/app/(app)/candidatures/new/page.tsx`. La page passe la liste des candidatures de l'utilisateur, avec la fonction de liste existante du repository (`listJobApplicationItems`).
- Modify le formulaire de modification du client final et de l'agence d'une candidature existante. Le trouver depuis `src/app/(app)/candidatures/[jobApplicationId]/page.tsx` : c'est le formulaire qui édite `endClientName`. Il reçoit la même liste et exclut sa propre candidature.

- [ ] **Step 1: Write the failing tests:**
  - le composant : rien sans risque ; titre, détail et liens quand il y a un risque ;
  - le controller du formulaire : l'alerte apparaît dès qu'on tape un client déjà positionné par une autre agence il y a 10 jours, et disparaît si l'agence est la même ;
  - le formulaire de modification ne se signale pas lui-même.
- [ ] **Step 2–4:** RED, implémentation, GREEN, puis `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(job-applications): warn about a duplicate positioning while entering a job application"`

### Task 3: Lien LinkedIn sur le web

**Files:**
- Create `src/components/linkedin-link/` : `linkedin-link.tsx`, `interfaces.ts`, `index.ts`, `linkedin-link.test.tsx`. Props `{ url: string; label?: string; isCompact?: boolean }`.
  - Le rendu est un `<a target="_blank" rel="noopener noreferrer">` contenant un logo SVG inline (le « in » de LinkedIn, `aria-hidden`, `fill="currentColor"`, taille 16) et le texte « LinkedIn », en `text-linkedin`, avec `underline` au survol et au focus.
  - `isCompact` n'affiche que le logo, avec `aria-label={label}`.
  - Une URL refusée par `isExternalLinkUrl` ne rend pas de lien : l'appelant affiche alors la valeur manquante habituelle.
- Modify `src/app/globals.css` :
  - `--linkedin: #0A66C2` en clair ;
  - `--linkedin: #70B5F9` en sombre, pour le contraste sur les fonds sombres ;
  - `--color-linkedin: var(--linkedin)` dans `@theme`.

  Mettre à jour `atelier-theme.test.ts` s'il recense les couleurs (`LIGHT_THEME_COLOURS`, `DARK_THEME_COLOURS`). Ajouter `linkedin` aux paires de contraste avec `card` (4.5:1 minimum) si le test le permet.
- Modify `src/components/contact-view/contact-view.tsx` (`renderLinkedinUrl` → `LinkedinLink`).
- Modify `src/components/contact-profile-view/contact-profile-view.tsx` : la ligne « LinkedIn » utilise `LinkedinLink` au lieu du texte brut, et l'action reste telle quelle.
- Modify `src/components/contacts-table/contacts-table.tsx` : l'icône lien devient `LinkedinLink isCompact` avec le libellé `Profil LinkedIn de {nom}`.

- [ ] **Steps:** tests d'abord, avec un rendu par lieu d'affichage et le refus de `javascript:` (Review Focus 1). Puis l'implémentation, puis `npm test && npm run typecheck && npm run lint`.
- [ ] **Commit** — `git commit -m "feat(contacts): show LinkedIn links as the LinkedIn logo and name"`

### Task 4: Mobile — LinkedIn, domaine recopié et alerte dans « J'ai eu un call »

**Repo:** `/Users/rakedd/Personal_projects/aled-mobile`

**Files:**
- Copy, **à l'identique** : `src/domain/duplicate-positioning.ts` et `.test.ts` depuis le web, puis vérifier l'identité avec `diff`.
- LinkedIn :
  - là où la fiche contact (et la ligne contact d'une candidature, si elle existe) affiche l'URL LinkedIn, afficher le logo LinkedIn et le mot « LinkedIn » en bleu, cliquable : il ouvre l'URL avec l'utilitaire existant d'ouverture de lien ;
  - garder la règle `isExternalLinkUrl` ;
  - le bouton d'action « LinkedIn » existant reste ;
  - le logo vient de la bibliothèque d'icônes déjà installée si elle en a un (vérifier `package.json` : `@expo/vector-icons` ou `expo-symbols`), sinon `react-native-svg` s'il est installé. **Ne rien installer** : si aucune option n'existe, utiliser le texte seul en bleu et le signaler ;
  - ajouter une couleur `linkedin` au thème clair et au thème sombre, avec les mêmes valeurs que sur le web.
- Alerte doublon :
  - `src/data/loaders/load-call-log-context.ts` charge aussi les candidatures, avec `id`, `title`, `end_client_name`, `end_client_parent_name`, `intermediary_name` et `applied_on`, via la vue `job_applications_overview` et le même client Supabase ;
  - le formulaire de vérification (`src/screens/call-log-screen/call-review-form/`) affiche, quand l'interrupteur « Créer la candidature » est activé, l'avertissement `DUPLICATE_POSITIONING_MESSAGES.warning` et `detail`, et la liste `describeDuplicatePositioning`, dans un bloc `accessibilityRole="alert"` ou équivalent existant ;
  - le candidat se construit avec le client final saisi, l'agence (du contact choisi ou saisie), et la date de l'appel ;
  - le chargement ne bloque jamais l'écran s'il échoue : la liste reste vide.

- [ ] **Steps:** tests d'abord :
  - le loader : la liste mappée, et une erreur qui donne une liste vide ;
  - le formulaire : l'alerte apparaît et disparaît ;
  - le composant LinkedIn.

  Puis `npx jest && npm run typecheck && npm run lint`.
- [ ] **Commit** (repo mobile) — `git commit -m "feat: show LinkedIn links with the logo and warn about duplicate positionings in the call review"`
