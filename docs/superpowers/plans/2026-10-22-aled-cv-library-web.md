# Bibliothèque de CV (web + base) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page « Mes CV » (déposer, voir, remplacer, renommer, supprimer), le CV envoyé rattaché à chaque candidature sans jamais perdre le fichier exact, le CV visible dans les missions proposées, et un rappel « Ton CV vieillit » dans « À faire », sur l'app web et la base Supabase.

**Architecture:** une migration additive crée `cvs` et `cv_versions` (une version = un PDF immuable), le bucket privé `cvs`, et la colonne `job_applications.sent_cv_version_id`. La limite de 10 CV est tenue par un trigger, et la règle de conservation (§3.4) par une fonction SQL `delete_unreferenced_cv_versions` qui supprime les versions que plus rien ne désigne et renvoie leurs chemins ; l'app supprime ensuite les fichiers. Deux vues `security_invoker` (`cvs_overview`, `cv_versions_overview`) et `job_applications_overview` recréée exposent le CV envoyé au web et au mobile. Côté Next.js : un repository `cvs-repository`, des server actions avec `runAuthenticatedOperation`, une route PDF signée, une page serveur et des composants client avec `useController`. Le rappel étend `TodoAlert` en union discriminée, sans toucher l'énum `alert_kind`.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), React 19, Supabase (Postgres, RLS, Storage, `@supabase/ssr`), Tailwind 4 + shadcn (`base-nova`), Jest 30 + Testing Library, intégration sur Supabase local.

**Spec:** `docs/superpowers/specs/2026-10-22-aled-cv-library-design.md` (§9 « Précisions » fait foi en cas de doute). Le plan mobile qui suit est `docs/superpowers/plans/2026-10-22-aled-cv-library-mobile.md` ; il dépend des tâches 1, 2, 3 et 10 de ce plan.

## Global Constraints

- CLAUDE.md du porteur : fonctions fléchées uniquement, `export const` (sauf `page.tsx`/`layout.tsx`, qui gardent `export default`), jamais de `any`, aucun `console.log`, pas de commentaire sauf logique vraiment complexe, noms longs et explicites, aucun import ou variable inutilisé.
- Composant = dossier kebab-case contenant `<nom>.tsx`, `interfaces.ts`, `index.ts` (`export * from './<nom>'`), et `controller.tsx` (`useController`) dès que le composant a de la logique. Tests à côté : `<nom>.test.tsx` et `controller.test.tsx`.
- AGENTS.md : lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire une page, une route ou du code de navigation (Next 16 : `PageProps<'/route'>`, `notFound()`, `redirect()`).
- Textes d'interface en français, tutoiement, comme le reste de l'app.
- Messages : ceux de `CV_MESSAGES` (tâche 2), copiés mot pour mot du spec. On réutilise `JOB_APPLICATION_NOT_FOUND_MESSAGE` et `hasPdfSignature` (`src/domain/job-spec.ts`) tels quels.
- Limites : 10 CV (`MAXIMUM_CV_COUNT`), 4 Mo par PDF (`MAX_CV_PDF_BYTES`), nom de CV 100 caractères (`MAXIMUM_CV_LABEL_LENGTH`), rappel à 90 jours (`CV_REVIEW_INTERVAL_DAYS`).
- Les fichiers de `src/domain/` et `src/server/supabase/database-types.ts` sont recopiés **à l'identique** dans `aled-mobile` (plan mobile). Ils ne doivent donc rien importer de `@/server` ni de `server-only`. `src/domain/cv-library.ts` n'importe que `action-result`, `input-validation`, `paris-time` et `french-plural` (le mobile n'a pas `job-spec.ts`).
- Style de code : guillemets simples, sans point-virgule, indentation 2 espaces ; ne jamais lancer prettier ni aucun formateur ; ne jamais reformater du code existant non modifié.
- Git : committer sur la branche courante, sans créer ni changer de branche, et **jamais de `git push`**. Messages de commit sans aucune ligne `Co-Authored-By` ni mention d'outil d'IA. N'ajouter que les fichiers de la tâche (`git add <chemins>`), jamais `git add -A`.
- Commandes : `npm test -- <motif>`, `npm run typecheck`, `npm run lint`. Intégration : `npx supabase start`, puis `npx supabase db reset`, puis `npm run test:integration -- <motif>`.

## Review Focus

1. **Restauration par-dessus des données existantes quand l'utilisateur a déjà 10 CV** : un `upsert` déclenche les triggers `before insert` même quand la ligne existe. Le trigger de limite doit exclure la ligne elle-même (`id <> new.id`), sinon toute restauration d'un compte plein échoue. Tests dans les tâches 1 et 11.
2. **Deux dépôts simultanés à 9 CV** (double clic, deux onglets) : exactement un passe. Un simple `count(*)` dans le trigger ne suffit pas en `read committed` ; il faut un verrou consultatif par utilisateur. Test dans la tâche 1.
3. **Fichier renommé en `.pdf` qui n'est pas un PDF** (le navigateur envoie `application/pdf`, mais pas de signature `%PDF-`) : refus avec « Ce fichier n'est pas un PDF valide. », et ni ligne ni fichier ne restent. Test dans la tâche 5.
4. **CV supprimé dans un autre onglet entre l'affichage du formulaire de création et l'envoi** : la candidature est créée sans CV et sans erreur. Si l'action échouait après l'insertion, la personne réessaierait et créerait un doublon. Test dans la tâche 5.
5. **CV renommé ou supprimé après l'envoi** : la candidature garde le nom de l'époque et le fichier exact. En revanche, renommer un CV dont la version actuelle n'a jamais été envoyée renomme aussi cette version ; sinon, une candidature rattachée après le renommage afficherait l'ancien nom. Test dans la tâche 4.

---

### Task 1: Migration, vues, bucket et types

**Files:**
- Create: `supabase/migrations/20261022120000_cv_library.sql`
- Modify: `src/server/supabase/database-types.ts` (régénéré avec `npm run db:types`)
- Create: `tests/integration/cv-library-schema.test.ts`

**Interfaces:**
- Produces, pour toutes les tâches suivantes et le plan mobile :
  - table `cvs` : `id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, label text not null, current_version_id uuid, reviewed_at timestamptz not null default now(), created_at, updated_at`, `unique (user_id, id)` ;
  - table `cv_versions` : `id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, cv_id uuid, label text not null, storage_path text not null, file_name text not null, byte_size int not null, uploaded_at timestamptz not null default now(), created_at timestamptz not null default now()`, `unique (user_id, id)` ;
  - colonne `job_applications.sent_cv_version_id uuid` ;
  - fonction `public.delete_unreferenced_cv_versions(candidate_version_ids uuid[]) returns setof text` (chemins des fichiers à supprimer) ;
  - vue `cvs_overview` : toutes les colonnes de `cvs`, plus `current_version_uploaded_at, current_version_file_name, current_version_storage_path, sent_count` ;
  - vue `cv_versions_overview` : toutes les colonnes de `cv_versions`, plus `sent_count` ;
  - vue `job_applications_overview` : toutes ses colonnes actuelles (y compris `intermediary_kind`), plus `sent_cv_label, sent_cv_uploaded_at` ;
  - bucket `cvs`.

- [ ] **Step 1: Write the failing integration tests** in `tests/integration/cv-library-schema.test.ts`. Use `createSignedInTestClient`, `createServiceRoleTestClient` and `createJobApplicationOrFail`, like `contacts-schema.test.ts`. A local helper `insertCvWithVersion(user, label)` inserts a version (`cv_id: null`), then the CV with `current_version_id`, then sets the version's `cv_id`.
  - `it('refuses an eleventh cv with a check violation')`: 10 inserts succeed; the 11th fails with `error.code === '23514'`.
  - `it('lets an upsert of an existing cv through when the library already has 10 cvs')`: with 10 CVs, `upsert` one of them with a new label → no error (Review Focus 1).
  - `it('accepts exactly one of two simultaneous inserts at nine cvs')`: with 9 CVs, `Promise.all` of two inserts → one `error === null`, one `'23514'`, and 10 rows in the end (Review Focus 2).
  - `it('does not count tailored versions in the limit')`: with 10 CVs, inserting a version with `cv_id: null` succeeds.
  - `it('detaches versions and keeps them when their cv is deleted')`: deleting the CV leaves its version with `cv_id === null`.
  - `it('clears the sent cv of a job application when its version is deleted')`.
  - `it('refuses a version pointing at another user cv')`: user B inserts a version with user A's `cv_id` → error (FK `23503` or RLS).
  - `it('deletes only unreferenced versions and returns their storage paths')`: version V1 is the current version of a CV, V2 is sent by a job application, V3 is referenced by nothing. `rpc('delete_unreferenced_cv_versions', { candidate_version_ids: [V1, V2, V3] })` returns `[V3.storage_path]`, and only V3 is gone.
  - `it('does not delete another user version through the cleanup function')`: user B calls the function with user A's unreferenced version id → `[]`, and the row remains.
  - `it('exposes the current version and the sent count in cvs_overview')`: a CV with two versions, the old one sent by two job applications → `current_version_*` = the new version, `sent_count === 2`.
  - `it('counts the job applications of each version in cv_versions_overview')`.
  - `it('adds the sent cv label and upload date to job_applications_overview and keeps its columns')`: `sent_cv_label` and `sent_cv_uploaded_at` come from the version; `has_job_spec`, `intermediary_kind` and `last_activity_at` are still selectable.
  - `it('hides cvs, versions and the cv overviews of another user')`.
  - `it('refuses to read, overwrite or delete a file in another user cv folder')`: storage `download`, `upload` with `upsert: true`, and `remove` of `{userA}/{id}.pdf` done by user B → refused or no effect.
  - `it('refuses a non pdf file and a pdf over 4 MB in the cvs bucket')`.
- [ ] **Step 2: Run them and confirm they fail**

Run: `npx supabase db reset && npm run test:integration -- cv-library-schema`
Expected: FAIL (missing tables / function / bucket)

- [ ] **Step 3: Write the migration**

The migration contains, in this order:
- `create table public.cvs (...)` without the foreign key to the versions, then `create table public.cv_versions (...)` with `foreign key (user_id, cv_id) references public.cvs (user_id, id) on delete set null (cv_id)`.
- `alter table public.cvs add foreign key (user_id, current_version_id) references public.cv_versions (user_id, id) on delete set null (current_version_id)`.
- `alter table public.job_applications add column sent_cv_version_id uuid, add foreign key (user_id, sent_cv_version_id) references public.cv_versions (user_id, id) on delete set null (sent_cv_version_id)`.
- Composite foreign keys always use the `set null (<column>)` form, like `20261022000000_contacts_and_agencies.sql`; without it Postgres would also null `user_id`.
- indexes: `cv_versions (cv_id)`, `cvs (current_version_id)`, `job_applications (sent_cv_version_id)`.
- the `cvs_set_updated_at` trigger (`public.set_updated_at()`).
- `public.enforce_cv_library_limit()`, a `before insert` trigger on `public.cvs`:
  - it first takes `perform pg_advisory_xact_lock(hashtextextended('cvs:' || new.user_id::text, 0))`;
  - then it raises `raise exception 'cv_library_full' using errcode = 'check_violation'` when `(select count(*) from public.cvs where user_id = new.user_id and id <> new.id) >= 10`.
- `public.delete_unreferenced_cv_versions(candidate_version_ids uuid[]) returns setof text`, `language sql`, `security invoker`. It runs `delete from public.cv_versions as version where version.id = any(candidate_version_ids) and not exists (… public.cvs where current_version_id = version.id) and not exists (… public.job_applications where sent_cv_version_id = version.id) returning version.storage_path`. RLS limits it to the caller's rows.
- RLS enabled on both tables, with the four policies `cvs_select_own` … `cv_versions_delete_own` written like the others (`user_id = (select auth.uid())`). Then `revoke all … from anon`, and `grant select, insert, update, delete … to authenticated, service_role`.
- the views, `with (security_invoker = true)`:
  - `cvs_overview`: `cv.*` left join `cv_versions` on `cv.current_version_id`. `sent_count` = `count(*)` of `job_applications` joined to `cv_versions` where `version.cv_id = cv.id`.
  - `cv_versions_overview`: `version.*` plus `sent_count` = `count(*)` of `job_applications` where `sent_cv_version_id = version.id`.
  - `job_applications_overview`: `drop view` then `create view`. `create or replace` fails here, because `job_application.*` now expands to a new column in the middle of the list. Copy the body of `20261017180000_expose_intermediary_kind_in_overview.sql`, then add `sent_cv_version.label as sent_cv_label, sent_cv_version.uploaded_at as sent_cv_uploaded_at` through a left join on `cv_versions`. Re-apply `revoke all … from anon` and `grant select … to authenticated, service_role`.
- the views: `revoke all … from anon`, `grant select … to authenticated, service_role`. The function: `revoke execute … from public, anon`, `grant execute … to authenticated, service_role`.
- the bucket: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('cvs', 'cvs', false, 4194304, array['application/pdf'])`, and the four policies `cvs_objects_{select,insert,update,delete}_own`, copied from `job_specs_objects_*_own` with `bucket_id = 'cvs'`.
- every function: `set search_path = ''` and fully qualified names (`public.`).

- [ ] **Step 4: Apply, regenerate the types, and run the tests**

Run: `npx supabase db reset && npm run db:types && npm run test:integration -- cv-library-schema && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261022120000_cv_library.sql src/server/supabase/database-types.ts tests/integration/cv-library-schema.test.ts
git commit -m "feat(cv): add cv library schema, retention function and private bucket"
```

---

### Task 2: Domaine partagé — validation, rappel et formatage des CV

**Files:**
- Create: `src/domain/cv-library.ts`, `src/domain/cv-library.test.ts`
- Modify: `src/domain/routes.ts`, `src/domain/routes.test.ts`

**Interfaces:**
- Produces, in `src/domain/cv-library.ts`:
  - `CVS_BUCKET = 'cvs'`, `CV_PDF_MIME_TYPE = 'application/pdf'`, `MAX_CV_PDF_MEGABYTES = 4`, `MAX_CV_PDF_BYTES = MAX_CV_PDF_MEGABYTES * 1024 * 1024`, `MAXIMUM_CV_COUNT = 10`, `MAXIMUM_CV_LABEL_LENGTH = 100`, `MAXIMUM_CV_FILE_NAME_LENGTH = 255`, `DEFAULT_CV_FILE_NAME = 'cv.pdf'`, `CV_REVIEW_INTERVAL_DAYS = 90`, `DAYS_PER_REVIEW_MONTH = 30`
  - `CV_FORM_FIELD_NAMES = { pdf: 'cvPdf', label: 'cvLabel', addToLibrary: 'addToLibrary' } as const`
  - `CV_MESSAGES` (`as const`):
    - `missingPdf: 'Dépose un fichier PDF.'`
    - ``pdfTooLarge: `PDF trop lourd (${MAX_CV_PDF_MEGABYTES} Mo maximum)` ``
    - `invalidPdf: "Ce fichier n'est pas un PDF valide."`
    - `libraryFull: 'Tu as déjà 10 CV. Supprimes-en un pour en ajouter un nouveau.'`
    - `libraryFullAfterTailoredUpload: 'Le CV est rattaché à la candidature, mais ta bibliothèque est pleine (10 CV).'`
    - `missingLabel: 'Donne un nom à ce CV.'`
    - `missingLibraryChoice: 'Choisis un CV dans ta bibliothèque.'`
    - `cvNotFound: 'CV introuvable'`, `cvVersionNotFound: 'Version de CV introuvable'`
    - `openFailed: "Impossible d'ouvrir le CV pour le moment."`
  - `type CvCurrentVersion = { id: string; uploadedAt: Date; fileName: string }`
  - `type CvPreviousSentVersion = { id: string; uploadedAt: Date; sentCount: number }`
  - `type CvLibraryItem = { id: string; label: string; reviewedAt: Date; currentVersion: CvCurrentVersion | null; sentCount: number; previousSentVersions: CvPreviousSentVersion[] }`
  - `type CvOption = Pick<CvLibraryItem, 'id' | 'label'>`
  - `type SentCv = { versionId: string; label: string; uploadedAt: Date }`
  - `type CvReviewDates = { reviewedAt: Date; currentVersionUploadedAt: Date | null }`
  - `type TailoredCvUploadOutcome = { libraryErrorMessage: string | null }`
  - `validateCvLabel(candidate: unknown): ActionResult<string>`. It uses `validateRequiredText` with `{ label: 'Nom du CV', maximumLength: MAXIMUM_CV_LABEL_LENGTH }` and `CV_MESSAGES.missingLabel`.
  - `validateCvPdfFile(candidate: unknown): ActionResult<Blob>`, modelled on `validateJobSpecPdfFile`. Not a `Blob`, empty, or a type other than `CV_PDF_MIME_TYPE` → `missingPdf`. Over `MAX_CV_PDF_BYTES` → `pdfTooLarge`.
  - `readCvFileName(pdfFile: Blob): string`. It returns the trimmed `File.name`, cut to 255 characters, or `DEFAULT_CV_FILE_NAME`.
  - `buildCvStoragePath(userId: string, versionId: string): string` → `{userId}/{versionId}.pdf`
  - `buildCvVersionPdfPath(versionId: string): string` → `/api/cvs/versions/{versionId}/pdf`
  - `buildDefaultTailoredCvLabel(jobApplicationTitle: string): string` → `CV sur mesure · {title}`, cut to 100 characters.
  - `isCvLibraryFull(cvCount: number): boolean`
  - `findCvLastChangeDate(reviewDates: CvReviewDates): Date`, the latest of `reviewedAt` and `currentVersionUploadedAt`.
  - `isCvDueForReview(reviewDates: CvReviewDates, now: Date): boolean`. It is true when `currentVersionUploadedAt` is not null and both dates are at least `CV_REVIEW_INTERVAL_DAYS` Paris calendar days old (`countParisCalendarDaysBetween`, like the other reminders). Both the « À revoir » badge and the reminder use it.
  - `formatCvOutdatedMessage(cvLabel: string, lastChangeDate: Date, now: Date): string` → `Ton {label} n'a pas bougé depuis {n} mois. Un coup de neuf ?`, with `n = Math.floor(days / DAYS_PER_REVIEW_MONTH)`.
  - `formatCvCount(cvCount: number): string` → `{n} / 10`
  - `formatCvSentCount(sentCount: number): string` → `Pas encore envoyé` for 0, otherwise `Envoyé dans {n} candidature(s)`, with the plural from `pluralizeFrench`.
  - `formatSentCvVersionLabel(sentCv: SentCv): string` → `{label} · version du {dd/MM/yyyy}` (web block)
  - `formatSentCvShortLabel(sentCv: SentCv): string` → `{label} · {dd/MM/yyyy}` (mobile row)
  - `formatProposedMissionSentCv(sentCvLabel: string, sentCvUploadedAt: Date): string` → `CV : {label} ({dd/MM/yyyy})`
  - `toCvOptions(cvs: CvLibraryItem[]): CvOption[]`. It keeps the order and drops CVs without a current version.
  - Dates use `formatParisDate`. `pluralizeFrench` comes from `french-plural.ts`, which is already copied on mobile.
- Produces, in `routes.ts`: `CV_LIBRARY_ROUTE = '/cv'`.

- [ ] **Step 1: Write the failing tests**
  - `cv-library.test.ts`:
    - `it.each([[null], [new Blob([])], [new Blob(['x'], { type: 'text/plain' })]])('asks for a pdf file for %p')` → `Dépose un fichier PDF.`;
    - `it('refuses a pdf over 4 MB')` → `PDF trop lourd (4 Mo maximum)`, and accepts exactly 4 MB;
    - `it('requires a label of at most 100 characters')`, `it('trims the label')`;
    - `it('defaults the tailored label to the job application title, cut to 100 characters')`;
    - `it('is due for review when upload and confirmation are both 90 days old')`: now `2026-10-22T08:00:00Z`, both dates `2026-07-24T08:00:00Z` → true;
    - `it('is not due for review at 89 days')` (`2026-07-25`);
    - `it('is not due for review when the cv was confirmed recently')`;
    - `it('is never due for review without a current version')`;
    - `it('writes the outdated message with whole months')` → `Ton CV DevOps n'a pas bougé depuis 3 mois. Un coup de neuf ?`;
    - `it.each([[0, 'Pas encore envoyé'], [1, 'Envoyé dans 1 candidature'], [3, 'Envoyé dans 3 candidatures']])('formats the sent count %p')`;
    - `it('formats the sent cv for the block, the mobile row and the proposed missions')`;
    - `it('builds the storage path and the pdf route of a version')`;
    - `it('lists only cvs with a current version as options')`;
    - `it('reads the file name or falls back to cv.pdf')`.
  - `routes.test.ts`: `CV_LIBRARY_ROUTE === '/cv'`.
- [ ] **Step 2: Run and confirm failure** — `npm test -- cv-library routes` → FAIL
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** — `npm test -- cv-library routes && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git add src/domain/cv-library.ts src/domain/cv-library.test.ts src/domain/routes.ts src/domain/routes.test.ts` then `git commit -m "feat(cv): add shared cv library domain rules"`

---

### Task 3: CV envoyé dans la lecture des candidatures et des missions proposées

**Files:**
- Modify: `src/domain/job-application.ts` (`JobApplicationOverview` gains `sentCv`)
- Modify: `src/domain/contacts.ts` (`ProposedMission` gains two fields)
- Modify: `src/server/repositories/job-applications-repository.ts`
- Modify: `src/components/proposed-missions-list/proposed-missions-list.tsx` and its test
- Modify: `tests/integration/job-applications.test.ts`, `tests/integration/contacts.test.ts`, plus every fixture that builds a `JobApplicationOverview` or a `ProposedMission` (`npm run typecheck` lists them)

**Interfaces:**
- Consumes: `SentCv`, `formatProposedMissionSentCv` (task 2); the task 1 view columns.
- Produces:
  - `JobApplicationOverview` gains `sentCv: SentCv | null`. `JobApplicationListItem` becomes `Omit<JobApplicationOverview, 'postingRawText' | 'sentCv'>`, so the lists and their fixtures do not change.
  - `ProposedMission` gains `sentCvLabel: string | null` and `sentCvUploadedAt: Date | null` (spec §4.6).
  - in the repository, `toJobApplicationOverview` adds `sentCv`. It is `null` when `sent_cv_version_id` is null; otherwise it is `{ versionId, label: requireOverviewValue(sent_cv_label), uploadedAt: new Date(requireOverviewValue(sent_cv_uploaded_at)) }`. `PROPOSED_MISSION_COLUMNS` and `toProposedMission` add `sent_cv_label, sent_cv_uploaded_at`.

- [ ] **Step 1: Write the failing tests**
  - `tests/integration/job-applications.test.ts`:
    - `it('reads the sent cv of a job application with the label of its version')`. Insert the version and set `sent_cv_version_id` with the raw client; `findJobApplicationOverview` returns `sentCv`.
    - `it('reads a job application without sent cv as null')`.
  - `tests/integration/contacts.test.ts`: `it('lists proposed missions with the cv sent')`.
  - `proposed-missions-list.test.tsx`:
    - `it('shows the cv sent for a mission')` → `CV : CV DevOps (12/03/2026)`;
    - `it('shows no cv line when none was sent')`.
- [ ] **Step 2: Run** — `npm test -- proposed-missions-list && npm run test:integration -- job-applications contacts` → FAIL
- [ ] **Step 3: Implement**. In the list, the CV line goes under the date, in `text-xs text-muted-foreground`, only when both fields are present.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run test:integration -- job-applications contacts` → PASS
- [ ] **Step 5: Commit** — the files above, then `git commit -m "feat(cv): read the sent cv of job applications and proposed missions"`

---

### Task 4: Repository des CV et règles de conservation

**Files:**
- Create: `src/server/repositories/cvs-repository.ts`
- Create: `tests/integration/cv-library.test.ts`
- Modify: `src/server/actions/job-application-actions.ts` (`deleteJobApplicationWithFiles`), `tests/integration/delete-job-application.test.ts`

**Interfaces:**
- Consumes: task 1 (tables, views, function, bucket) and task 2 (types, `CV_MESSAGES`, `buildCvStoragePath`, `CVS_BUCKET`, `CV_PDF_MIME_TYPE`).
- Produces (`import 'server-only'`; each takes `supabase: FreeclutchSupabaseClient, userId: string` first unless stated otherwise):
  - `listCvLibraryItems(): Promise<CvLibraryItem[]>`. It reads `cvs_overview`, ordered `current_version_uploaded_at desc nulls last, created_at desc`. A second query on `cv_versions_overview` (`.in('cv_id', ids)`, `sent_count > 0`, `uploaded_at desc`) fills `previousSentVersions`, without the current version.
  - `countCvs(): Promise<number>` (`count: 'exact', head: true`)
  - `findCvRow(cvId: string): Promise<ActionResult<{ label: string; currentVersionId: string | null }>>` → `CV_MESSAGES.cvNotFound` when missing
  - `storeCvVersion(version: { cvId: string | null; label: string; pdfBytes: Uint8Array; fileName: string }): Promise<string>`. It generates `randomUUID()`, uploads to `buildCvStoragePath` (`upsert: false`), inserts the row with `byte_size = pdfBytes.byteLength`, and returns the version id. If the insert fails, it removes the file, then throws.
  - `createCvFromVersion(label: string, versionId: string): Promise<ActionResult<{ id: string }>>`. It inserts the CV with `current_version_id = versionId`, maps `23514` to `CV_MESSAGES.libraryFull`, then sets `cv_id` on the version.
  - `replaceCvCurrentVersion(cvId: string, versionId: string): Promise<ActionResult<{ previousVersionId: string | null }>>`. It sets `current_version_id` and `reviewed_at = new Date().toISOString()`. A missing CV → `cvNotFound`.
  - `renameCvRow(cvId: string, label: string): Promise<ActionResult<null>>`. It updates `cvs.label`, then the `label` of this CV's versions whose `sent_count` is 0 in `cv_versions_overview`. Sent versions keep their label.
  - `deleteCvRow(cvId: string): Promise<ActionResult<{ versionIds: string[] }>>`. It reads the CV's version ids, then deletes the CV.
  - `markCvReviewed(cvId: string): Promise<ActionResult<null>>`
  - `findSentCvVersionId(jobApplicationId: string): Promise<string | null>`
  - `setSentCvVersion(jobApplicationId: string, versionId: string | null): Promise<ActionResult<{ previousVersionId: string | null }>>`. It reads the previous value, then updates. A missing job application → `JOB_APPLICATION_NOT_FOUND_MESSAGE`; FK `23503` → `CV_MESSAGES.cvVersionNotFound`.
  - `releaseCvVersions(supabase: FreeclutchSupabaseClient, candidateVersionIds: (string | null)[]): Promise<void>`. It drops nulls and duplicates, returns early on an empty list, calls `rpc('delete_unreferenced_cv_versions')`, then removes the returned paths from the bucket. A storage failure is logged with `console.error('Cv file removal failed', { httpStatus })` and does not throw, like `removeJobSpecFile`.
  - `createCvVersionDownloadUrl(versionId: string): Promise<ActionResult<string>>`. It signs `storage_path` for 300 seconds. An unknown version → `CV_MESSAGES.cvVersionNotFound`.
  - `deleteJobApplicationWithFiles` reads `findSentCvVersionId` before deleting the row, then calls `releaseCvVersions(supabase, [sentVersionId])` after the deletion (spec §9.7).

- [ ] **Step 1: Write the failing integration tests** in `tests/integration/cv-library.test.ts`. Each test that deletes a version also checks that its file is gone (`storage.download` fails).
  - `it('lists cvs from the most recently updated with their sent count and previous sent versions')`;
  - `it('deletes the previous current version and its file when replacing an unsent cv')`;
  - `it('keeps the previous version sent to a job application when replacing the cv')`: the old version appears in `previousSentVersions`; the job application still points at it; its download URL serves the old bytes byte for byte; `reviewedAt` is reset;
  - `it('deletes unsent versions and keeps sent ones without cv when deleting a cv')`;
  - `it('deletes the previously sent tailored version when another cv is sent')`;
  - `it('keeps the previously sent version when it is still the current version of a cv')`;
  - `it('deletes the tailored version when the sent cv is removed')`;
  - `it('keeps the label of the time on a job application after renaming or deleting the cv')` (Review Focus 5);
  - `it('renames the unsent current version but keeps the label of sent versions')`;
  - `it('maps the database limit to the full library message')`;
  - `it('resets reviewed_at when the cv is marked as reviewed')`;
  - `it('returns not found for a cv, a version or a job application of another user')`.
  - In `delete-job-application.test.ts`:
    - `it('deletes the tailored cv sent by a deleted job application with its file')`;
    - `it('keeps the library cv version sent by a deleted job application')`.
- [ ] **Step 2: Run** — `npm run test:integration -- cv-library delete-job-application` → FAIL
- [ ] **Step 3: Implement** the signatures above. Rows are mapped with `toCvLibraryItem(row)` and `toCvPreviousSentVersion(row)`, using `requireOverviewValue`-style guards for the view's nullable columns.
- [ ] **Step 4: Run** — `npm run test:integration -- cv-library delete-job-application && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): add cv repository and file retention rules"` (the listed files only)

---

### Task 5: Server actions

**Files:**
- Create: `src/server/actions/cv-actions.ts`, `src/server/actions/cv-actions.test.ts`
- Modify: `src/server/actions/job-application-actions.ts`, `src/server/actions/job-application-actions.test.ts`
- Modify: `src/components/new-job-application-form/interfaces.ts`, `controller.tsx` and their tests: `CreateJobApplication` takes the new signature now, and the controller passes `null` until task 9; otherwise the page no longer typechecks.

**Interfaces:**
- Consumes: task 4; `hasPdfSignature` (`job-spec.ts`); `isJobApplicationOwnedByUser`; `validateJobApplicationId`.
- Produces (`'use server'`, `runAuthenticatedOperation`, `cvId` validated with `validateUuid(…, CV_MESSAGES.cvNotFound)`):
  - `listCvs(): Promise<ActionResult<CvLibraryItem[]>>`
  - `createCv(formData: FormData): Promise<ActionResult<{ id: string }>>`. Order:
    1. validate `CV_FORM_FIELD_NAMES.label` and `CV_FORM_FIELD_NAMES.pdf`;
    2. no signature → `CV_MESSAGES.invalidPdf`;
    3. `countCvs() >= MAXIMUM_CV_COUNT` → `libraryFull`, before any upload;
    4. `storeCvVersion({ cvId: null, … })`, then `createCvFromVersion`;
    5. if step 4 is refused, `releaseCvVersions([versionId])` and return the refusal.
  - `replaceCvFile(cvId: string, formData: FormData): Promise<ActionResult<null>>`. It runs `findCvRow`, then `storeCvVersion({ cvId, label: row.label, … })`, then `replaceCvCurrentVersion`, then `releaseCvVersions([previousVersionId])`. If the replacement is refused (the CV vanished), it releases the new version instead.
  - `renameCv(cvId: string, label: string): Promise<ActionResult<null>>`
  - `deleteCv(cvId: string): Promise<ActionResult<null>>`: `deleteCvRow`, then `releaseCvVersions(versionIds)`.
  - `confirmCvStillGood(cvId: string): Promise<ActionResult<null>>`: `markCvReviewed`.
  - `attachLibraryCvToJobApplication(jobApplicationId: string, cvId: string): Promise<ActionResult<null>>`. A CV without a current version → `cvNotFound`. Then `setSentCvVersion`, then `releaseCvVersions([previousVersionId])`.
  - `uploadTailoredCvForJobApplication(jobApplicationId: string, formData: FormData): Promise<ActionResult<TailoredCvUploadOutcome>>`. `addToLibrary` is true when the field equals `'true'`. The order follows spec §9.2:
    1. validate, check the signature, then `isJobApplicationOwnedByUser`;
    2. `storeCvVersion({ cvId: null })`;
    3. `setSentCvVersion`; if it is refused, release the new version and return;
    4. release the previous version;
    5. if `addToLibrary`: a full library (`countCvs`, or `createCvFromVersion` refused with `libraryFull`) → `{ ok: true, data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload } }`;
    6. otherwise → `libraryErrorMessage: null`.
  - `detachSentCvFromJobApplication(jobApplicationId: string): Promise<ActionResult<null>>`
  - `createJobApplication(input: JobApplicationInput, sentCvId: string | null)`. `sentCvId` must be null or a UUID; otherwise `cvNotFound` is returned before anything is created. After `insertJobApplication`, a non-null `sentCvId` attaches the current version of that CV. This step is wrapped in `try/catch`: a missing CV is ignored, an exception is logged with `console.error('Sent cv attachment failed at creation', …)`, and the action still returns `{ ok: true, data: { id } }` (Review Focus 4).
  - Failure messages:
    - `CV_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes CV pour le moment. Réessaie dans quelques minutes.'`
    - `CV_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer le CV pour le moment. Réessaie dans quelques minutes."`
    - `CV_DELETE_FAILURE_MESSAGE = 'Impossible de supprimer le CV pour le moment. Réessaie dans quelques minutes.'`

- [ ] **Step 1: Write the failing tests**, mocking the repositories as `job-spec-actions.test.ts` does:
  - `it('refuses a file without the pdf signature and stores nothing')` (Review Focus 3);
  - `it('refuses a new cv when the library already has 10 cvs without uploading')`;
  - `it('releases the stored version when the database refuses the cv')`;
  - `it('releases the previous version after a replacement')`;
  - `it('releases the new version when the replaced cv vanished')`;
  - `it('attaches the tailored cv before creating the library cv')` (call order);
  - `it('keeps the tailored cv attached and reports the full library')`;
  - `it('rejects a malformed cv id without touching the database')`;
  - in `job-application-actions.test.ts`:
    - `it('attaches the current version of the chosen cv at creation')`;
    - `it('creates the job application without cv when the chosen cv no longer exists')` (Review Focus 4);
    - `it('still returns the created id when attaching the cv throws')`;
    - `it('rejects a malformed sent cv id without creating the job application')`.
- [ ] **Step 2: Run** — `npm test -- cv-actions job-application-actions` → FAIL
- [ ] **Step 3: Implement** the signatures above. Update the existing `createJobApplication` callers in tests to pass `null`.
- [ ] **Step 4: Run** — `npm test -- cv-actions job-application-actions && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): expose cv library and sent cv server actions"`

---

### Task 6: Route d'ouverture des PDF

**Files:**
- Create: `src/app/api/cvs/versions/[versionId]/pdf/route.ts`
- Create: `tests/integration/cv-pdf-route.test.ts`

**Interfaces:**
- Consumes: `createCvVersionDownloadUrl` (task 4).
- Produces: `GET(_request: NextRequest, routeContext: RouteContext<'/api/cvs/versions/[versionId]/pdf'>): Promise<NextResponse>`. It is a copy of `src/app/api/job-specs/[jobApplicationId]/pdf/route.ts`, with the same statuses and `Cache-Control: private, no-store`, and logs `console.error('Cv pdf redirect failed', …)`.

- [ ] **Step 1: Write the failing tests**, modelled on `job-spec-pdf-route.test.ts`:
  - `it('answers 401 without redirecting when nobody is signed in')`;
  - `it('redirects the owner to a signed url that serves the stored pdf, without caching it')`;
  - `it('answers 404 for a version of another user')`;
  - `it('answers 404 for a malformed version id')`.
- [ ] **Step 2: Run** — `npm run test:integration -- cv-pdf-route` → FAIL
- [ ] **Step 3: Implement** the route.
- [ ] **Step 4: Run** — `npm run test:integration -- cv-pdf-route && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): open cv versions through short-lived signed urls"`

---

### Task 7: Navigation et page « Mes CV »

**Files:**
- Modify: `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/app-shell.test.tsx`
- Modify: `src/domain/landing-routing.ts`, `src/domain/landing-routing.test.ts`
- Create: `src/app/(app)/cv/page.tsx`
- Create: `src/components/pdf-drop-zone/` (no controller), `src/components/add-cv-form/` (with controller), `src/components/cv-card/` (with controller), `src/components/cv-library/` (with controller)

**Interfaces:**
- Consumes: `listCvs`, `createCv`, `replaceCvFile`, `renameCv`, `deleteCv` (task 5); task 2 helpers; `CV_LIBRARY_ROUTE`.
- Produces:
  - `PdfDropZoneProps = { inputId: string; label: string; selectedFileName: string | null; isDisabled: boolean; onSelectFile: (pdfFile: File | null) => void }`. This is a drag-and-drop or picker area with `accept="application/pdf"`, visually like the one in `job-spec-section`. Task 8 reuses it.
  - in `cv-library/interfaces.ts`:
    - `CreateCv = (formData: FormData) => Promise<ActionResult<{ id: string }>>`
    - `ReplaceCvFile = (cvId: string, formData: FormData) => Promise<ActionResult<null>>`
    - `RenameCv = (cvId: string, label: string) => Promise<ActionResult<null>>`
    - `DeleteCv = (cvId: string) => Promise<ActionResult<null>>`
  - `CvLibraryProps = { cvs: CvLibraryItem[]; now: Date; createCv: CreateCv; replaceCvFile: ReplaceCvFile; renameCv: RenameCv; deleteCv: DeleteCv }`. Its `useController({ cvs })` returns `{ isAddFormOpen, openAddForm, closeAddForm, isLibraryFull, cvCountLabel }`.
  - `AddCvFormProps = { createCv: CreateCv; onCreated: () => void; onCancel: () => void }`. Its `useController` returns `{ label, setLabel, pdfFile, selectPdfFile, errorMessage, isSubmitting, submit }`. `selectPdfFile` validates with `validateCvPdfFile` right away. `submit` checks `validateCvLabel`, builds the `FormData` (`CV_FORM_FIELD_NAMES`), then calls `onCreated` on success.
  - `CvCardProps = { cv: CvLibraryItem; now: Date; replaceCvFile: ReplaceCvFile; renameCv: RenameCv; deleteCv: DeleteCv }`. Its `useController({ cv, replaceCvFile, renameCv, deleteCv, onDataChanged })` returns `{ isRenaming, startRenaming, cancelRenaming, draftLabel, setDraftLabel, saveLabel, replaceWithFile, isDeleteDialogOpen, setIsDeleteDialogOpen, confirmDeletion, isPending, errorMessage }`.
  - After every save, the components call `router.refresh()`, like the contact page does.

- [ ] **Step 1: Write the failing tests**
  - `app-shell.test.tsx`: `it('links to Mes CV between Mes contacts and Mon calendrier')`.
  - `landing-routing.test.ts`: `/cv` is an app path on the landing domain.
  - `add-cv-form/controller.test.tsx`:
    - `it('requires a label')`;
    - `it('refuses a non pdf file as soon as it is chosen')` → `Dépose un fichier PDF.`;
    - `it('sends the label and the file in the form data')`;
    - `it('shows the server refusal')` (`libraryFull`).
  - `cv-library.test.tsx`:
    - `it('shows the counter and the add button')` → `3 / 10`;
    - `it('disables the add button at 10 cvs and explains why')`;
    - `it('explains what the page is for when the library is empty')`. Exact text: « Ajoute tes CV ici pour retrouver lequel tu as envoyé à chaque candidature. »
  - `cv-card.test.tsx`:
    - `it('shows the label, the update date and the sent count')` → `Mis à jour le 12/03/2026`, `Envoyé dans 2 candidatures`;
    - `it('shows the À revoir badge only after 90 days')`;
    - `it('opens the current pdf in a new tab')`: `href` = `buildCvVersionPdfPath`, `target="_blank"`, `rel="noopener noreferrer"`;
    - `it('lists previous sent versions in the Anciennes versions envoyées disclosure')`;
    - `it('asks for confirmation before deleting')`. Exact text: « Les candidatures auxquelles tu as envoyé ce CV le garderont. »
  - `cv-card/controller.test.tsx`:
    - `it('replaces the file and refreshes the data')`;
    - `it('saves a trimmed label and refuses an empty one')`;
    - `it('deletes the cv after confirmation and refreshes the data')`;
    - `it('shows the error and keeps the card when an action fails')`.
- [ ] **Step 2: Run** — `npm test -- app-shell landing-routing add-cv-form cv-library cv-card` → FAIL
- [ ] **Step 3: Implement**
  - Navigation: label `Mes CV`, `href: CV_LIBRARY_ROUTE`, between « Mes contacts » and « Mon calendrier ». `APP_PATH_PREFIXES` gains `CV_LIBRARY_ROUTE`.
  - Page `/cv`:
    - `metadata.title = 'Mes CV · Aled'`;
    - it calls `listCvs()` and passes `now = new Date()`;
    - on failure, it shows the error message (`role="alert"`) under the `Mes CV` title.
  - Header: title `Mes CV`, the `formatCvCount` counter, and the `Ajouter un CV` button. At 10 CVs the button is disabled and `CV_MESSAGES.libraryFull` appears beside it.
  - Card layout as in spec §4.2:
    - « Remplacer » opens a hidden `<input type="file" accept="application/pdf">` and validates with `validateCvPdfFile`;
    - « Renommer » switches the label to an inline text field;
    - « Supprimer » opens an `AlertDialog`, like `delete-contact-button`, titled `Supprimer {label} ?`;
    - the disclosure is a `<details>` titled `Anciennes versions envoyées`, shown only when the list is not empty.
  - The « À revoir » badge is a `Pill` with tone `peach-soft`.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): add Mes CV page to upload, replace, rename and delete cvs"`

---

### Task 8: Bloc « CV envoyé » sur la fiche candidature

**Files:**
- Create: `src/components/sent-cv-view/`, `src/components/sent-cv-edit-form/` (with controller)
- Modify: `src/components/job-application-block/interfaces.ts`, `job-application-block.tsx`, `job-application-block.test.tsx`
- Modify: `src/app/(app)/candidatures/[jobApplicationId]/page.tsx`

**Interfaces:**
- Consumes: `attachLibraryCvToJobApplication`, `uploadTailoredCvForJobApplication`, `detachSentCvFromJobApplication`, `listCvs` (task 5); `PdfDropZone` (task 7); `JobApplicationOverview.sentCv` (task 3); `toCvOptions`, `buildDefaultTailoredCvLabel`, `formatSentCvVersionLabel`, `buildCvVersionPdfPath` (task 2).
- Produces:
  - `SentCvViewProps = { sentCv: SentCv | null }`
  - in `sent-cv-edit-form/interfaces.ts`:
    - `AttachLibraryCvToJobApplication = (jobApplicationId: string, cvId: string) => Promise<ActionResult<null>>`
    - `UploadTailoredCvForJobApplication = (jobApplicationId: string, formData: FormData) => Promise<ActionResult<TailoredCvUploadOutcome>>`
    - `DetachSentCvFromJobApplication = (jobApplicationId: string) => Promise<ActionResult<null>>`
    - `SentCvSource = 'library' | 'tailored'`
    - `SentCvEditFormProps = { jobApplicationId: string; jobApplicationTitle: string; sentCv: SentCv | null; cvOptions: CvOption[]; attachLibraryCvToJobApplication; uploadTailoredCvForJobApplication; detachSentCvFromJobApplication; onDataChanged: () => void; onClose: () => void }`
  - The controller returns `{ source, setSource, selectedCvId, setSelectedCvId, tailoredLabel, setTailoredLabel, tailoredPdfFile, selectTailoredPdfFile, isAddedToLibrary, setIsAddedToLibrary, libraryNoticeMessage, errorMessage, isSaving, save, detach }`. `source` starts at `'library'` when `cvOptions` is not empty, otherwise at `'tailored'`. `tailoredLabel` starts at `buildDefaultTailoredCvLabel(jobApplicationTitle)`.
  - `JobApplicationBlockForm` gains `{ kind: 'sentCv'; props: Omit<SentCvEditFormProps, 'onClose' | 'onDataChanged'> }`.

- [ ] **Step 1: Write the failing tests**
  - `sent-cv-view.test.tsx`:
    - `it('shows the label, the version date and a Voir link in a new tab')` → `CV DevOps · version du 12/03/2026`;
    - `it('says Aucun CV indiqué without sent cv')`.
  - `sent-cv-edit-form/controller.test.tsx`:
    - `it('attaches the chosen library cv and closes after refresh')`;
    - `it('asks to choose a library cv before saving')` → `missingLibraryChoice`;
    - `it('starts on the tailored upload when the library is empty')`;
    - `it('prefills the tailored label with the job application title')`;
    - `it('sends the label, the file and the library checkbox')` (`addToLibrary` = `'true'`);
    - `it('stays open with the full library notice after a tailored upload')`. The notice reads `libraryFullAfterTailoredUpload`, `onDataChanged` is called, and `onClose` is not;
    - `it('removes the sent cv')`;
    - `it('shows the server error and keeps the form open')`.
  - `job-application-block.test.tsx`: `it('renders the sent cv form when editing that block')`.
- [ ] **Step 2: Run** — `npm test -- sent-cv job-application-block` → FAIL
- [ ] **Step 3: Implement**
  - Form layout:
    - a « Choisir dans ma bibliothèque » / « Déposer un CV sur mesure » choice (`pill-tabs` or radios);
    - the library `<select>`;
    - for a tailored CV: `PdfDropZone`, the name field, and the « L'ajouter aussi à ma bibliothèque » checkbox;
    - `Enregistrer` / `Annuler`;
    - a `Retirer le CV envoyé` text button, shown only when `sentCv !== null`.
  - The library notice uses `role="status"` and has an `OK` button that calls `onClose`.
  - Page: add `listCvs()` to the `Promise.all`. A failure does not block the page (`cvOptions = []`). Add a third card « CV envoyé » after « Contact » in the Aperçu tab grid.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): pick or upload the cv sent for a job application"`

---

### Task 9: Champ « CV envoyé » dans le formulaire de création

**Files:**
- Modify: `src/components/new-job-application-form/` (interfaces, controller, component, tests)
- Modify: `src/app/(app)/candidatures/new/page.tsx`

**Interfaces:**
- Consumes: `createJobApplication(input, sentCvId)` (task 5), `listCvs`, `toCvOptions`.
- Produces:
  - `CreateJobApplication` already has its task 5 signature, `(input: JobApplicationInput, sentCvId: string | null) => Promise<ActionResult<{ id: string }>>`; the controller now passes the chosen value instead of `null`.
  - `NewJobApplicationFormProps` gains `cvOptions: CvOption[]`.
  - `JobApplicationFormValues` gains `sentCvId: string`, where `''` means « Aucun ». It is excluded from `TextFormValueName` and set by `setSentCvId(sentCvId: string)`, which the controller returns.

- [ ] **Step 1: Write the failing tests**
  - `controller.test.tsx`:
    - `it('sends the chosen cv id with the job application')`;
    - `it('sends null when Aucun is kept')`.
  - `new-job-application-form.test.tsx`:
    - `it('offers Aucun then the library cvs in the CV envoyé field')`;
    - `it('hides the CV envoyé field when the library is empty')`.
- [ ] **Step 2: Run** — `npm test -- new-job-application-form` → FAIL
- [ ] **Step 3: Implement**
  - A `<select>` labelled « CV envoyé » goes right after the status field.
  - The page loads `listCvs()` in parallel with `hasAnthropicApiKeyConfigured()`. On failure it passes `cvOptions = []`.
  - Tailored CVs are not offered here (spec §4.4).
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): choose the sent cv when creating a job application"`

---

### Task 10: Rappel « Ton CV vieillit » dans « À faire »

**Files:**
- Modify: `src/domain/todo-alerts.ts`, `src/domain/todo-alerts.test.ts`
- Modify: `src/domain/job-applications-filters.ts`, `src/components/job-applications-table/controller.tsx`
- Modify: `src/server/todo-reminders/load-todo-reminders.ts`, `load-todo-reminders.test.ts`
- Modify: `src/components/todo-banner/` (`format-todo-alert.ts`, `interfaces.ts`, `controller.tsx`, `todo-banner.tsx`, tests)
- Modify: `src/components/todo-summary-bar/` (component, interfaces, test)
- Modify: `src/components/home-dashboard/` (interfaces, component, test), `src/app/(app)/page.tsx`, `src/app/(app)/candidatures/page.tsx`

**Interfaces:**
- Consumes: `isCvDueForReview`, `findCvLastChangeDate`, `formatCvOutdatedMessage` (task 2); `listCvs`, `confirmCvStillGood` (task 5); `CV_LIBRARY_ROUTE`.
- Produces, in `todo-alerts.ts`. `AlertKind` and the Postgres enum do not change.
  - `type CvOutdatedAlertKind = 'cv_outdated'`, `type TodoAlertKind = AlertKind | CvOutdatedAlertKind`
  - `type JobApplicationTodoAlert = { kind: AlertKind; jobApplicationId: string; jobApplicationTitle: string; referenceDate: Date; interviewId?: string }` (the current shape)
  - `type CvOutdatedTodoAlert = { kind: CvOutdatedAlertKind; cvId: string; cvLabel: string; referenceDate: Date }`, where `referenceDate` = `findCvLastChangeDate`
  - `type TodoAlert = JobApplicationTodoAlert | CvOutdatedTodoAlert`
  - `isJobApplicationTodoAlert(alert: TodoAlert): alert is JobApplicationTodoAlert`
  - `type AlertCv = CvReviewDates & { id: string; label: string }`. `TodoAlertInput` gains `cvs: AlertCv[]`.
  - `computeTodoAlerts` adds one `cv_outdated` alert per CV that `isCvDueForReview` flags. It does so only when at least one candidature passes `isActiveStatus` (spec §9.3 and §9.4).
  - `ALERT_KIND_DISPLAY_ORDER` and `TODO_SUMMARY_KIND_ORDER` become `readonly TodoAlertKind[]` and end with `'cv_outdated'`. `TodoAlertKindCount.kind` becomes `TodoAlertKind`.
- Produces in the components:
  - `format-todo-alert.ts`:
    - `TODO_ALERT_KIND_TAG_LABELS` and `TODO_ALERT_KIND_TONES` become `Record<TodoAlertKind, …>`, with `cv_outdated: 'CV à revoir'` and `'peach-soft'`;
    - `formatTodoAlertKindCount('cv_outdated', n)` → `{n} CV à revoir`;
    - `getTodoAlertKey` → `cv:{cvId}:cv_outdated` for a CV alert;
    - `formatTodoAlertMessage` delegates the CV alert to `formatCvOutdatedMessage`.
  - `ConfirmCvStillGood = (cvId: string) => Promise<ActionResult<null>>`, in `todo-banner/interfaces.ts`. `TodoBannerControllerParameters` and `HomeDashboardProps` gain `confirmCvStillGood`. The controller gains `confirmStillGood(alert: CvOutdatedTodoAlert)`, with the same optimistic pattern as `snooze`.
  - `TodoSummaryBarProps.kindCounts` stays `TodoAlertKindCount[]`, and `onToggleAlertKind` stays `(kind: AlertKind) => void`. The `cv_outdated` count is shown as a pill-styled `Link` to `CV_LIBRARY_ROUTE`, because it does not filter candidatures. The total includes it.
  - `JobApplicationsTableFilters.alertKind` stays `AlertKind | null`. `hasAlertOfKind` narrows with `isJobApplicationTodoAlert`.
  - `loadTodoReminders` adds `listCvs()` to its `Promise.all`. It maps each CV to `AlertCv` (`currentVersionUploadedAt = currentVersion?.uploadedAt ?? null`). A failed CV load gives `cvs: []`, so the page is not blocked.

- [ ] **Step 1: Write the failing tests**
  - `todo-alerts.test.ts`:
    - `it('raises one cv reminder per cv unchanged for 90 days')`;
    - `it('raises no cv reminder at 89 days')`;
    - `it('raises no cv reminder when every job application is closed')`;
    - `it('raises no cv reminder when the cv was confirmed less than 90 days ago')`;
    - `it('shows cv reminders after every job application reminder')`;
    - `it('counts each outdated cv in the summary')`.
  - `format-todo-alert.test.ts`:
    - `it('writes the cv reminder message')` → `Ton CV DevOps n'a pas bougé depuis 3 mois. Un coup de neuf ?`;
    - `it('builds a cv reminder key per cv')`;
    - plus the new entries of the existing tag, tone and count tests.
  - `todo-banner/controller.test.tsx`:
    - `it('confirms a cv as still good and hides its reminder right away')`;
    - `it('brings the cv reminder back with the error when confirming fails')`.
  - `todo-banner.test.tsx`: `it('links the cv reminder and its Mettre à jour button to Mes CV, without snooze buttons')`.
  - `todo-summary-bar.test.tsx`: `it('links the cv count to Mes CV instead of filtering job applications')`.
  - `load-todo-reminders.test.ts`:
    - `it('feeds the alert computation with the cv review dates')`;
    - `it('still computes job application alerts when the cv library fails to load')`.
- [ ] **Step 2: Run** — `npm test -- todo-alerts format-todo-alert todo-banner todo-summary-bar load-todo-reminders` → FAIL
- [ ] **Step 3: Implement**
  - CV card in the banner:
    - background `bg-peach-tint`;
    - the message links to `CV_LIBRARY_ROUTE`;
    - a « Mettre à jour » button (`Link` with `buttonVariants({ variant: 'outline', size: 'sm' })`) leads to `/cv`;
    - « Il est encore bon » (`variant="secondary"`) calls `confirmStillGood`.
  - Pass `confirmCvStillGood` from both pages and through `HomeDashboard`.
  - Wherever code reads `alert.jobApplicationId`, narrow first with `isJobApplicationTodoAlert`; `npm run typecheck` lists the places.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(cv): remind to refresh a cv untouched for three months"`

---

### Task 11: Export, sauvegarde, restauration et vérification finale

**Files:**
- Modify: `src/server/data-snapshot/build-user-data-snapshot.ts`
- Modify: `scripts/restore-user-data-snapshot.ts`, `scripts/restore-user-data-snapshot.test.ts`
- Modify: `tests/integration/user-data-snapshot-fixtures.ts`, `tests/integration/data-snapshot.test.ts`
- Modify: `README.md` (the « Mes CV » page in the feature list, if such a list exists)

**Interfaces:**
- Consumes: `CVS_BUCKET`, `CV_PDF_MIME_TYPE`, `MAX_CV_PDF_BYTES` (task 2).
- Produces:
  - `UserDataSnapshotCvVersion = Tables<'cv_versions'> & { pdfBase64: string }`;
  - `UserDataSnapshot` gains `cvs: Tables<'cvs'>[]` and `cvVersions: UserDataSnapshotCvVersion[]`. `formatVersion` stays `1`.
  - in the restore script:
    - `SNAPSHOT_TABLE_NAMES` gains `cvs: 'cvs'` and `cvVersions: 'cv_versions'`;
    - `ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS` gains `'cvs'` and `'cvVersions'`;
    - `parseUserDataSnapshot` defaults both to `[]`;
    - `isStoragePathInUserFolder(storagePath: string, userId: string): boolean` is extracted from the job spec check and shared by both checks;
    - `assertEveryCvVersionFileStaysInUserFolder(snapshot)` checks the path and `pdfBase64` ≤ `MAX_CV_PDF_BYTES`.

- [ ] **Step 1: Write the failing tests**
  - `seedEveryUserTable` gains a CV with two versions: the old one sent to the seeded job application, and the current one.
  - `data-snapshot.test.ts`:
    - `it('exports cvs and their versions with the pdf in base64')`;
    - `it('restores a cv with a version sent to a job application after the user data was deleted')`: pointers restored and both files byte for byte;
    - `it('restores over the current data of a user who has 10 cvs')` (Review Focus 1);
    - `it('refuses a cv version stored outside the user folder or heavier than 4 MB, writing nothing')`.
  - `restore-user-data-snapshot.test.ts`: `it('still parses a snapshot written before the cv library')` → `cvs` and `cvVersions` equal `[]`.
- [ ] **Step 2: Run** — `npm test -- restore-user-data-snapshot && npm run test:integration -- data-snapshot` → FAIL
- [ ] **Step 3: Implement**
  - Snapshot: fetch `cvs` and `cv_versions` with `fetchEveryRow`, then download each version as base64 (`downloadCvPdfAsBase64`), like `attachJobSpecPdfs`.
  - Restoration, in the order of spec §9.6:
    1. upsert `cvs` with `current_version_id: null`, and `job_applications` with `sent_cv_version_id: null`;
    2. upsert `cv_versions` (without `pdfBase64`), then upload the files (`upsert: true`);
    3. upsert `cvs` again with their real `current_version_id`, then upsert again the job applications whose `sent_cv_version_id` is not null.
  - The new checks run with the existing ones, before any write.
- [ ] **Step 4: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npx supabase db reset && npm run test:integration`
Expected: everything PASS. Then check by hand with `npm run dev`:
  - add two CVs, then try an 11th;
  - send one to a candidature, then replace it: the candidature still opens the old PDF;
  - upload a tailored CV with « L'ajouter aussi à ma bibliothèque »;
  - open a contact page: the mission shows « CV : … »;
  - set a CV's `reviewed_at` and version date 91 days back in SQL: the reminder shows, and « Il est encore bon » hides it;
  - check dark mode and a 360 px width.

- [ ] **Step 5: Commit** — `git commit -m "feat(cv): include cvs and their files in exports and restores"`

