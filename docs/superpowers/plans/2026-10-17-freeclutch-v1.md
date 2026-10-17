# Freeclutch V1 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Construire la V1 de Freeclutch, un outil web multi-utilisateur (sur invitation) de suivi de candidatures freelance, avec bandeau « À faire », extraction IA des annonces et fiches métier, brief client, calendrier des entretiens et sauvegardes.

**Architecture :** Une app Next.js (App Router) unique. Le code serveur (server actions, route handlers) est le seul à parler à Supabase (Postgres, Auth, Storage) et à Claude. La logique métier pure (statuts, alertes, filtres) vit dans `src/domain/`, sans dépendance, et est testée unitairement. Chaque composant non trivial a un `useController` qui reçoit ses server actions en paramètre, ce qui le rend testable avec `renderHook`.

**Tech Stack :** Next.js + React + TypeScript strict, Tailwind + shadcn/ui, Supabase (`@supabase/supabase-js`, `@supabase/ssr`, CLI locale), `@anthropic-ai/sdk`, `zod`, `date-fns` + `date-fns-tz`, FullCalendar (`@fullcalendar/react`), `@google-cloud/storage` (sauvegardes sur Google Cloud Storage), Jest + React Testing Library.

**Spec :** [docs/superpowers/specs/2026-10-17-freeclutch-design.md](../specs/2026-10-17-freeclutch-design.md)

## Global Constraints

- Node 24 LTS (version installée localement), npm. Next.js : dernière version stable au moment du scaffold. `tsconfig` en `strict: true`.
- Avant d'écrire du code qui utilise Next.js, `@supabase/ssr` ou FullCalendar, vérifier l'API actuelle via context7 (conventions de fichiers comme `middleware.ts` / `proxy.ts`, signatures). Pour `@anthropic-ai/sdk`, suivre le skill `claude-api` (`typescript/claude-api/README.md`, `tool-use.md`) : ne jamais deviner une signature du SDK.
- Modèles Claude : `claude-haiku-5-5` pour les extractions, `claude-sonnet-5-5` + outil `web_search_20260209` (`max_uses: 5`) pour le brief. Constantes uniquement dans `src/server/ai/claude-models.ts`.
- Le navigateur ne parle jamais à Supabase ni à Claude. Tout module de `src/server/` commence par `import 'server-only'`. Variables d'environnement Supabase **sans** préfixe `NEXT_PUBLIC_`.
- RLS activée sur toutes les tables (`user_id = auth.uid()`). Chaque requête serveur filtre en plus explicitement par `user_id`.
- La clé API Claude n'est jamais renvoyée au client, jamais journalisée, jamais incluse dans un export ou une sauvegarde. Chiffrement AES-256-GCM avec `API_KEY_ENCRYPTION_SECRET` (32 octets, base64).
- Valeurs par défaut : relance à **7 jours** (réglable), suggestion « sans nouvelles » à **21 jours**, entretiens affichés **7 jours** à l'avance, report d'alerte de **3 ou 7 jours**.
- Toutes les dates affichées et les calculs en jours se font dans le fuseau `Europe/Paris`. Les dates sont stockées en `timestamptz`.
- Textes d'interface en français. Code (noms, fichiers) en anglais.
- Conçu pour l'ordinateur, mais chaque page reste utilisable à 375 px de large, sans défilement horizontal de la page (le tableau défile horizontalement dans son propre conteneur).
- Conventions du porteur du projet :
  - aucun `any` (règle ESLint `@typescript-eslint/no-explicit-any: error`) ;
  - fonctions fléchées uniquement ;
  - exports nommés uniquement, sauf les exports par défaut exigés par Next.js (`page`, `layout`, `route`) ;
  - un dossier kebab-case par composant (`component-name.tsx`, `interfaces.ts`, `index.ts`, et `controller.tsx` si plus de quatre fonctions internes) ;
  - un seul `useController` par composant ;
  - aucun `console.log` (règle ESLint `no-console` qui autorise `warn` et `error`) ;
  - pas de commentaires, pas de code mort.
- Git : le porteur du projet initialise le dépôt. Les étapes « Commit » ne s'exécutent que si un dépôt existe. Ne jamais `push`, ne jamais créer ni changer de branche, aucune mention d'IA dans les messages de commit.
- Hébergement sur les formules gratuites (Vercel Hobby, Supabase Free). Les sauvegardes vont dans un bucket Google Cloud Storage du projet GCP existant du porteur du projet (facturation active, coût de quelques centimes par mois).
- Taille maximale : texte collé 50 000 caractères ; PDF de fiche métier 10 Mo, type `application/pdf` uniquement.

## Review Focus

Les cinq situations que la spec implique sans les nommer, et qui risquent le plus de gêner un utilisateur. Le test qui couvre chacune est ajouté à la tâche concernée.

1. **Texte collé vide, trop court ou sans rapport** (un post LinkedIn de deux lignes, un mail sans mission) : l'extraction renvoie des champs vides, sans erreur, et le formulaire reste utilisable. Au-delà de 50 000 caractères, le texte est refusé avec un message clair. → Tâches 7 et 11.
2. **Clé API révoquée ou à court de crédit après son enregistrement** : message « Ta clé Claude est invalide ou sans crédit, remplace-la dans les réglages », et la saisie manuelle reste possible. → Tâche 7.
3. **Fuseau horaire** : un entretien saisi à 14h (heure de Paris) s'affiche à 14h même si le serveur tourne en UTC. Les « il y a N jours » et « dans les 7 jours » se comptent en jours calendaires à Paris, y compris autour du passage à l'heure d'hiver. → Tâches 3 et 14.
4. **Doublon d'entité** : saisir « agence x » alors qu'« Agence X » existe réutilise l'entité existante (comparaison sans tenir compte de la casse ni des espaces en trop). Une filiale ne peut pas devenir son propre groupe parent, même indirectement. → Tâche 9.
5. **PDF illisible ou refusé** (PDF scanné sans texte, fichier de 25 Mo, image renommée en `.pdf`) : message clair, pas de crash. Le fichier n'est pas stocké s'il est refusé. → Tâche 13.

---

## Structure des fichiers

```
src/
  domain/                         logique pure, sans I/O
    job-application-status.ts     statuts, libellés, transitions
    todo-alerts.ts                calcul du bandeau « À faire »
    paris-time.ts                 calculs de jours dans le fuseau Europe/Paris
    job-applications-filters.ts   recherche, filtres, tri du tableau
    entity-names.ts               normalisation et libellé « Filiale (Groupe) »
    types.ts                      types partagés (StackItem, JobApplication, …)
  server/
    supabase/                     clients Supabase (session utilisateur, service role)
    crypto/api-key-encryption.ts
    ai/                           client Claude, extractions, brief, erreurs
    repositories/                 accès aux tables, toujours filtré par user_id
    actions/                      server actions ('use server') appelées par l'UI
    data-snapshot/                export et sauvegarde
  components/<component-name>/    composants UI (convention dossier)
  app/                            routes Next.js
supabase/migrations/              SQL du schéma, RLS, stockage
tests/integration/                tests contre Supabase local
scripts/restore-backup.ts
```

---

### Task 1 : Scaffold du projet et outillage

**Files :**
- Create : le projet Next.js à la racine (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`)
- Create : `jest.config.ts`, `jest.setup.ts`, `jest.integration.config.ts`, `eslint.config.mjs`, `.env.example`, `.gitignore`
- Test : `src/domain/smoke.test.ts` (supprimé à la fin de la tâche)

**Interfaces :**
- Produit les scripts npm `test`, `test:integration`, `lint`, `typecheck`, `dev`, `build`.

- [ ] **Step 1 :** Générer le projet avec `create-next-app` : TypeScript, App Router, Tailwind, ESLint, dossier `src/`, alias `@/*`. Le dossier n'est pas vide (`.git`, `.gitignore`, `docs/`, `.superpowers/`), et `create-next-app` refuse les dossiers qui contiennent des fichiers qu'il ne connaît pas. Générer donc dans un dossier temporaire, puis déplacer les fichiers à la racine en **fusionnant** le `.gitignore` généré avec l'existant, sans écraser `docs/` ni `.git`. Initialiser ensuite shadcn/ui.
- [ ] **Step 2 :** Ajouter Jest via `next/jest` (environnement `jsdom`) et `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. `jest.config.ts` ignore `tests/integration/` ; `jest.integration.config.ts` (environnement `node`) ne lance que `tests/integration/`.
- [ ] **Step 3 :** Ajouter à ESLint les règles `@typescript-eslint/no-explicit-any: error`, `no-console: ["error", { allow: ["warn", "error"] }]` et `prefer-arrow-callback`, plus une règle qui interdit les déclarations `function` (`func-style: ["error", "expression"]`).
- [ ] **Step 4 :** `.env.example` liste `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `API_KEY_ENCRYPTION_SECRET`, `CRON_SECRET`, `GCS_BACKUP_BUCKET`, `GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64`. `.gitignore` contient `.env*.local` et `.superpowers/`.
- [ ] **Step 5 :** Écrire `src/domain/smoke.test.ts` avec `expect(1 + 1).toBe(2)`, puis lancer `npm test`, `npm run lint` et `npm run typecheck`. Attendu : les trois passent.
- [ ] **Step 6 :** Supprimer le test de fumée, puis commit `chore: scaffold next.js project with jest and lint rules`.

---

### Task 2 : Statuts et types du domaine

**Files :**
- Create : `src/domain/types.ts`, `src/domain/job-application-status.ts`
- Test : `src/domain/job-application-status.test.ts`

**Interfaces :**
- Produit :
  - `JobApplicationStatus` = `'applied' | 'intermediary_contact' | 'cv_submitted' | 'interview_scheduled' | 'interview_done' | 'contract_received' | 'signed' | 'ko_after_contact' | 'ko_cv' | 'ko_interview' | 'no_news_abandoned'`
  - `PIPELINE_STATUSES: readonly JobApplicationStatus[]`, de `applied` à `signed`, dans l'ordre
  - `JOB_APPLICATION_STATUS_LABELS: Record<JobApplicationStatus, string>`
  - `isTerminalStatus(status): boolean`
  - `isActiveStatus(status): boolean`
  - `getNextPipelineStatus(status): JobApplicationStatus | null`
  - `getSuggestedKoStatuses(status): JobApplicationStatus[]`
  - Dans `types.ts` :
    - `StackCategory = 'language' | 'framework' | 'tool' | 'method' | 'other'`
    - `StackItemOrigin = 'posting' | 'job_spec'`
    - `StackItem = { name: string; category: StackCategory; origin: StackItemOrigin }`
    - `ActivityKind = 'call' | 'message' | 'email' | 'status_change' | 'other'`
    - `InterviewKind = 'client' | 'mock' | 'other'`
    - `InterviewFormat = 'video' | 'onsite' | 'phone'`
    - `IntermediaryKind = 'agency' | 'esn' | 'platform' | 'direct' | 'other'`
    - `AlertKind = 'follow_up_due' | 'job_spec_missing' | 'end_client_unknown' | 'upcoming_interview' | 'no_news_suggestion'`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe('job application status', () => {
  it('labels statuses in French', () => {
    expect(JOB_APPLICATION_STATUS_LABELS.applied).toBe('Postulé')
    expect(JOB_APPLICATION_STATUS_LABELS.intermediary_contact).toBe('Échange intermédiaire')
    expect(JOB_APPLICATION_STATUS_LABELS.cv_submitted).toBe('CV positionné')
    expect(JOB_APPLICATION_STATUS_LABELS.interview_scheduled).toBe('Entretien planifié')
    expect(JOB_APPLICATION_STATUS_LABELS.interview_done).toBe('Entretien passé')
    expect(JOB_APPLICATION_STATUS_LABELS.contract_received).toBe('Contrat reçu')
    expect(JOB_APPLICATION_STATUS_LABELS.signed).toBe('Signé')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_after_contact).toBe('KO après échange')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_cv).toBe('KO CV')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_interview).toBe('KO entretien')
    expect(JOB_APPLICATION_STATUS_LABELS.no_news_abandoned).toBe('Sans nouvelles / abandonnée')
  })
  it('walks the pipeline in order and stops at signed', () => {
    expect(getNextPipelineStatus('applied')).toBe('intermediary_contact')
    expect(getNextPipelineStatus('contract_received')).toBe('signed')
    expect(getNextPipelineStatus('signed')).toBeNull()
    expect(getNextPipelineStatus('ko_cv')).toBeNull()
  })
  it('treats signed and every KO as terminal', () => {
    expect(isTerminalStatus('signed')).toBe(true)
    expect(isTerminalStatus('no_news_abandoned')).toBe(true)
    expect(isTerminalStatus('cv_submitted')).toBe(false)
    expect(isActiveStatus('cv_submitted')).toBe(true)
  })
  it('suggests KO outcomes that fit the current step', () => {
    expect(getSuggestedKoStatuses('applied')).toEqual(['ko_after_contact', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('intermediary_contact')).toEqual(['ko_after_contact', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('cv_submitted')).toEqual(['ko_cv', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('interview_scheduled')).toEqual(['ko_interview', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('interview_done')).toEqual(['ko_interview', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('contract_received')).toEqual(['no_news_abandoned'])
    expect(getSuggestedKoStatuses('signed')).toEqual([])
  })
})
```

- [ ] **Step 2 :** `npm test -- job-application-status`. Attendu : FAIL (module introuvable).
- [ ] **Step 3 :** Implémenter `types.ts` et `job-application-status.ts` avec les signatures ci-dessus.
- [ ] **Step 4 :** `npm test -- job-application-status`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(domain): add job application statuses and shared types`.

---

### Task 3 : Temps à Paris et calcul du bandeau « À faire »

**Files :**
- Create : `src/domain/paris-time.ts`, `src/domain/todo-alerts.ts`
- Test : `src/domain/paris-time.test.ts`, `src/domain/todo-alerts.test.ts`

**Interfaces :**
- Consomme : Task 2 (statuts, `AlertKind`).
- Produit :
  - `PARIS_TIME_ZONE = 'Europe/Paris'`
  - `countParisCalendarDaysBetween(earlier: Date, later: Date): number`
  - `formatRelativeDaysAgo(date: Date, now: Date): string` : « aujourd'hui », « hier », « il y a N j »
  - `TodoAlertInput = { jobApplications: AlertJobApplication[]; interviews: AlertInterview[]; snoozes: AlertSnooze[]; now: Date; followUpDelayDays: number }`
  - `AlertJobApplication = { id: string; title: string; status: JobApplicationStatus; appliedOn: Date; lastActivityAt: Date | null; hasJobSpec: boolean; hasEndClient: boolean }`
  - `AlertInterview = { id: string; jobApplicationId: string; startsAt: Date; kind: InterviewKind }`
  - `AlertSnooze = { jobApplicationId: string; alertKind: AlertKind; snoozedUntil: Date }`
  - `TodoAlert = { kind: AlertKind; jobApplicationId: string; jobApplicationTitle: string; referenceDate: Date; interviewId?: string }`
  - `computeTodoAlerts(input: TodoAlertInput): TodoAlert[]`
  - `NO_NEWS_SUGGESTION_DAYS = 21`, `UPCOMING_INTERVIEW_WINDOW_DAYS = 7`

Règles de `computeTodoAlerts` (copiées de la spec, avec les précisions du plan) :
- **Date de référence** d'une candidature = `lastActivityAt ?? appliedOn`.
- `follow_up_due` : statut `intermediary_contact` ou `cv_submitted`, et au moins `followUpDelayDays` jours calendaires à Paris depuis la date de référence.
- `job_spec_missing` : statut parmi `cv_submitted`, `interview_scheduled`, `interview_done`, `contract_received`, et `!hasJobSpec`.
- `end_client_unknown` : statut `interview_scheduled` et `!hasEndClient`.
- `no_news_suggestion` : statut actif et au moins 21 jours depuis la date de référence. Elle **remplace** `follow_up_due` pour la même candidature.
- `upcoming_interview` : entretien entre maintenant et maintenant + 7 jours, sur une candidature active. Ne se reporte jamais.
- Une alerte est masquée si un report correspondant (même candidature, même type) a `snoozedUntil > now`.
- Tri : d'abord `upcoming_interview` par `startsAt` croissant, puis `follow_up_due`, `job_spec_missing`, `end_client_unknown`, `no_news_suggestion`, chacun par date de référence croissante.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe('countParisCalendarDaysBetween', () => {
  it('counts Paris calendar days, not 24h blocks', () => {
    expect(countParisCalendarDaysBetween(new Date('2026-10-16T21:30:00Z'), new Date('2026-10-17T06:00:00Z'))).toBe(1)
    expect(countParisCalendarDaysBetween(new Date('2026-10-17T08:00:00Z'), new Date('2026-10-17T20:00:00Z'))).toBe(0)
  })
  it('survives the winter time change', () => {
    expect(countParisCalendarDaysBetween(new Date('2026-10-24T10:00:00Z'), new Date('2026-10-26T10:00:00Z'))).toBe(2)
  })
})

describe('computeTodoAlerts', () => {
  const now = new Date('2026-10-17T10:00:00Z')
  const baseApplication = { id: 'a1', title: 'Dev React senior', appliedOn: new Date('2026-10-01T10:00:00Z'), lastActivityAt: null, hasJobSpec: true, hasEndClient: true }

  it('raises follow_up_due after the configured delay on cv_submitted', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-10-10T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['follow_up_due'])
  })
  it('does not raise follow_up_due one day before the delay', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-10-11T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts).toEqual([])
  })
  it('raises job_spec_missing from cv_submitted onwards', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'interview_done', hasJobSpec: false, lastActivityAt: now }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['job_spec_missing'])
  })
  it('raises end_client_unknown only when an interview is scheduled', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'interview_scheduled', hasEndClient: false, lastActivityAt: now }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['end_client_unknown'])
  })
  it('replaces follow_up_due by no_news_suggestion after 21 days', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-09-25T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['no_news_suggestion'])
  })
  it('lists interviews in the next 7 days first, sorted by date', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled', hasJobSpec: false, lastActivityAt: now }],
      interviews: [
        { id: 'i2', jobApplicationId: 'a1', startsAt: new Date('2026-10-22T12:00:00Z'), kind: 'client' },
        { id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'mock' },
        { id: 'i3', jobApplicationId: 'a1', startsAt: new Date('2026-10-30T08:00:00Z'), kind: 'client' },
      ],
      snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts.map((alert) => alert.interviewId ?? alert.kind)).toEqual(['i1', 'i2', 'job_spec_missing'])
  })
  it('hides snoozed alerts until the snooze expires, never snoozes interviews', () => {
    const input = {
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled' as const, hasJobSpec: false, lastActivityAt: now }],
      interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'client' as const }],
      snoozes: [
        { jobApplicationId: 'a1', alertKind: 'job_spec_missing' as const, snoozedUntil: new Date('2026-10-20T00:00:00Z') },
        { jobApplicationId: 'a1', alertKind: 'upcoming_interview' as const, snoozedUntil: new Date('2026-10-20T00:00:00Z') },
      ],
      now, followUpDelayDays: 7,
    }
    expect(computeTodoAlerts(input).map((alert) => alert.kind)).toEqual(['upcoming_interview'])
    expect(computeTodoAlerts({ ...input, now: new Date('2026-10-20T01:00:00Z') }).map((alert) => alert.kind)).toContain('job_spec_missing')
  })
  it('ignores terminal applications entirely', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'ko_cv', hasJobSpec: false }], interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'client' }], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts).toEqual([])
  })
})
```

- [ ] **Step 2 :** `npm test -- paris-time todo-alerts`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter `paris-time.ts` avec `date-fns-tz` (convertir les deux dates en date calendaire à Paris, puis `differenceInCalendarDays`), puis `todo-alerts.ts`.
- [ ] **Step 4 :** `npm test -- paris-time todo-alerts`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(domain): compute todo alerts in Paris calendar days`.

---

### Task 4 : Schéma Supabase, RLS, stockage et test d'isolation

**Files :**
- Create : `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261017000000_initial_schema.sql`
- Create : `src/server/supabase/database-types.ts` (généré par `supabase gen types typescript --local`)
- Test : `tests/integration/data-isolation.test.ts`, `tests/integration/create-test-user.ts`

**Interfaces :**
- Produit :
  - les tables et colonnes ci-dessous (noms en `snake_case`) ;
  - le type généré `Database` ;
  - le bucket privé `job-specs`, dont les chemins sont préfixés par `<user_id>/`.

Schéma (tous les `id` en `uuid default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, plus `created_at` et `updated_at` en `timestamptz`) :
- `profiles` : `id` (PK = `auth.users.id`), `first_name`, `last_name`, `email`, `links jsonb default '[]'` (tableau de `{label, url}`), `follow_up_delay_days int not null default 7 check (between 1 and 60)`, `encrypted_anthropic_api_key text`, `anthropic_api_key_last_four text`. Un trigger sur `auth.users` crée le profil à l'insertion.
- `intermediaries` : `user_id`, `name`, `normalized_name`, `kind`, avec `unique (user_id, normalized_name)`.
- `contacts` : `user_id`, `full_name`, `normalized_name`, `phone`, `email`, `linkedin_url`, `intermediary_id` (nullable, `on delete set null`), avec `unique (user_id, normalized_name, intermediary_id)`.
- `end_clients` : `user_id`, `name`, `normalized_name`, `parent_end_client_id` (nullable, auto-référence, `on delete set null`), `notes`, `brief_markdown`, `brief_sources jsonb`, `brief_generated_at`, avec `unique (user_id, normalized_name)` et `check (parent_end_client_id <> id)`.
- `job_applications` : `user_id`, `title not null`, `source`, `posting_url`, `posting_raw_text`, `status` (enum Postgres avec les 11 valeurs de la Task 2, défaut `applied`), `intermediary_id`, `contact_id`, `end_client_id` (tous `on delete set null`), `posted_daily_rate int`, `requested_daily_rate int`, `location`, `remote_policy`, `desired_start`, `duration`, `applied_on date not null default current_date`, `notes`, `actual_start_date date`, `stack jsonb not null default '[]'`.
- `activity_log_entries` : `user_id`, `job_application_id` (`on delete cascade`), `occurred_at timestamptz not null default now()`, `kind`, `summary not null`.
- `interviews` : `user_id`, `job_application_id` (`on delete cascade`), `starts_at timestamptz not null`, `kind`, `format`, `participants`, `notes`.
- `job_specs` : `user_id`, `job_application_id unique` (`on delete cascade`), `source_kind` (`pdf` | `text`), `storage_path`, `raw_text`, `pending_stack jsonb`.
- `alert_snoozes` : `user_id`, `job_application_id` (`on delete cascade`), `alert_kind`, `snoozed_until timestamptz not null`, avec `unique (job_application_id, alert_kind)`.
- Une vue `job_applications_overview` (`security_invoker = true`) qui ajoute `last_activity_at` (`max(occurred_at)`), `has_job_spec`, `intermediary_name`, `contact_name`, `end_client_name` et `end_client_parent_name`.
- RLS sur chaque table : quatre politiques, avec `user_id = auth.uid()` (`id = auth.uid()` pour `profiles`). Politiques de stockage : `(storage.foldername(name))[1] = auth.uid()::text`.
- Dans `config.toml` : `[auth] enable_signup = false`.

- [ ] **Step 1 : Écrire le test d'intégration qui échoue**

`create-test-user.ts` exporte `createSignedInTestClient(email: string): Promise<{ client: SupabaseClient<Database>; userId: string }>`. Il crée l'utilisateur avec la clé service role (`auth.admin.createUser`, `email_confirm: true`, mot de passe aléatoire), puis le connecte avec la clé anon.

```ts
describe('data isolation between users', () => {
  it('prevents user B from reading or modifying user A data', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const { data: created } = await userA.client.from('job_applications').insert({ user_id: userA.userId, title: 'Mission A' }).select().single()

    const { data: readByB } = await userB.client.from('job_applications').select().eq('id', created!.id)
    expect(readByB).toEqual([])

    const { data: updatedByB } = await userB.client.from('job_applications').update({ title: 'Hacked' }).eq('id', created!.id).select()
    expect(updatedByB).toEqual([])

    const { error: insertForA } = await userB.client.from('job_applications').insert({ user_id: userA.userId, title: 'Forged' })
    expect(insertForA).not.toBeNull()

    const { error: uploadInA } = await userB.client.storage.from('job-specs').upload(`${userA.userId}/forged.pdf`, new Blob(['x'], { type: 'application/pdf' }))
    expect(uploadInA).not.toBeNull()
  })
  it('creates a profile with a 7-day follow-up delay for a new user', async () => {
    const user = await createSignedInTestClient(`c-${randomUUID()}@test.local`)
    const { data } = await user.client.from('profiles').select('follow_up_delay_days').single()
    expect(data?.follow_up_delay_days).toBe(7)
  })
})
```

- [ ] **Step 2 :** `supabase start`, puis `npm run test:integration`. Attendu : FAIL (tables absentes).
- [ ] **Step 3 :** Écrire la migration, `supabase db reset`, puis générer `database-types.ts`.
- [ ] **Step 4 :** `npm run test:integration`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(db): add schema with row level security and storage bucket`.

---

### Task 5 : Clients Supabase, authentification et coque de l'app

**Files :**
- Create : `src/server/supabase/create-server-supabase-client.ts`, `src/server/supabase/create-service-role-supabase-client.ts`, `src/server/supabase/get-authenticated-user.ts`
- Create : `src/server/actions/auth-actions.ts`
- Create : le fichier de session de Next (`src/middleware.ts` ou `src/proxy.ts`, selon la version installée)
- Create : `src/app/login/page.tsx`, `src/app/auth/confirm/route.ts`, `src/app/(app)/layout.tsx`
- Create : `src/components/login-form/*`, `src/components/app-shell/*`
- Test : `src/components/login-form/controller.test.tsx`

**Interfaces :**
- Produit :
  - `createServerSupabaseClient(): Promise<SupabaseClient<Database>>`, lié à la session de l'utilisateur via les cookies ;
  - `createServiceRoleSupabaseClient(): SupabaseClient<Database>`, réservé à la sauvegarde ;
  - `getAuthenticatedUser(): Promise<{ id: string; email: string }>`, qui redirige vers `/login` si personne n'est connecté ;
  - `requestMagicLink(email: string): Promise<ActionResult<null>>` et `signOut(): Promise<void>`, dans `auth-actions.ts` ;
  - `ActionResult<T> = { ok: true; data: T } | { ok: false; errorMessage: string }`, dans `src/server/actions/action-result.ts`. **Toutes les server actions du projet renvoient ce type.**

- [ ] **Step 1 :** Écrire le test qui échoue sur `useController` de `login-form`. Il reçoit `{ requestMagicLink }` en paramètre et expose `email`, `setEmail`, `submit`, `status` (`'idle' | 'sending' | 'sent' | 'error'`) et `errorMessage`. Tests :
  - un e-mail invalide n'appelle pas `requestMagicLink` et affiche `'Adresse e-mail invalide'` ;
  - un succès donne `status === 'sent'` ;
  - un `{ ok: false, errorMessage }` donne `status === 'error'` et relaie le message.
- [ ] **Step 2 :** `npm test -- login-form`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter :
  - `requestMagicLink` appelle `signInWithOtp` avec `shouldCreateUser: false`. Pour un e-mail non invité, il renvoie quand même `ok: true` et le même message, pour ne pas révéler quels comptes existent. Message affiché : « Si ce compte existe, un lien de connexion vient d'être envoyé. »
  - la route `auth/confirm` échange le jeton contre une session ;
  - le fichier de session (middleware ou proxy) rafraîchit la session et redirige toutes les routes de `(app)` vers `/login` quand personne n'est connecté ;
  - `app-shell` affiche la navigation « Candidatures », « Calendrier », « Réglages » et un bouton « Se déconnecter ».
- [ ] **Step 4 :** `npm test -- login-form`. Attendu : PASS. Vérification manuelle : `npm run dev`, puis inviter un utilisateur depuis Supabase Studio local (`http://localhost:54323`) ; le lien reçu dans Inbucket (`http://localhost:54324`) connecte, et `/` sans session redirige vers `/login`.
- [ ] **Step 5 :** Commit `feat(auth): add invite-only magic link login and app shell`.

---

### Task 6 : Chiffrement de la clé API et page Réglages

**Files :**
- Create : `src/server/crypto/api-key-encryption.ts`
- Create : `src/server/repositories/profile-repository.ts`, `src/server/actions/settings-actions.ts`
- Create : `src/app/(app)/settings/page.tsx`
- Create : `src/components/profile-form/*`, `src/components/anthropic-api-key-form/*`
- Test : `src/server/crypto/api-key-encryption.test.ts`, `src/components/anthropic-api-key-form/controller.test.tsx`, `src/components/profile-form/controller.test.tsx`

**Interfaces :**
- Consomme : Task 5 (`getAuthenticatedUser`, `createServerSupabaseClient`, `ActionResult`).
- Produit :
  - `encryptApiKey(plainApiKey: string, base64Secret: string): string`, au format `v1:<iv b64>:<authTag b64>:<ciphertext b64>` ;
  - `decryptApiKey(encryptedApiKey: string, base64Secret: string): string`, qui lève une erreur si le texte a été altéré ;
  - `getDecryptedAnthropicApiKeyForUser(userId: string): Promise<string | null>` (dans `profile-repository.ts`, réservé au serveur) ;
  - `ProfileSettings = { firstName: string; lastName: string; email: string; links: { label: string; url: string }[]; followUpDelayDays: number; anthropicApiKeyLastFour: string | null }`
  - les actions `getProfileSettings(): Promise<ActionResult<ProfileSettings>>`, `updateProfileSettings(input): Promise<ActionResult<ProfileSettings>>`, `saveAnthropicApiKey(plainApiKey: string): Promise<ActionResult<{ lastFour: string }>>` et `deleteAnthropicApiKey(): Promise<ActionResult<null>>`.
  - `saveAnthropicApiKey` reçoit un paramètre interne `verifyApiKey: (apiKey: string) => Promise<boolean>` (dépendance injectée ; l'implémentation réelle arrive à la Task 7 et appelle `client.models.retrieve(CLAUDE_MODELS.extraction)`).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
const secret = randomBytes(32).toString('base64')
it('round-trips an api key', () => {
  expect(decryptApiKey(encryptApiKey('sk-ant-api03-abc', secret), secret)).toBe('sk-ant-api03-abc')
})
it('never produces the same ciphertext twice', () => {
  expect(encryptApiKey('sk-ant-x', secret)).not.toBe(encryptApiKey('sk-ant-x', secret))
})
it('rejects a tampered ciphertext', () => {
  const [version, iv, tag, cipher] = encryptApiKey('sk-ant-x', secret).split(':')
  const tampered = [version, iv, tag, Buffer.from('zzzz').toString('base64')].join(':')
  expect(() => decryptApiKey(tampered, secret)).toThrow()
})
it('rejects a wrong secret', () => {
  expect(() => decryptApiKey(encryptApiKey('sk-ant-x', secret), randomBytes(32).toString('base64'))).toThrow()
})
```

Tests du `useController` de `anthropic-api-key-form` (actions injectées) :
- une valeur qui ne commence pas par `sk-ant-` affiche `'Une clé Claude commence par sk-ant-'` sans appel serveur ;
- un succès vide le champ (la clé ne reste jamais dans l'état du composant) et affiche `sk-ant-…<lastFour>` ;
- un échec affiche `'Clé refusée par Claude : vérifie-la ou ton crédit'`.

Tests du `useController` de `profile-form` :
- un délai de relance hors de 1 à 60 jours est refusé avec `'Entre 1 et 60 jours'` ;
- un lien sans `https://` est refusé.

- [ ] **Step 2 :** `npm test -- api-key-encryption anthropic-api-key-form profile-form`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter :
  - le chiffrement avec `node:crypto` (`aes-256-gcm`, IV aléatoire de 12 octets) ;
  - la page Réglages : profil, délai de relance, clé API (état, « Remplacer », « Supprimer »), le conseil « Fixe un plafond de dépenses mensuel dans la console Anthropic », et un emplacement « Exporter mes données » (branché à la Task 16).
  - `getProfileSettings` ne sélectionne jamais la colonne `encrypted_anthropic_api_key`.
- [ ] **Step 4 :** `npm test -- api-key-encryption anthropic-api-key-form profile-form`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(settings): add profile settings and encrypted per-user api key`.

---

### Task 7 : Client Claude, erreurs et extraction d'annonce

**Files :**
- Create : `src/server/ai/claude-models.ts`, `src/server/ai/create-anthropic-client.ts`, `src/server/ai/ai-error.ts`, `src/server/ai/extract-job-posting.ts`, `src/server/ai/verify-anthropic-api-key.ts`
- Create : `src/server/actions/ai-actions.ts` (fonction `extractJobPostingForCurrentUser`)
- Create : `src/server/ai/testing/fake-anthropic-client.ts`, qui fournit les aides de test `createFakeAnthropicClientReturning`, `emptyExtraction`, `mockGetDecryptedKey` et `mockAnthropicThrows`, réutilisées à la Task 8
- Test : `src/server/ai/ai-error.test.ts`, `src/server/ai/extract-job-posting.test.ts`

Les constructeurs d'erreurs du SDK dans les tests ci-dessous sont indicatifs : les adapter aux signatures du SDK installé.

**Interfaces :**
- Consomme : Task 6 (`getDecryptedAnthropicApiKeyForUser`), Task 2 (`StackItem`).
- Produit :
  - `CLAUDE_MODELS = { extraction: 'claude-haiku-5-5', brief: 'claude-sonnet-5-5' } as const`
  - `createAnthropicClient(apiKey: string): Anthropic`
  - `AiErrorKind = 'missing_api_key' | 'invalid_api_key' | 'rate_limited' | 'refused' | 'timeout' | 'input_too_long' | 'unknown'`
  - `toAiErrorKind(error: unknown): AiErrorKind`, qui s'appuie sur les classes d'erreur typées du SDK
  - `AI_ERROR_MESSAGES: Record<AiErrorKind, string>`
  - `JobPostingExtraction = { title: string | null; intermediaryName: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; endClientName: string | null; postedDailyRate: number | null; location: string | null; remotePolicy: string | null; desiredStart: string | null; duration: string | null; stack: StackItem[] }`
  - `extractJobPosting(client: Anthropic, rawText: string): Promise<JobPostingExtraction>`
  - `extractJobPostingForCurrentUser(rawText: string): Promise<ActionResult<JobPostingExtraction>>`
  - `verifyAnthropicApiKey(apiKey: string): Promise<boolean>`, branché dans `saveAnthropicApiKey`
  - `MAX_PASTED_TEXT_LENGTH = 50_000`

Messages d'erreur :
- `missing_api_key` : « Ajoute ta clé Claude dans les réglages pour activer le pré-remplissage. Tu peux saisir à la main en attendant. »
- `invalid_api_key` : « Ta clé Claude est invalide ou sans crédit, remplace-la dans les réglages. »
- `rate_limited` : « Claude est saturé, réessaie dans une minute. »
- `refused` : « Claude n'a pas pu traiter ce texte. Saisis les champs à la main. »
- `timeout` : « Claude n'a pas répondu à temps, réessaie. »
- `input_too_long` : « Texte trop long (50 000 caractères maximum). »
- `unknown` : « L'extraction a échoué. Saisis les champs à la main. »

- [ ] **Step 1 : Écrire les tests qui échouent.** Le client Claude est remplacé par un faux objet qui expose la méthode utilisée.

```ts
it('maps an authentication error to invalid_api_key', () => {
  expect(toAiErrorKind(new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()))).toBe('invalid_api_key')
})
it('maps a rate limit error to rate_limited', () => {
  expect(toAiErrorKind(new Anthropic.RateLimitError(429, {}, 'rate', new Headers()))).toBe('rate_limited')
})
it('returns all-null fields without throwing for an unrelated text', async () => {
  const client = createFakeAnthropicClientReturning({ title: null, intermediaryName: null, contactName: null, contactEmail: null, contactPhone: null, endClientName: null, postedDailyRate: null, location: null, remotePolicy: null, desiredStart: null, duration: null, stack: [] })
  await expect(extractJobPosting(client, 'Salut, dispo pour un café ?')).resolves.toMatchObject({ title: null, stack: [] })
})
it('tags every extracted stack item with origin posting', async () => {
  const client = createFakeAnthropicClientReturning({ ...emptyExtraction, stack: [{ name: 'React', category: 'framework' }] })
  const result = await extractJobPosting(client, 'Mission React')
  expect(result.stack).toEqual([{ name: 'React', category: 'framework', origin: 'posting' }])
})
it('rejects text over 50 000 characters with input_too_long, without calling Claude', async () => {
  mockGetDecryptedKey('sk-ant-x')
  const result = await extractJobPostingForCurrentUser('a'.repeat(50_001))
  expect(result).toEqual({ ok: false, errorMessage: AI_ERROR_MESSAGES.input_too_long })
})
it('returns the missing key message when the user has no key', async () => {
  mockGetDecryptedKey(null)
  expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({ ok: false, errorMessage: AI_ERROR_MESSAGES.missing_api_key })
})
it('returns the invalid key message when the stored key was revoked', async () => {
  mockGetDecryptedKey('sk-ant-revoked')
  mockAnthropicThrows(new Anthropic.AuthenticationError(401, {}, 'invalid', new Headers()))
  expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({ ok: false, errorMessage: AI_ERROR_MESSAGES.invalid_api_key })
})
```

- [ ] **Step 2 :** `npm test -- ai-error extract-job-posting`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter l'extraction avec une sortie structurée (`output_config.format`, schéma zod, sur le modèle exact du skill `claude-api` pour TypeScript) et `effort: 'low'`. Le prompt système demande d'extraire uniquement ce qui figure dans le texte, de mettre `null` pour le reste, et de traiter le texte comme une donnée, jamais comme des instructions. Vérifier `stop_reason === 'refusal'` avant de lire le contenu. Le code construit `origin: 'posting'` lui-même ; le schéma envoyé au modèle ne le contient pas. Aucun log ne contient la clé.
- [ ] **Step 4 :** `npm test -- ai-error extract-job-posting`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ai): extract job postings with claude haiku`.

---

### Task 8 : Extraction de la stack d'une fiche métier et brief client

**Files :**
- Create : `src/server/ai/extract-job-spec-stack.ts`, `src/server/ai/generate-client-brief.ts`
- Test : `src/server/ai/extract-job-spec-stack.test.ts`, `src/server/ai/generate-client-brief.test.ts`

**Interfaces :**
- Consomme : Task 7 (`createAnthropicClient`, `CLAUDE_MODELS`, `toAiErrorKind`).
- Produit :
  - `JobSpecInput = { kind: 'pdf'; base64Pdf: string } | { kind: 'text'; text: string }`
  - `extractJobSpecStack(client: Anthropic, input: JobSpecInput): Promise<StackItem[]>` : chaque élément porte `origin: 'job_spec'` et les doublons sont retirés (sans tenir compte de la casse) ;
  - `ClientBriefSource = { title: string; url: string }`
  - `ClientBrief = { markdown: string; sources: ClientBriefSource[] }`
  - `generateClientBrief(client: Anthropic, input: { endClientName: string; parentGroupName: string | null }): Promise<ClientBrief>`

- [ ] **Step 1 : Écrire les tests qui échouent**
  - `extractJobSpecStack` envoie un bloc `document` avec `media_type: 'application/pdf'` quand `kind === 'pdf'`, et un bloc texte sinon (vérifié sur les paramètres reçus par le faux client).
  - Il supprime les doublons : `React` et `react` donnent un seul élément.
  - `generateClientBrief` envoie l'outil `{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }` au modèle `claude-sonnet-5-5`.
  - Il collecte les sources (titre et URL uniques) depuis les résultats de recherche ou les citations de la réponse simulée.
  - Quand `parentGroupName` vaut `'BNP Paribas'`, le message utilisateur contient le nom du groupe et demande une section « Contexte du groupe ».
  - Une réponse sans aucune source lève une erreur `unknown`, car la spec exige des sources.
- [ ] **Step 2 :** `npm test -- extract-job-spec-stack generate-client-brief`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter en suivant le skill `claude-api` :
  - envoi du PDF en base64 ;
  - recherche web, en gérant `pause_turn` et le fait qu'une erreur de l'outil de recherche arrive dans un bloc résultat, sans exception ;
  - pour Sonnet 5.5, paramètre `fallbacks: 'default'` avec le beta `server-side-fallback-2026-07-01` ;
  - streaming avec `finalMessage()`.

  Le brief, en markdown et en français, couvre les enjeux, le chiffre d'affaires, la croissance, le marché, les actualités récentes, et le contexte du groupe s'il y a un parent.
- [ ] **Step 4 :** `npm test -- extract-job-spec-stack generate-client-brief`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ai): extract job spec stacks and generate client briefs with web search`.

---

### Task 9 : Repositories et actions des candidatures, entités, journal et reports

**Files :**
- Create : `src/domain/entity-names.ts`
- Create : `src/server/repositories/job-applications-repository.ts`, `entities-repository.ts`, `activity-log-repository.ts`, `alert-snoozes-repository.ts`
- Create : `src/server/actions/job-application-actions.ts`, `src/server/actions/entity-actions.ts`
- Test : `src/domain/entity-names.test.ts`, `tests/integration/job-applications.test.ts`, `tests/integration/entities.test.ts`

**Interfaces :**
- Consomme : Tasks 2, 4 et 5.
- Produit :
  - `normalizeEntityName(name: string): string` : minuscules, accents retirés, espaces réduits à un seul, bords coupés
  - `formatEndClientLabel(name: string, parentName: string | null): string`, qui donne `'BNP Paribas AM (BNP Paribas)'` ou `'Banque Z'`
  - `JobApplicationOverview` : tous les champs de la vue `job_applications_overview` en camelCase, avec les dates en `Date`, `stack: StackItem[]` et `endClientLabel: string | null`
  - `JobApplicationInput` : les champs éditables, plus `intermediaryName`, `contactName`, `contactEmail`, `contactPhone`, `endClientName` et `endClientParentName`. Le serveur résout ou crée les entités, et complète l'e-mail et le téléphone d'un contact seulement s'ils sont vides.
  - `ActivityLogEntry = { id: string; jobApplicationId: string; occurredAt: Date; kind: ActivityKind; summary: string }`
  - `ContactDetails = { id: string; fullName: string; phone: string | null; email: string | null; linkedinUrl: string | null }`
  - Actions :
    - `listJobApplications(): Promise<ActionResult<JobApplicationOverview[]>>`
    - `getJobApplication(id: string): Promise<ActionResult<JobApplicationOverview>>`
    - `createJobApplication(input: JobApplicationInput): Promise<ActionResult<{ id: string }>>`
    - `updateJobApplication(id: string, input: Partial<JobApplicationInput>): Promise<ActionResult<null>>`
    - `changeJobApplicationStatus(id: string, newStatus: JobApplicationStatus): Promise<ActionResult<null>>` : crée une entrée de journal `status_change` intitulée `'Statut : <ancien libellé> → <nouveau libellé>'` et supprime les reports de cette candidature
    - `addActivityLogEntry(jobApplicationId: string, input: { kind: ActivityKind; summary: string; occurredAt?: Date }): Promise<ActionResult<null>>` : supprime aussi les reports de la candidature
    - `listActivityLogEntries(jobApplicationId: string): Promise<ActionResult<ActivityLogEntry[]>>`, du plus récent au plus ancien
    - `snoozeAlert(jobApplicationId: string, alertKind: AlertKind, days: 3 | 7): Promise<ActionResult<null>>` : refuse `upcoming_interview`
    - `searchEntities(kind: 'intermediary' | 'contact' | 'end_client', query: string): Promise<ActionResult<EntitySuggestion[]>>`, où `EntitySuggestion = { id: string; label: string }`
    - `setEndClientParent(endClientId: string, parentEndClientId: string | null): Promise<ActionResult<null>>`
    - `getContactDetails(contactId: string): Promise<ActionResult<ContactDetails>>` et `updateContactDetails(contactId: string, input: Omit<ContactDetails, 'id'>): Promise<ActionResult<null>>`
    - `updateIntermediaryKind(intermediaryId: string, kind: IntermediaryKind): Promise<ActionResult<null>>`

- [ ] **Step 1 : Écrire les tests qui échouent**
  - **Unitaires (`entity-names.test.ts`)** :
    - `normalizeEntityName('  Agence   X ')` égale `normalizeEntityName('agence x')` ;
    - `normalizeEntityName('Société Générale')` vaut `'societe generale'` ;
    - `formatEndClientLabel('BNP Paribas AM', 'BNP Paribas')` vaut `'BNP Paribas AM (BNP Paribas)'`.
  - **Intégration (`job-applications.test.ts`, Supabase local)** :
    - créer une candidature avec `intermediaryName: 'Agence X'`, puis une autre avec `'agence x '`, donne un seul intermédiaire ;
    - `changeJobApplicationStatus` crée exactement une entrée `status_change` et supprime un report existant ;
    - `addActivityLogEntry` met à jour `lastActivityAt` dans `listJobApplications` ;
    - `snoozeAlert(id, 'upcoming_interview', 3)` renvoie `ok: false` ;
    - un appel avec l'`id` d'une candidature d'un autre utilisateur renvoie `ok: false` sans rien modifier.
  - **Intégration (`entities.test.ts`)** :
    - `endClientName: 'BNP Paribas AM'` avec `endClientParentName: 'BNP Paribas'` crée deux clients liés ;
    - `setEndClientParent(groupe, filiale)`, alors que la filiale a déjà ce groupe pour parent, renvoie `ok: false` avec `'Un groupe ne peut pas être sa propre filiale'` (détection des cycles sur toute la chaîne) ;
    - `searchEntities('end_client', 'bnp')` renvoie les libellés au format `Filiale (Groupe)`.
- [ ] **Step 2 :** `npm test -- entity-names`, puis `npm run test:integration`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. La résolution d'une entité par nom passe par un upsert sur `(user_id, normalized_name)`. Toute action commence par `getAuthenticatedUser()`. La vérification d'appartenance se fait par le filtre `user_id`, en plus de la RLS.
- [ ] **Step 4 :** Relancer les deux commandes. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(data): add job application, entity, activity log and snooze actions`.

---

### Task 10 : Page « Mes candidatures » (bandeau « À faire » et tableau)

**Files :**
- Create : `src/domain/job-applications-filters.ts`
- Create : `src/app/(app)/page.tsx`
- Create : `src/components/todo-banner/*`, `src/components/job-applications-table/*`, `src/components/status-badge/*`
- Test : `src/domain/job-applications-filters.test.ts`, `src/components/todo-banner/controller.test.tsx`, `src/components/job-applications-table/controller.test.tsx`

**Interfaces :**
- Consomme : Task 3 (`computeTodoAlerts`, `formatRelativeDaysAgo`) et Task 9 (`listJobApplications`, `snoozeAlert`). La page charge aussi les entretiens via `listUpcomingInterviews(from: Date, to: Date): Promise<ActionResult<InterviewWithJobApplication[]>>`, défini à la Task 14. Jusqu'à la Task 14, le paramètre `interviews` du bandeau reste un tableau vide.
- Produit :
  - `JobApplicationsTableFilters = { searchText: string; statuses: JobApplicationStatus[]; sources: string[]; showTerminal: boolean }`
  - `JobApplicationsSortKey = 'title' | 'intermediaryName' | 'contactName' | 'endClientLabel' | 'source' | 'status' | 'appliedOn' | 'lastActivityAt'`
  - `filterAndSortJobApplications(applications: JobApplicationOverview[], filters: JobApplicationsTableFilters, sort: { key: JobApplicationsSortKey; direction: 'asc' | 'desc' }): JobApplicationOverview[]`

Textes des alertes dans le bandeau :
- `follow_up_due` : « Relancer <contact ou intermédiaire> : <statut> il y a N j sans retour »
- `job_spec_missing` : « Pas de fiche métier pour « <titre> » »
- `end_client_unknown` : « Client final inconnu pour « <titre> » : demande-le avant l'entretien »
- `upcoming_interview` : « <Entretien client | Entretien blanc> <jour date heure> : <titre> »
- `no_news_suggestion` : « Sans nouvelles depuis N j : <titre>. La clore ? »

Chaque alerte reportable propose « Reporter 3 j » et « Reporter 7 j ». La suggestion « sans nouvelles » propose aussi « Clore », qui passe la candidature en `no_news_abandoned`. Quand il n'y a aucune alerte, le bandeau affiche « Rien d'urgent aujourd'hui. »

- [ ] **Step 1 : Écrire les tests qui échouent**
  - **Filtres** :
    - par défaut (`showTerminal: false`), les candidatures `signed` et `ko_*` sont masquées ;
    - la recherche `'bnp'` trouve une candidature dont seul le client final contient « BNP », sans tenir compte de la casse ni des accents ;
    - le tri `lastActivityAt` décroissant met les valeurs `null` en dernier ;
    - le filtre `sources: ['LinkedIn']` ne garde que cette source.
  - **Contrôleur `todo-banner`** :
    - `snooze(alert, 3)` appelle `snoozeAlert(jobApplicationId, kind, 3)` et retire l'alerte de la liste de façon optimiste ; en cas d'échec, l'alerte réapparaît avec le message d'erreur ;
    - `closeAsNoNews(alert)` appelle `changeJobApplicationStatus(id, 'no_news_abandoned')`.
  - **Contrôleur `job-applications-table`** :
    - cliquer deux fois sur un en-tête inverse le tri ;
    - `availableSources` liste les sources distinctes présentes dans les données.
- [ ] **Step 2 :** `npm test -- job-applications-filters todo-banner job-applications-table`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter :
  - le tableau a les colonnes de la spec (mission, intermédiaire, contact, client final, source, statut, date de candidature, dernier échange en relatif), et un clic sur une ligne ouvre `/candidatures/<id>` ;
  - la page (composant serveur) charge les données et le profil (`followUpDelayDays`), puis passe `now` au bandeau ;
  - un bouton « Nouvelle candidature » ouvre `/candidatures/new`.
- [ ] **Step 4 :** Relancer la commande. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add job applications page with todo banner`.

---

### Task 11 : Ajout d'une candidature (texte collé, pré-remplissage, validation)

**Files :**
- Create : `src/app/(app)/candidatures/new/page.tsx`
- Create : `src/components/new-job-application-form/*`, `src/components/entity-autocomplete/*`, `src/components/stack-chips-editor/*`
- Test : `src/components/new-job-application-form/controller.test.tsx`, `src/components/entity-autocomplete/controller.test.tsx`, `src/components/stack-chips-editor/controller.test.tsx`

**Interfaces :**
- Consomme : Task 7 (`extractJobPostingForCurrentUser`, `MAX_PASTED_TEXT_LENGTH`) et Task 9 (`createJobApplication`, `searchEntities`).
- Produit :
  - `EntityAutocomplete`, avec les props `{ entityKind: 'intermediary' | 'contact' | 'end_client'; value: string; onChange: (value: string) => void; searchEntities: typeof searchEntities }`, réutilisé à la Task 12 ;
  - `StackChipsEditor`, avec les props `{ stack: StackItem[]; onChange: (stack: StackItem[]) => void }`, réutilisé aux Tasks 12 et 13.
- Sources proposées : `Free-Work`, `Collective`, `LeHibou`, `Malt`, `LinkedIn`, `Bouche-à-oreille`, `Autre` (saisie libre possible).

- [ ] **Step 1 : Écrire les tests qui échouent.** Contrôleur de `new-job-application-form`, avec les actions injectées :
  - **Étape « coller »** :
    - `extract()` avec un texte vide affiche `'Colle le texte de l\'annonce ou passe en saisie manuelle'` sans appel serveur ;
    - au-delà de 50 000 caractères, `'Texte trop long (50 000 caractères maximum).'` s'affiche sans appel serveur.
  - **Extraction réussie** :
    - les champs `title`, `intermediaryName`, `endClientName` et `stack` sont pré-remplis ;
    - `postingRawText` vaut le texte collé ;
    - `status` vaut `'applied'` et `appliedOn` vaut aujourd'hui (date de Paris) ;
    - **`createJobApplication` n'a pas été appelé**.
  - **Extraction en échec** (`ok: false`) : le formulaire s'affiche vide, avec le texte collé conservé et le message d'erreur visible.
  - `switchToManualEntry()` affiche le formulaire vide sans appel à l'IA.
  - `submit()` sans titre affiche `'Le titre est obligatoire'`. Un `submit()` valide appelle `createJobApplication` une seule fois, même après deux clics rapides, puis redirige vers `/candidatures/<id>`.
  - **`entity-autocomplete`** : la recherche est différée de 250 ms ; une saisie libre reste possible quand aucune suggestion ne correspond.
  - **`stack-chips-editor`** : on peut ajouter, retirer et changer la catégorie d'un élément ; ajouter un nom déjà présent (sans tenir compte de la casse) ne crée pas de doublon.
- [ ] **Step 2 :** `npm test -- new-job-application-form entity-autocomplete stack-chips-editor`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter l'écran en deux étapes : une zone de collage avec « Pré-remplir » et « Saisie manuelle », puis le formulaire.
- [ ] **Step 4 :** Relancer la commande. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add job application creation with ai prefill`.

---

### Task 12 : Fiche candidature (en-tête, infos mission, journal)

**Files :**
- Create : `src/app/(app)/candidatures/[jobApplicationId]/page.tsx`
- Create : `src/components/job-application-header/*`, `src/components/mission-info-form/*`, `src/components/activity-log/*`
- Test : un `controller.test.tsx` pour chacun des trois composants

**Interfaces :**
- Consomme : Task 2 (`getNextPipelineStatus`, `getSuggestedKoStatuses`, `PIPELINE_STATUSES`) ; Task 9 (`getJobApplication`, `updateJobApplication`, `changeJobApplicationStatus`, `addActivityLogEntry`, `listActivityLogEntries`) ; Task 11 (`EntityAutocomplete`, `StackChipsEditor`).
- Produit : la page de détail, avec des emplacements nommés pour les sections des Tasks 13 et 14 (`JobSpecSection`, `ClientBriefSection`, `InterviewsSection`).

- [ ] **Step 1 : Écrire les tests qui échouent**
  - **En-tête** :
    - `advance()` appelle `changeJobApplicationStatus(id, getNextPipelineStatus(status))`, et le bouton est masqué pour un statut terminal ;
    - `koOptions` vaut `getSuggestedKoStatuses(status)` ;
    - un sélecteur « Changer le statut » permet n'importe quel statut, pour corriger une erreur ;
    - le client final affiche « Client inconnu » quand il est vide.
  - **Infos mission** :
    - la sauvegarde envoie uniquement les champs modifiés ;
    - un TJM négatif ou non numérique est refusé avec `'TJM invalide'` ;
    - le bloc contact affiche téléphone, e-mail et LinkedIn, modifiables via `updateContactDetails` ;
    - un e-mail de contact mal formé est refusé avec `'E-mail invalide'`.
  - **Journal** :
    - l'ajout rapide se fait en deux interactions (choisir le type, avec « Appel » par défaut ; taper le résumé et valider avec Entrée) ;
    - un résumé vide est refusé ;
    - la nouvelle entrée apparaît en tête de liste.
- [ ] **Step 2 :** `npm test -- job-application-header mission-info-form activity-log`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter la page dans la disposition validée : en-tête sur toute la largeur, deux colonnes en dessous, journal en bas.
- [ ] **Step 4 :** Relancer la commande. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add job application detail page with activity log`.

---

### Task 13 : Section fiche métier (PDF ou texte, stack en brouillon)

**Files :**
- Create : `src/server/actions/job-spec-actions.ts`, `src/server/repositories/job-specs-repository.ts`
- Create : `src/components/job-spec-section/*`
- Test : `src/components/job-spec-section/controller.test.tsx`, `tests/integration/job-specs.test.ts`

**Interfaces :**
- Consomme : Task 8 (`extractJobSpecStack`) et Task 11 (`StackChipsEditor`).
- Produit :
  - `uploadJobSpecPdf(jobApplicationId: string, formData: FormData): Promise<ActionResult<{ pendingStack: StackItem[] | null; aiErrorMessage: string | null }>>`
  - `saveJobSpecText(jobApplicationId: string, text: string): Promise<ActionResult<{ pendingStack: StackItem[] | null; aiErrorMessage: string | null }>>`
  - `confirmJobSpecStack(jobApplicationId: string, stack: StackItem[]): Promise<ActionResult<null>>` : remplace `job_applications.stack` et vide `pending_stack`
  - `discardPendingJobSpecStack(jobApplicationId: string): Promise<ActionResult<null>>`
  - `getJobSpecDownloadUrl(jobApplicationId: string): Promise<ActionResult<string>>` : URL signée valable 5 minutes
  - `MAX_JOB_SPEC_PDF_BYTES = 10 * 1024 * 1024`

Règles :
- Le fichier est contrôlé **avant** son stockage : taille d'au plus 10 Mo, type `application/pdf`, et signature `%PDF-` dans les 5 premiers octets.
- La fiche (fichier ou texte) est enregistrée même si l'extraction échoue : l'alerte « fiche manquante » disparaît, et le message d'erreur de l'IA s'affiche.
- Un PDF sans texte exploitable (le modèle ne renvoie aucune technologie) affiche : « Aucune technologie trouvée dans ce document (PDF scanné ?). Ajoute la stack à la main. »
- Remplacer une fiche existante supprime l'ancien fichier du stockage.

- [ ] **Step 1 : Écrire les tests qui échouent**
  - **Contrôleur** :
    - un fichier de 25 Mo est refusé côté client avec `'PDF trop lourd (10 Mo maximum)'` ;
    - un fichier `image/png` est refusé avec `'Seuls les PDF sont acceptés'` ;
    - une `pendingStack` reçue s'affiche en brouillon, avec « Valider » et « Ignorer » ;
    - « Valider » appelle `confirmJobSpecStack` avec la stack éditée ;
    - une `pendingStack` vide affiche le message « PDF scanné ».
  - **Intégration** :
    - un fichier nommé `.pdf` qui ne commence pas par `%PDF-` renvoie `ok: false`, et rien n'est stocké dans `job-specs` ;
    - `confirmJobSpecStack` remplace la stack d'origine `posting` par la stack d'origine `job_spec`.
- [ ] **Step 2 :** `npm test -- job-spec-section`, puis `npm run test:integration`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Le chemin de stockage est `<userId>/<jobApplicationId>/<uuid>.pdf`. La server action accepte une taille de corps suffisante pour 10 Mo (`serverActions.bodySizeLimit` dans `next.config.ts`).
- [ ] **Step 4 :** Relancer les deux commandes. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(job-spec): upload or paste job specs with draft stack validation`.

---

### Task 14 : Sections brief client et entretiens

**Files :**
- Create : `src/server/actions/client-brief-actions.ts`, `src/server/actions/interview-actions.ts`, `src/server/repositories/interviews-repository.ts`
- Create : `src/components/client-brief-section/*`, `src/components/interviews-section/*`
- Test : `src/components/client-brief-section/controller.test.tsx`, `src/components/interviews-section/controller.test.tsx`, `src/domain/paris-time.test.ts` (ajouts)

**Interfaces :**
- Consomme : Task 8 (`generateClientBrief`), Task 3 (`paris-time`), Task 9.
- Produit :
  - `generateBriefForEndClient(endClientId: string): Promise<ActionResult<{ markdown: string; sources: ClientBriefSource[]; generatedAt: Date }>>`
  - `updateEndClientNotes(endClientId: string, notes: string): Promise<ActionResult<null>>`
  - `Interview = { id: string; jobApplicationId: string; startsAt: Date; kind: InterviewKind; format: InterviewFormat; participants: string | null; notes: string | null }`
  - `InterviewWithJobApplication = Interview & { jobApplicationTitle: string; endClientLabel: string | null; stack: StackItem[] }`
  - `createInterview(jobApplicationId: string, input: InterviewInput): Promise<ActionResult<{ id: string }>>`, `updateInterview(id: string, input: InterviewInput)`, `deleteInterview(id: string)`, `listInterviewsForJobApplication(jobApplicationId: string)`, `listUpcomingInterviews(from: Date, to: Date): Promise<ActionResult<InterviewWithJobApplication[]>>`
  - `InterviewInput = { parisLocalDateTime: string; kind: InterviewKind; format: InterviewFormat; participants: string | null; notes: string | null }`, où `parisLocalDateTime` est au format `'YYYY-MM-DDTHH:mm'`
  - Dans `paris-time.ts` : `parisLocalDateTimeToUtc(parisLocalDateTime: string): Date` et `formatParisDateTime(date: Date): string`, qui donne par exemple `'mar. 28/10 · 14h00'`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
it('stores 14:00 Paris as 13:00 UTC in winter and 12:00 UTC in summer', () => {
  expect(parisLocalDateTimeToUtc('2026-10-28T14:00').toISOString()).toBe('2026-10-28T13:00:00.000Z')
  expect(parisLocalDateTimeToUtc('2026-07-01T14:00').toISOString()).toBe('2026-07-01T12:00:00.000Z')
})
it('formats back to Paris time regardless of process timezone', () => {
  expect(formatParisDateTime(new Date('2026-10-28T13:00:00Z'))).toBe('mer. 28/10 · 14h00')
})
```

  Lancer ces deux tests avec `TZ=UTC` et avec `TZ=America/New_York` (script `test:tz` dans `package.json`).

  - **Contrôleur `client-brief-section`** :
    - client inconnu : `state === 'unknown_client'`, aucun bouton de génération, et le message « Client inconnu, demande-le à l'intermédiaire » ;
    - `generate()` est désactivé pendant le chargement, qui dure plusieurs secondes : deux clics ne déclenchent qu'un seul appel ;
    - un succès affiche le markdown, les sources et la date de génération ;
    - un échec affiche le message d'erreur de l'IA et conserve l'ancien brief s'il en existait un ;
    - les notes s'enregistrent après 800 ms d'inactivité.
  - **Contrôleur `interviews-section`** :
    - une date passée est acceptée, pour saisir un entretien après coup ;
    - un entretien sans date est refusé ;
    - la liste est triée par `startsAt` croissant.
- [ ] **Step 2 :** `npm test -- client-brief-section interviews-section paris-time`, puis `npm run test:tz`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Le brief s'affiche en markdown, avec un rendu sûr (pas de HTML brut) et des liens de sources externes ouverts avec `rel="noopener noreferrer"`. Brancher `listUpcomingInterviews` dans la page de la Task 10.
- [ ] **Step 4 :** Relancer les commandes. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add client brief and interviews sections`.

---

### Task 15 : Page Calendrier

**Files :**
- Create : `src/app/(app)/calendar/page.tsx`
- Create : `src/components/interviews-calendar/*`, `src/components/interview-revision-panel/*`
- Test : `src/components/interviews-calendar/controller.test.tsx`

**Interfaces :**
- Consomme : Task 14 (`listUpcomingInterviews`, `formatParisDateTime`).
- Produit : la route `/calendar`.

- [ ] **Step 1 : Écrire les tests qui échouent.** Contrôleur de `interviews-calendar` :
  - `toCalendarEvents(interviews)` donne aux entretiens client et aux entretiens blancs des `classNames` distincts (`'interview-client'` et `'interview-mock'`) ;
  - changer de plage visible (`onDatesSet(start, end)`) recharge les entretiens de cette plage ;
  - `selectInterview(id)` ouvre le panneau avec le titre, le client final, la stack groupée par catégorie, et un lien vers `/candidatures/<jobApplicationId>`.
- [ ] **Step 2 :** `npm test -- interviews-calendar`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter avec FullCalendar : vues `dayGridMonth` et `timeGridWeek`, `timeZone: 'Europe/Paris'`, `locale: 'fr'`. Le panneau de révision est un tiroir latéral.
- [ ] **Step 4 :** `npm test -- interviews-calendar`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add interviews calendar with revision panel`.

---

### Task 16 : Export des données, sauvegarde automatique et restauration

**Files :**
- Create : `src/server/data-snapshot/build-user-data-snapshot.ts`, `src/server/data-snapshot/upload-backup-to-gcs.ts`
- Create : `src/app/api/export/route.ts`, `src/app/api/cron/backup/route.ts`
- Create : `vercel.json`, `scripts/restore-backup.ts`
- Modify : la page Réglages (Task 6), pour brancher le bouton « Exporter mes données »
- Create : `README.md` (installation locale, variables d'environnement, invitation d'un utilisateur, restauration)
- Test : `tests/integration/data-snapshot.test.ts`, `src/app/api/cron/backup/route.test.ts`

**Interfaces :**
- Consomme : Task 5 (clients Supabase) et le schéma de la Task 4.
- Produit :
  - `UserDataSnapshot = { formatVersion: 1; exportedAt: string; userId: string; profile: …; intermediaries: …[]; contacts: …[]; endClients: …[]; jobApplications: …[]; activityLogEntries: …[]; interviews: …[]; jobSpecs: (… & { pdfBase64: string | null })[]; alertSnoozes: …[] }`, avec les lignes brutes des tables, typées depuis `Database`
  - `buildUserDataSnapshot(supabase: SupabaseClient<Database>, userId: string): Promise<UserDataSnapshot>`
  - `restoreUserDataSnapshot(supabase: SupabaseClient<Database>, snapshot: UserDataSnapshot): Promise<void>` : upsert de toutes les tables dans l'ordre des dépendances, puis remise des PDF dans le stockage
  - le cron `"0 3 * * 1,4"` (lundi et jeudi à 3h UTC), ce qui maintient aussi l'activité du projet Supabase gratuit

- [ ] **Step 1 : Écrire les tests qui échouent**
  - **Intégration** :
    - le snapshot d'un utilisateur ne contient **aucune** donnée d'un autre utilisateur ;
    - le profil du snapshot n'a ni `encrypted_anthropic_api_key` ni `anthropic_api_key_last_four` ;
    - **aller-retour** : après `buildUserDataSnapshot`, suppression de toutes les lignes de l'utilisateur, puis `restoreUserDataSnapshot`, un nouveau `buildUserDataSnapshot` donne le même résultat, `exportedAt` mis à part, et le PDF est identique octet pour octet.
  - **Route cron** :
    - sans en-tête `Authorization: Bearer <CRON_SECRET>`, la réponse est `401` ;
    - avec l'en-tête, la route appelle `uploadBackupToGcs` une fois par utilisateur, avec la clé `backups/<YYYY-MM-DD>/<userId>.json` ;
    - l'échec d'un utilisateur n'empêche pas la sauvegarde des autres, et un `console.error` est émis pour l'utilisateur en échec.
- [ ] **Step 2 :** `npm run test:integration`, puis `npm test -- cron/backup`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter :
  - `/api/export` utilise le client lié à la session (RLS) et répond avec `Content-Disposition: attachment; filename="freeclutch-export-<YYYY-MM-DD>.json"` ;
  - le cron utilise le client service role et `@google-cloud/storage`, authentifié par la clé du compte de service (JSON encodé en base64 dans `GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64`) ;
  - `scripts/restore-backup.ts` prend en argument un chemin de fichier JSON et utilise le client service role (lancé avec `npx tsx scripts/restore-backup.ts <fichier>`).
- [ ] **Step 4 :** Relancer les commandes. Attendu : PASS. Vérification manuelle : le bouton « Exporter mes données » télécharge le fichier.
- [ ] **Step 5 :** Commit `feat(backup): add user data export, scheduled gcs backups and restore script`.

---

### Task 17 : Vérification finale et mise en ligne

**Files :**
- Modify : `README.md` (section « Déploiement »)

- [ ] **Step 1 :** `npm run lint && npm run typecheck && npm test && npm run test:tz && npm run test:integration`. Attendu : tout passe, sans avertissement `no-console` ni `no-explicit-any`.
- [ ] **Step 2 :** `grep -rn "console.log\|: any\|as any\|export default" src/`. Attendu : aucun `console.log` ni `any` ; les seuls `export default` sont dans des fichiers `page.tsx`, `layout.tsx` et `route.ts`.
- [ ] **Step 3 :** `npm run build`. Attendu : le build réussit, et aucune variable d'environnement serveur n'apparaît dans `.next/static` (`grep -r "SUPABASE_SERVICE_ROLE\|API_KEY_ENCRYPTION" .next/static` ne renvoie rien).
- [ ] **Step 4 :** Documenter dans le README la mise en ligne, que le porteur du projet fait lui-même : créer le projet Supabase (formule gratuite), `supabase db push`, désactiver les inscriptions, créer dans GCP un bucket `europe-west9` (Paris) avec une règle de cycle de vie qui supprime les objets après 90 jours, et un compte de service qui a pour seul rôle `roles/storage.objectCreator` sur ce bucket, puis encoder sa clé JSON en base64 ; créer le projet Vercel avec les variables d'environnement et l'URL de redirection Auth, puis inviter le premier utilisateur.
- [ ] **Step 5 :** Commit `docs: add deployment guide`.
