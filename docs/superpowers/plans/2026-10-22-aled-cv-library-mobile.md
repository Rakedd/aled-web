# Bibliothèque de CV (mobile) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** savoir sur le téléphone quel CV a été envoyé à une candidature, et l'ouvrir en un geste ; voir ce CV dans les missions proposées des fiches contact et agence ; voir le rappel « Ton CV vieillit » sur l'accueil. Tout en lecture seule.

**Architecture:** le mobile lit les colonnes et vues créées par le plan web (`job_applications_overview.sent_cv_*`, `cvs_overview`, `cv_versions`). Il ouvre le PDF avec une URL signée créée directement par `supabase.storage.from('cvs').createSignedUrl(path, 300)`, que les politiques du bucket autorisent pour ses propres fichiers. Il reprend à l'identique les fichiers de domaine du web (`cv-library.ts`, `todo-alerts.ts`, `job-application.ts`, `contacts.ts`). Il suit le schéma existant : route mince dans `src/app` → loader ou repository dans `src/data` → écran dans `src/screens` avec `useController`.

**Tech Stack:** Expo 58, expo-router (NativeTabs, Stack), React Native 0.88, `@supabase/supabase-js`, Jest 30 (`jest-expo`) + `@testing-library/react-native`.

**Spec:** `/Users/rakedd/Personal_projects/Freeclutch/docs/superpowers/specs/2026-10-22-aled-cv-library-design.md` (§5, §9.5, §9.9).

**Prérequis :**
- les tâches 1, 2, 3 et 10 du plan web (`2026-10-22-aled-cv-library-web.md`) sont terminées : migration et types, `cv-library.ts`, `sentCv` et `ProposedMission`, union `TodoAlert` ;
- la migration est appliquée sur le projet Supabase visé par `.env.local` ;
- le plan mobile des contacts (`2026-10-22-aled-contacts-agences-mobile.md`) est entièrement exécuté. `src/data/repositories/contacts-repository.ts` (`listProposedMissionsForContact`, `listProposedMissionsForIntermediary`, `toProposedMission`) et les écrans `contact-detail-screen` et `intermediary-detail-screen` existent donc.

## Global Constraints

- Mêmes règles CLAUDE.md que le plan web : fonctions fléchées, `export const` (les routes `src/app` gardent `export default`), pas de `any`, pas de `console.log`, pas de commentaire, noms explicites, aucun code mort.
- Écran = `src/screens/<nom>-screen/` contenant `<nom>-screen.tsx`, `controller.tsx`, `interfaces.ts`, `index.ts` et les tests. Les routes `src/app` restent minces : elles injectent `supabase`, `userId` et la navigation.
- Les fichiers de `src/domain/` et `src/lib/supabase/database-types.ts` sont des **copies à l'identique** du web (`Freeclutch/src/domain/`, `Freeclutch/src/server/supabase/database-types.ts`). On les recopie, on ne les modifie jamais ici. Seul `src/domain/todo-alert-messages(.test).ts` est propre au mobile.
- Textes en français, tutoiement. Les CV sont en lecture seule sur le mobile : aucun dépôt, aucun « Il est encore bon ».
- Message d'échec d'ouverture : `CV_MESSAGES.openFailed` (« Impossible d'ouvrir le CV pour le moment. »), jamais un texte recopié à la main.
- Style de code : guillemets simples, sans point-virgule, indentation 2 espaces ; ne jamais lancer prettier ni aucun formateur ; ne jamais reformater du code existant non modifié.
- Tests asynchrones, comme le reste du dépôt (`await renderHook`, `await renderWithTheme`, `userEvent.setup()`).
- Git : committer sur la branche courante, jamais de `git push`, jamais de nouvelle branche. Messages sans `Co-Authored-By` ni mention d'outil d'IA. N'ajouter que les fichiers de la tâche.
- Commandes : `npx jest <motif>`, `npm run typecheck`, `npm run lint`. Node est dans `~/.nvm/versions/node/v24.15.0/bin` si `npx` est introuvable.

## Review Focus

1. **Version du CV introuvable ou URL signée refusée** (CV sur mesure retiré depuis le web entre le chargement et l'appui, réseau coupé) : message « Impossible d'ouvrir le CV pour le moment. » sous la ligne, pas de crash ni de navigateur vide. Test dans la tâche 2.
2. **Double appui sur la ligne « CV envoyé »** : une seule URL signée et un seul navigateur ; la ligne est désactivée pendant l'ouverture. Test dans la tâche 2.
3. **Rappel CV sur l'accueil** : il n'est lié à aucune candidature. Un appui ne doit pas pousser `/candidatures/undefined`, et la carte n'est pas pressable. Test dans la tâche 4.
4. **Deux CV qui vieillissent en même temps** : deux rappels avec deux clés distinctes, sans avertissement React de clé dupliquée, et un compteur qui compte les deux. Test dans la tâche 4.
5. **Échec de la lecture des CV** (vue absente, RLS, réseau sur cette seule requête) : l'accueil affiche quand même les rappels des candidatures, au lieu de l'écran « Pas de connexion ». Test dans la tâche 4.

---

### Task 1: Synchroniser les fichiers partagés et mapper le CV envoyé

**Files:**
- Copy from web: `src/lib/supabase/database-types.ts`, `src/domain/cv-library.ts`, `src/domain/cv-library.test.ts`, `src/domain/job-application.ts`, `src/domain/job-application.test.ts`, `src/domain/contacts.ts`, `src/domain/contacts.test.ts`
- Modify: `src/data/repositories/job-applications-repository.ts`, `src/data/loaders/load-job-application-detail.test.ts`
- Modify: `src/data/repositories/contacts-repository.ts`, `src/data/repositories/contacts-repository.test.ts`
- Modify: the test fixtures that build a `JobApplicationOverview` or a `ProposedMission` (`npm run typecheck` lists them)

**Interfaces:**
- Produces: `SentCv`, `CV_MESSAGES`, `CVS_BUCKET`, `formatSentCvShortLabel`, `formatProposedMissionSentCv` (from the copy of `cv-library.ts`); `JobApplicationOverview.sentCv: SentCv | null`; `ProposedMission.sentCvLabel: string | null` and `sentCvUploadedAt: Date | null`. All identical to the web.
- `todo-alerts(.test).ts` is **not** copied yet: task 4 does it together with its consumers.

- [ ] **Step 1: Copy** the files listed. Then run `diff -r` on `src/domain` between the two repos. The only expected differences are the mobile-only `todo-alert-messages(.test).ts`, `todo-alerts(.test).ts` (until task 4), and web files that mobile never copied.
- [ ] **Step 2: Write the failing tests**
  - `load-job-application-detail.test.ts`: `it('maps the sent cv of the application')` (`sent_cv_version_id`, `sent_cv_label`, `sent_cv_uploaded_at` → `sentCv`), and `it('maps an application without sent cv to null')`.
  - `contacts-repository.test.ts`: `it('maps the cv sent for a proposed mission')`.
- [ ] **Step 3: Run** — `npx jest load-job-application-detail contacts-repository` → FAIL
- [ ] **Step 4: Implement**, with the same mapping as web task 3:
  - in `job-applications-repository.ts`, `toJobApplicationOverview` adds `sentCv`;
  - in `contacts-repository.ts`, `PROPOSED_MISSION_COLUMNS` gains `sent_cv_label, sent_cv_uploaded_at`, and `toProposedMission` maps them (`new Date(…)` or `null`).
- [ ] **Step 5: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 6: Commit** — `git commit -m "chore(cv): sync shared cv domain and types, map the sent cv"`

---

### Task 2: Ligne « CV envoyé » et ouverture du PDF

**Files:**
- Create: `src/data/repositories/cvs-repository.ts`, `src/data/repositories/cvs-repository.test.ts`
- Create: `src/lib/browser/open-cv-version-pdf.ts`, `src/lib/browser/open-cv-version-pdf.test.ts`
- Modify: `src/screens/job-application-detail-screen/` (interfaces, controller, screen, tests)
- Modify: `src/app/(tabs)/candidatures/[jobApplicationId].tsx`

**Interfaces:**
- Consumes: `CVS_BUCKET`, `CV_MESSAGES`, `formatSentCvShortLabel` (task 1); `openWebPage` (existing).
- Produces:
  - `createCvVersionSignedUrl(supabase: AledSupabaseClient, userId: string, versionId: string): Promise<string | null>`, in `cvs-repository.ts`:
    - it reads `storage_path` from `cv_versions` (`id`, `user_id`, `maybeSingle`);
    - an unknown version → `null`;
    - then it calls `supabase.storage.from(CVS_BUCKET).createSignedUrl(storagePath, CV_SIGNED_URL_VALIDITY_IN_SECONDS)`, with `CV_SIGNED_URL_VALIDITY_IN_SECONDS = 300`;
    - a query or signing error is thrown (`toRepositoryError` for the query).
  - `openCvVersionPdf(supabase: AledSupabaseClient, userId: string, versionId: string): Promise<void>`. It throws `new Error('Cv version not found')` when the URL is `null`, and otherwise awaits `openWebPage(signedUrl)`.
  - `JobApplicationDetailScreenProps` gains `openSentCv: (versionId: string) => Promise<void>`.
  - The controller gains `openSentCvPdf: () => Promise<void>`, `isOpeningSentCv: boolean` and `sentCvErrorMessage: string | null`. `openSentCvPdf` returns immediately while an opening is in flight. A rejection logs `console.error('Sent cv opening failed', error)` and sets `CV_MESSAGES.openFailed`.

- [ ] **Step 1: Write the failing tests**
  - `cvs-repository.test.ts`, with a fake Supabase client like `contacts-repository.test.ts`:
    - `it('signs the storage path of the version for five minutes')`, which checks `createSignedUrl(path, 300)`;
    - `it('returns null for an unknown version')`;
    - `it('throws when signing fails')`.
  - `open-cv-version-pdf.test.ts`: `it('opens the signed url in the browser')`, `it('throws when the version is unknown')`.
  - `job-application-detail-screen.test.tsx`:
    - `it('shows the sent cv with its date')` → `CV DevOps · 12/03/2026`;
    - `it('opens the sent cv pdf when the row is pressed')`;
    - `it('shows Impossible d'ouvrir le CV pour le moment. when opening fails')` (Review Focus 1);
    - `it('keeps the cv row static with a dash when no cv was sent')`.
  - `controller.test.tsx`: `it('opens the pdf only once on a double press')` (Review Focus 2).
- [ ] **Step 2: Run** — `npx jest cvs-repository open-cv-version-pdf job-application-detail` → FAIL
- [ ] **Step 3: Implement**
  - The « CV envoyé » row goes right after « Contact ».
  - With a sent CV, it is pressable (`accessibilityRole="link"`, `accessibilityLabel="Ouvrir le CV envoyé"`, disabled while `isOpeningSentCv`). Reuse the pressable row the contacts plan built for « Contact »; otherwise wrap `DetailRow` in a `Pressable`.
  - Without a CV, it is a plain `DetailRow` with value `null` (« — »).
  - The error message goes under the row, rendered like `statusErrorMessage` (`View role="alert"`, `AppText variant="caption" color="clay"`).
  - The route passes `openSentCv={(versionId) => openCvVersionPdf(supabase, userId, versionId)}`.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device:
  - a candidature with a sent CV opens the PDF;
  - remove the CV from the web, then press again: you get the error message.
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): show and open the sent cv of a job application"`

---

### Task 3: CV envoyé dans les missions proposées

**Files:**
- Modify: the proposed mission rows of `src/screens/contact-detail-screen/` and `src/screens/intermediary-detail-screen/` (find them with `grep -rn "proposedMissions" src/screens`). If the contacts plan extracted a shared mission row component, change only that component.
- Modify: `contact-detail-screen.test.tsx`, `intermediary-detail-screen.test.tsx`

**Interfaces:**
- Consumes: `ProposedMission.sentCvLabel` and `sentCvUploadedAt`, `formatProposedMissionSentCv` (task 1).

- [ ] **Step 1: Write the failing tests**, in both screen tests:
  - `it('shows the cv sent for a proposed mission')` → `CV : CV DevOps (12/03/2026)`;
  - `it('shows no cv line for a mission without cv')`.
- [ ] **Step 2: Run** — `npx jest contact-detail intermediary-detail` → FAIL
- [ ] **Step 3: Implement**. The line is an `AppText` with `variant="caption"` and `color="inkMuted"`, under the mission date, shown only when both fields are present.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): show the sent cv in proposed missions"`

---

### Task 4: Rappel « Ton CV vieillit » sur l'accueil

**Files:**
- Copy from web: `src/domain/todo-alerts.ts`, `src/domain/todo-alerts.test.ts`
- Modify: `src/domain/todo-alert-messages.ts`, `src/domain/todo-alert-messages.test.ts` (mobile-only)
- Modify: `src/data/repositories/cvs-repository.ts` and its test
- Modify: `src/data/loaders/load-todo-reminders.ts`, `load-todo-reminders.test.ts`
- Modify: `src/screens/home-screen/build-home-view.ts`, `build-home-view.test.ts`, `home-screen.tsx`, `home-screen.test.tsx`

**Interfaces:**
- Consumes: `TodoAlert` (union), `TodoAlertKind`, `AlertCv`, `isJobApplicationTodoAlert`, `CvOutdatedTodoAlert` (copy of web task 10); `formatCvOutdatedMessage` (task 1).
- Produces:
  - `listAlertCvs(supabase: AledSupabaseClient, userId: string): Promise<AlertCv[]>`, in `cvs-repository.ts`. It reads `cvs_overview` (`id, label, reviewed_at, current_version_uploaded_at`) and throws on error.
  - `loadTodoReminders` adds `listAlertCvs(...)` to its `Promise.all`, through a `.catch` that logs `console.error('Cv reminders loading failed', error)` and returns `[]`. It then passes `cvs` to `computeTodoAlerts`.
  - In `todo-alert-messages.ts`, the same changes as web `format-todo-alert.ts`:
    - `TODO_ALERT_KIND_TAG_LABELS: Record<TodoAlertKind, string>` with `cv_outdated: 'CV à revoir'`;
    - `formatTodoAlertKindCount('cv_outdated', n)` → `{n} CV à revoir`;
    - `getTodoAlertKey` → `cv:{cvId}:cv_outdated`;
    - `formatTodoAlertMessage` handles the CV alert with `formatCvOutdatedMessage`.
  - `HomeReminder` becomes `{ key: string; jobApplicationId: string | null; tagLabel: string; tone: PillTone; message: string; subtitle: string | null }`. `TODO_ALERT_KIND_TONES` gains `cv_outdated: 'peach'`. `CV_REMINDER_SUBTITLE = "Mets-le à jour depuis l'app web."` is exported from `build-home-view.ts`.

- [ ] **Step 1: Copy** `todo-alerts(.test).ts` from the web, then run `diff -r` on `src/domain` again. Now only `todo-alert-messages(.test).ts` and the web-only files may differ.
- [ ] **Step 2: Write the failing tests**
  - `cvs-repository.test.ts`: `it('reads the review dates of every cv')`.
  - `load-todo-reminders.test.ts`:
    - `it('passes the cv review dates to the alert computation')`;
    - `it('still returns job application reminders when the cv query fails')` (Review Focus 5).
  - `todo-alert-messages.test.ts`:
    - `it('writes the cv reminder message')` → `Ton CV DevOps n'a pas bougé depuis 3 mois. Un coup de neuf ?`;
    - `it('labels and counts cv reminders')`;
    - `it('builds a cv reminder key per cv')`.
  - `build-home-view.test.ts`:
    - `it('builds a cv reminder without job application and with the web app subtitle')`;
    - `it('gives each outdated cv its own reminder key')` (Review Focus 4);
    - `it('counts cv reminders in the summary sentence')`.
  - `home-screen.test.tsx`: `it('shows the cv reminder as a static card that opens nothing')` (Review Focus 3). The card has no button role, and pressing its text does not call `onOpenJobApplication`.
- [ ] **Step 3: Run** — `npx jest cvs-repository load-todo-reminders todo-alert-messages build-home-view home-screen` → FAIL
- [ ] **Step 4: Implement**
  - `buildHomeView` uses `isJobApplicationTodoAlert`:
    - a job application reminder keeps its current fields, with `subtitle: null`;
    - a CV reminder gets `jobApplicationId: null` and `subtitle: CV_REMINDER_SUBTITLE`.
  - `home-screen.tsx` renders a reminder with `jobApplicationId === null` in a `Card`, not a `PressableCard`. The card shows the pill, the message, then the subtitle in `caption` / `inkMuted`.
- [ ] **Step 5: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device: set a CV 91 days back from the web database, then pull to refresh the home screen. The reminder shows, and pressing it does nothing.
- [ ] **Step 6: Commit** — `git commit -m "feat(cv): show the outdated cv reminder on the home screen"`
