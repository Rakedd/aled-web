# Contacts et agences (web + base) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page Contacts triable, des fiches contact et agence, des échanges notés sans candidature, et un champ contact sans ressaisie dans la candidature, sur l'app web et la base Supabase.

**Architecture:** une migration additive étend `contacts` et `activity_log_entries` (journal unique). Elle ajoute trois vues `security_invoker` (`exchanges_overview`, `contacts_overview`, `intermediaries_overview`) qui calculent « contact effectif », « dernier échange » et les compteurs en SQL. Le web et le mobile lisent donc la même vérité. Côté Next.js : des repositories par entité, des server actions avec `runAuthenticatedOperation`, des pages serveur, et des composants client avec `useController`.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), React 19, Supabase (Postgres, RLS, `@supabase/ssr`), Tailwind 4 + shadcn (`base-nova`), Jest 30 + Testing Library, intégration sur Supabase local.

**Spec:** `docs/superpowers/specs/2026-10-22-aled-contacts-agences-design.md`. Le plan mobile qui suit est `docs/superpowers/plans/2026-10-22-aled-contacts-agences-mobile.md` ; il dépend des tâches 1 et 2 de ce plan.

## Global Constraints

- CLAUDE.md du porteur : fonctions fléchées uniquement, `export const` (sauf `page.tsx`/`layout.tsx`, qui gardent `export default`), jamais de `any`, aucun `console.log`, pas de commentaire sauf logique vraiment complexe, noms longs et explicites, aucun import ou variable inutilisé.
- Composant = dossier kebab-case contenant `<nom>.tsx`, `interfaces.ts`, `index.ts` (`export * from './<nom>'`), et `controller.tsx` (`useController`) dès que le composant a de la logique. Tests à côté : `<nom>.test.tsx` et `controller.test.tsx`.
- AGENTS.md : lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire une page, une route ou du code de navigation (Next 16 : `PageProps<'/route'>`, `notFound()`, `redirect()`).
- Textes d'interface en français, tutoiement, comme le reste de l'app.
- Messages réutilisés tels quels : « Un autre contact porte déjà ce nom » (`CONTACT_NAME_ALREADY_TAKEN_MESSAGE`), `ACTIVITY_LOG_VALIDATION_MESSAGES`, `ENTITY_NOT_FOUND_MESSAGES`.
- Limites : notes de contact 10 000 caractères, « Recommandé par » 200 caractères, noms 200 (`MAXIMUM_ENTITY_NAME_LENGTH`), téléphone 50 (`MAXIMUM_PHONE_LENGTH`).
- Les fichiers de `src/domain/` et `src/server/supabase/database-types.ts` sont recopiés **à l'identique** dans `aled-mobile` (plan mobile). Ils ne doivent donc rien importer de `@/server` ni de `server-only`.
- Git : committer sur la branche courante, sans créer ni changer de branche, et **jamais de `git push`**. Messages de commit sans aucune ligne `Co-Authored-By` ni mention d'outil d'IA. N'ajouter que les fichiers de la tâche (`git add <chemins>`), jamais `git add -A`.
- Commandes : `npm test -- <motif>`, `npm run typecheck`, `npm run lint`. Intégration : `npx supabase start`, puis `npx supabase db reset`, puis `npm run test:integration -- <motif>`.

## Review Focus

1. **Recherche par téléphone sur des formats variés** (`+33 6 12 34 56 78`, `06.12.34.56.78`, `0033612345678`, ou un bout comme `3456`) : la personne s'attend à retrouver le contact. Test dans la tâche 2.
2. **Contact sans échange, sans candidature ou sans agence** : affiché avec « — » et `0`, et toujours rangé en dernier quel que soit le sens du tri. Tests dans les tâches 2 et 6.
3. **Renommer un contact en un nom qui ne diffère d'un autre que par les accents ou la casse** (« Jérôme » / « jerome ») : refus avec « Un autre contact porte déjà ce nom ». Changer seulement la casse de son propre nom reste accepté. Test dans la tâche 4.
4. **Échange noté depuis une fiche contact avec une candidature qui n'est pas la sienne** (identifiant falsifié ou appartenant à un autre contact) : refus, rien n'est écrit. Test dans la tâche 4.
5. **E-mail extrait par l'IA d'une annonce, pour un contact qui a déjà un e-mail** : l'e-mail existant est conservé. Tests dans les tâches 2 et 3.

---

### Task 1: Migration, vues et types

**Files:**
- Create: `supabase/migrations/20261022000000_contacts_and_agencies.sql`
- Modify: `src/server/supabase/database-types.ts` (régénéré avec `npm run db:types`)
- Create: `tests/integration/contacts-schema.test.ts`

**Interfaces:**
- Produces, pour toutes les tâches suivantes et le plan mobile :
  - colonnes `contacts.notes text`, `contacts.referred_by text` ; `activity_log_entries.job_application_id` devient nullable ; `activity_log_entries.contact_id uuid` ;
  - contrainte `activity_log_entries_target_check : job_application_id is not null or contact_id is not null` ;
  - vue `exchanges_overview`, colonnes : `id, user_id, occurred_at, created_at, kind, summary, job_application_id, job_application_title, effective_contact_id, contact_name, contact_intermediary_id, job_application_intermediary_id`. Elle contient seulement `kind <> 'status_change'` ;
  - vue `contacts_overview` : toutes les colonnes de `contacts`, plus `intermediary_name, last_exchange_at, proposed_mission_count` ;
  - vue `intermediaries_overview` : `id, user_id, name, kind, created_at, contact_count, proposed_mission_count, last_exchange_at` ;
  - fonction `public.delete_contact(target_contact_id uuid) returns boolean` ;
  - fonction `public.assign_missing_contact_intermediaries() returns void`.

- [ ] **Step 1: Write the failing integration tests** in `tests/integration/contacts-schema.test.ts`. Use `createSignedInTestClient` and `createJobApplicationOrFail`, like `delete-job-application.test.ts` does.
  - `it('accepts an exchange linked only to a contact')`: insert into `activity_log_entries` `{ contact_id, job_application_id: null, kind: 'call', summary: 'Appel' }` → no error.
  - `it('rejects an exchange linked to neither a contact nor a job application')`: same insert with `contact_id: null` → `error.code === '23514'`.
  - `it('rejects an exchange pointing at another user contact')`: user B inserts with user A's `contact_id` → error (FK `23503` or RLS).
  - `it('keeps contact exchanges and deletes the others when a job application is deleted')`: candidature J with an entry `{ job_application_id: J, contact_id: C }` and an entry `{ job_application_id: J, contact_id: null }`. Delete J. The first remains with `job_application_id === null`, and the second no longer exists.
  - `it('deletes standalone exchanges and detaches linked ones when deleting a contact')`: entries `{ contact_id: C, job_application_id: null }` and `{ contact_id: C, job_application_id: J }`. `rpc('delete_contact', { target_contact_id: C })` returns `true`. The first entry is deleted, and the second remains with `contact_id === null`. `job_applications.contact_id` is null.
  - `it('returns false when deleting a contact of another user')`.
  - `it('computes the effective contact of an exchange')`: entry `{ job_application_id: J }` without `contact_id`, where J has contact C. `exchanges_overview.effective_contact_id === C`, `job_application_title` = J's title, and `status_change` entries are absent.
  - `it('exposes last exchange and proposed mission count per contact')`: `contacts_overview` gives `last_exchange_at` = latest `occurred_at`, and `proposed_mission_count` = number of candidatures. A contact with neither gives `null` and `0`.
  - `it('counts contacts, missions and exchanges per intermediary')`: `intermediaries_overview.contact_count`, `proposed_mission_count`, and `last_exchange_at` are computed through the contact's agency **or** the candidature's agency.
  - `it('assigns the agency of the most recent job application to contacts without one')`: contact C without an agency, an old candidature with agency A1 and a recent one with A2. After `rpc('assign_missing_contact_intermediaries')`, C has A2. A contact that already has an agency keeps it.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx supabase db reset && npm run test:integration -- contacts-schema`
Expected: FAIL (missing column / view / function)

- [ ] **Step 3: Write the migration**

The migration contains:
- `alter table public.contacts add column notes text, add column referred_by text;`
- `alter table public.activity_log_entries alter column job_application_id drop not null, add column contact_id uuid, add constraint activity_log_entries_target_check check (job_application_id is not null or contact_id is not null), add foreign key (user_id, contact_id) references public.contacts (user_id, id) on delete set null (contact_id);`
- `create index activity_log_entries_contact_id_occurred_at_index on public.activity_log_entries (contact_id, occurred_at desc);`
- a trigger function `public.detach_contact_exchanges_from_job_application()`, called `before delete` on `public.job_applications`. It runs `update public.activity_log_entries set job_application_id = null where job_application_id = old.id and contact_id is not null`. The existing cascade deletes the rest.
- `public.delete_contact(target_contact_id uuid) returns boolean`, `security invoker`. It deletes the contact's entries where `job_application_id is null`, then the contact, and returns whether a row was deleted. The function body runs in a single transaction.
- `public.assign_missing_contact_intermediaries()`, `security invoker`. It sets `contacts.intermediary_id` from the candidature with the latest `applied_on desc, created_at desc` that has a non-null `intermediary_id`, only for contacts where `intermediary_id is null`. The migration calls it once at the end.
- the three views, `with (security_invoker = true)` like `job_applications_overview`:
  - `exchanges_overview`: `activity_log_entries` left join `job_applications`, then left join `contacts` on `coalesce(entry.contact_id, job_application.contact_id)`. Filter `entry.kind <> 'status_change'`.
  - `contacts_overview`: `contacts` left join `intermediaries`. `last_exchange_at` = `max(occurred_at)` from `exchanges_overview` where `effective_contact_id = contact.id`. `proposed_mission_count` = `count(*)` of `job_applications` where `contact_id = contact.id`.
  - `intermediaries_overview`: `contact_count` (contacts where `intermediary_id = id`), `proposed_mission_count` (candidatures where `intermediary_id = id`), and `last_exchange_at` (max over `exchanges_overview` where `contact_intermediary_id = id or job_application_intermediary_id = id`).
- every function: `set search_path = ''` and fully qualified names (`public.`).

- [ ] **Step 4: Apply, regenerate the types, and run the tests**

Run: `npx supabase db reset && npm run db:types && npm run test:integration -- contacts-schema`
Expected: PASS

- [ ] **Step 5: Fix the compilation broken by the nullable `job_application_id`**

In `src/server/repositories/activity-log-repository.ts`, `listActivityLogEntriesForJobApplication` maps `jobApplicationId: activityLogEntryRow.job_application_id ?? jobApplicationId`. The query already filters on that candidature.

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261022000000_contacts_and_agencies.sql src/server/supabase/database-types.ts src/server/repositories/activity-log-repository.ts tests/integration/contacts-schema.test.ts
git commit -m "feat(contacts): extend schema for contacts, standalone exchanges and agency views"
```

---

### Task 2: Domaine partagé — types, validation, recherche, tri, fusion des coordonnées

**Files:**
- Create: `src/domain/contacts.ts`, `src/domain/contacts.test.ts`
- Create: `src/domain/contact-search.ts`, `src/domain/contact-search.test.ts`
- Modify: `src/domain/entities.ts` (export `CONTACT_NAME_ALREADY_TAKEN_MESSAGE`; `EntitySuggestion` gains `contactDetails`)
- Modify: `src/domain/routes.ts`, `src/domain/routes.test.ts`

**Interfaces:**
- Produces, in `src/domain/contacts.ts`:
  - `type ContactDetailFieldName = 'phone' | 'email' | 'linkedinUrl'`
  - `type ContactDetailValues = Pick<ContactDetails, ContactDetailFieldName>`
  - `type ContactListItem = { id: string; fullName: string; intermediaryId: string | null; intermediaryName: string | null; phone: string | null; email: string | null; linkedinUrl: string | null; lastExchangeAt: Date | null; proposedMissionCount: number }`
  - `type IntermediaryListItem = { id: string; name: string; kind: IntermediaryKind | null; contactCount: number; proposedMissionCount: number; lastExchangeAt: Date | null }`
  - `type ContactProfile = ContactDetails & { intermediaryId: string | null; intermediaryName: string | null; referredBy: string | null; notes: string | null }`
  - `type ContactProfileInput = { fullName: string; phone: string | null; email: string | null; linkedinUrl: string | null; intermediaryName: string | null; referredBy: string | null; notes: string | null }`
  - `type Exchange = { id: string; occurredAt: Date; kind: ActivityKind; summary: string; jobApplicationId: string | null; jobApplicationTitle: string | null; contactId: string | null; contactName: string | null }`
  - `type ProposedMission = { jobApplicationId: string; title: string; appliedOn: Date; endClientLabel: string | null; contactName: string | null; status: JobApplicationStatus }`
  - `type ContactExchangeInput = ActivityLogEntryInput & { jobApplicationId: string | null }`
  - `type ContactPageData = { profile: ContactProfile; proposedMissions: ProposedMission[]; exchanges: Exchange[] }`
  - `type IntermediaryPageData = { intermediary: IntermediaryListItem; contacts: ContactListItem[]; exchanges: Exchange[]; proposedMissions: ProposedMission[] }`
  - `MAXIMUM_CONTACT_NOTES_LENGTH = 10_000`, `MAXIMUM_REFERRED_BY_LENGTH = 200`
  - `CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE = "Cette candidature n'est pas liée à ce contact"`
  - `validateContactProfileInput(candidate: unknown): ActionResult<ContactProfileInput>`. It reuses `validateContactDetailsInput`, then `validateOptionalEntityName` for `intermediaryName`, then `validateOptionalText` for `referredBy` and `notes`.
  - `validateContactExchangeInput(candidate: unknown, now: Date): ActionResult<ContactExchangeInput>`. It reuses `validateActivityLogEntryInput` and accepts `jobApplicationId` null or a UUID (`validateUuid`).
  - `validateUserEditedContactFields(candidate: unknown): ActionResult<ContactDetailFieldName[]>`, which accepts only an array of those three names.
  - `mergeContactDetailValues(currentValues: ContactDetailValues, submittedValues: ContactDetailValues, userEditedFields: readonly ContactDetailFieldName[]): Partial<ContactDetailValues>`. The rule for each field: if the submitted value is null, skip it; if the field is in `userEditedFields`, take the submitted value; otherwise take it only if the current value is null.
- Produces, in `src/domain/contact-search.ts`:
  - `type SortDirection = 'asc' | 'desc'`, `type ListSort<SortKey extends string> = { key: SortKey; direction: SortDirection }`
  - `type ContactsSortKey = 'fullName' | 'intermediaryName' | 'lastExchangeAt' | 'proposedMissionCount'`
  - `type IntermediariesSortKey = 'name' | 'contactCount' | 'proposedMissionCount' | 'lastExchangeAt'`
  - `INITIAL_CONTACTS_SORT: ListSort<ContactsSortKey> = { key: 'lastExchangeAt', direction: 'desc' }`, `INITIAL_INTERMEDIARIES_SORT: ListSort<IntermediariesSortKey> = { key: 'lastExchangeAt', direction: 'desc' }`
  - `toggleListSort<SortKey extends string>(currentSort: ListSort<SortKey>, clickedKey: SortKey): ListSort<SortKey>`. A new column sorts ascending, and a second click on the same column reverses it, like `job-applications-table`.
  - `normalizePhoneNumberForSearch(phoneNumber: string): string`. Keep digits only, then turn a leading `33` (coming from `+33`) or `0033` into `0`.
  - `filterContacts(contacts: ContactListItem[], query: string): ContactListItem[]`. A blank query returns everything. Otherwise a contact matches if `normalizeEntityName(fullName)` or `normalizeEntityName(intermediaryName)` contains `normalizeEntityName(query)`. It also matches if the query has at least 3 digits and the contact's normalized phone contains the query's normalized digits.
  - `sortContacts(contacts: ContactListItem[], sort: ListSort<ContactsSortKey>): ContactListItem[]`, `filterIntermediaries(intermediaries: IntermediaryListItem[], query: string): IntermediaryListItem[]` (name only), `sortIntermediaries(intermediaries: IntermediaryListItem[], sort: ListSort<IntermediariesSortKey>): IntermediaryListItem[]`. Texts use `localeCompare(…, 'fr', { sensitivity: 'base' })`. **`null` values always go last, whatever the direction.**
- `EntitySuggestion` becomes `{ id: string; name: string; label: string; parentName: string | null; contactDetails: ContactDetailValues | null }`. Update every place that builds it (`entities-repository.ts`, tests).
- Produces, in `routes.ts`: `CONTACTS_ROUTE = '/contacts'`, `contactRoute(contactId: string): string` (`/contacts/{id}`), `INTERMEDIARIES_ROUTE = '/agences'`, `intermediaryRoute(intermediaryId: string): string` (`/agences/{id}`), `CONTACTS_VIEW_SEARCH_PARAMETER = 'vue'`, `INTERMEDIARIES_VIEW = 'agences'`, `INTERMEDIARIES_LIST_ROUTE = '/contacts?vue=agences'`.

- [ ] **Step 1: Write the failing tests**
  - `contact-search.test.ts`:
    - `it.each(['+33 6 12 34 56 78', '06.12.34.56.78', '0033612345678', '06-12-34-56-78'])('normalizes %s to 0612345678')`;
    - `it('finds a contact by a fragment of its phone number')` (query `'3456'`);
    - `it('ignores phone matching for queries with fewer than three digits')`;
    - `it('finds a contact by agency name, ignoring accents and case')` (`'societe'` finds intermediaryName `'Société Générale'`);
    - `it('sorts by last exchange descending and keeps contacts without exchange last')`, plus the same test in the `asc` direction;
    - `it('toggles a new sort key ascending then descending')`.
  - `contacts.test.ts`:
    - `it('keeps the stored email when the submitted one comes from the AI')`: `mergeContactDetailValues({ email: 'old@x.fr', phone: null, linkedinUrl: null }, { email: 'new@x.fr', phone: '06', linkedinUrl: null }, [])` → `{ phone: '06' }`;
    - `it('overwrites a field edited by the user')`: same values with `['email']` → `{ email: 'new@x.fr', phone: '06' }`;
    - `it('never clears a field from an empty submission')`;
    - `it('rejects referredBy longer than 200 characters')`;
    - `it('rejects notes longer than 10000 characters')`;
    - `it('accepts an exchange without job application and rejects a malformed job application id')`;
    - `it.each([['phone'], ['email', 'linkedinUrl'], []])('accepts edited fields %p')`, and rejects `['fullName']` or a non-array value.
  - `routes.test.ts`: `contactRoute('c1') === '/contacts/c1'`, `intermediaryRoute('i1') === '/agences/i1'`.

- [ ] **Step 2: Run and confirm failure** — `npm test -- contact-search contacts routes` → FAIL
- [ ] **Step 3: Implement** the files and signatures above. Move `CONTACT_NAME_ALREADY_TAKEN_MESSAGE` from `entities-repository.ts` into `entities.ts`, as an export.
- [ ] **Step 4: Run** — `npm test -- contact-search contacts routes entities && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git add src/domain/contacts.ts src/domain/contacts.test.ts src/domain/contact-search.ts src/domain/contact-search.test.ts src/domain/entities.ts src/domain/routes.ts src/domain/routes.test.ts src/server/repositories/entities-repository.ts` then `git commit -m "feat(contacts): add shared contact domain, search and sorting rules"`

---

### Task 3: Candidature — coordonnées sans ressaisie et rattachement à l'agence

**Files:**
- Modify: `src/domain/job-application.ts`, `src/domain/job-application.test.ts`
- Modify: `src/domain/opportunities.ts`, `src/domain/opportunities.test.ts`
- Modify: `src/server/repositories/entities-repository.ts`
- Modify: `src/server/repositories/job-applications-repository.ts`, `src/server/repositories/job-applications-repository.test.ts`
- Modify: `tests/integration/job-application-fixtures.ts`, `tests/integration/job-applications.test.ts`, `src/server/actions/job-application-actions.test.ts`

**Interfaces:**
- Consumes: `mergeContactDetailValues`, `validateUserEditedContactFields`, `ContactDetailFieldName` (task 2).
- Produces:
  - `JobApplicationInput` gains `contactLinkedinUrl: string | null` (validated with `validateOptionalUrl`, protocol `https:`, message `ENTITY_VALIDATION_MESSAGES.invalidLinkedinUrl`) and `userEditedContactFields: ContactDetailFieldName[]`;
  - `resolveIntermediaryId` is exported from `entities-repository.ts`, with an unchanged signature;
  - `assignContactIntermediaryIfMissing(supabase: FreeclutchSupabaseClient, userId: string, contactId: string, intermediaryId: string): Promise<void>`, exported from `entities-repository.ts`. It does an `update contacts set intermediary_id` where `id`, `user_id`, and `intermediary_id is null`.

- [ ] **Step 1: Write the failing tests**
  - `job-application.test.ts`: `it('rejects a non-https contact LinkedIn url')`, `it('rejects unknown user edited contact fields')`.
  - `tests/integration/job-applications.test.ts`:
    - `it('keeps the existing contact email when an AI-prefilled email is submitted')`;
    - `it('overwrites the contact phone the user edited')`;
    - `it('saves the contact LinkedIn url at creation')`;
    - `it('gives the job application agency to a contact without one')`;
    - `it('keeps the agency of a contact that already has a different one')`.
- [ ] **Step 2: Run** — `npm test -- job-application && npm run test:integration -- job-applications` → FAIL
- [ ] **Step 3: Implement**
  - `JOB_APPLICATION_FIELD_VALIDATORS` gains the two new fields. `JobApplicationEntityNames` includes `contactLinkedinUrl` and `userEditedContactFields`.
  - `resolveContactId(supabase, userId, contactName, submittedContactDetails: ContactDetailValues, userEditedFields: readonly ContactDetailFieldName[]): Promise<string>`. It upserts by name as today, reads the current `phone, email, linkedin_url`, and writes `mergeContactDetailValues(...)` only if the result is non-empty. Delete `fillEmptyContactField`.
  - The contact is linked by name. This is equivalent to linking by id, because `(user_id, normalized_name)` is unique and choosing a suggestion fills in the contact's exact name.
  - `insertJobApplication` and `updateJobApplicationRow`: after resolution, when both a contact and an agency are known, call `assignContactIntermediaryIfMissing`. For an update, the contact is the resolved one or else `currentOverview.contactId`, and the agency is the resolved one or else `currentOverview.intermediaryId`. `completeEntityNamesFromCurrentValues` passes `contactLinkedinUrl` and `userEditedContactFields`, and also treats an update of `contactLinkedinUrl` alone as an update of details only.
  - `buildJobApplicationInputFromOpportunity` (`opportunities.ts`) sets `contactLinkedinUrl: null, userEditedContactFields: []`, as do the fixtures and the existing tests.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run test:integration -- job-applications` → PASS
- [ ] **Step 5: Commit** — the files listed above, with `git commit -m "feat(contacts): stop retyping contact details and attach contacts to their agency"`

---

### Task 4: Repositories contacts, agences, échanges, missions proposées

**Files:**
- Create: `src/server/repositories/contacts-repository.ts`, `src/server/repositories/intermediaries-repository.ts`, `src/server/repositories/exchanges-repository.ts`
- Modify: `src/server/repositories/job-applications-repository.ts` (missions proposées), `src/server/repositories/entities-repository.ts` (contact suggestions)
- Create: `tests/integration/contacts.test.ts`

**Interfaces:**
- Consumes: the task 1 views and functions, the task 2 types, and `resolveIntermediaryId` (task 3).
- Produces (each takes `supabase: FreeclutchSupabaseClient, userId: string` first):
  - `contacts-repository.ts`:
    - `listContactListItems(): Promise<ContactListItem[]>`;
    - `listContactListItemsForIntermediary(intermediaryId: string): Promise<ContactListItem[]>`;
    - `findContactProfile(contactId: string): Promise<ActionResult<ContactProfile>>`;
    - `insertContact(input: ContactProfileInput): Promise<ActionResult<{ id: string }>>`;
    - `saveContactProfile(contactId: string, input: ContactProfileInput): Promise<ActionResult<null>>`;
    - `deleteContactRow(contactId: string): Promise<boolean>` (via `rpc('delete_contact')`);
    - a pure, exported mapping helper `toContactListItem(contactsOverviewRow)`.
  - `intermediaries-repository.ts`: `listIntermediaryListItems(): Promise<IntermediaryListItem[]>`, `findIntermediaryListItem(intermediaryId: string): Promise<ActionResult<IntermediaryListItem>>`, and the exported mapping helper `toIntermediaryListItem(row)`.
  - `exchanges-repository.ts`:
    - `listExchangesForContact(contactId: string): Promise<Exchange[]>`;
    - `listExchangesForIntermediary(intermediaryId: string): Promise<Exchange[]>` (`.or('contact_intermediary_id.eq.{id},job_application_intermediary_id.eq.{id}')`);
    - `recordContactExchange(contactId: string, input: ContactExchangeInput): Promise<ActionResult<null>>`;
    - `toExchange(row)`.
    - Order: `occurred_at desc, created_at desc`.
  - `job-applications-repository.ts`: `listProposedMissionsForContact(contactId: string): Promise<ProposedMission[]>`, `listProposedMissionsForIntermediary(intermediaryId: string): Promise<ProposedMission[]>`, sorted `applied_on desc, created_at desc`. `endClientLabel` uses `formatEndClientLabel`.
  - The contact suggestions in `entities-repository.ts` select `id, full_name, phone, email, linkedin_url, intermediaries(name)`. `label` = `"{full_name} · {intermediary name}"` (or just the name when there is no agency), and `contactDetails` is filled. The other searchers set `contactDetails: null`.

- [ ] **Step 1: Write the failing integration tests** in `tests/integration/contacts.test.ts`:
  - `it('creates a contact with its agency created on the fly')`;
  - `it('refuses to rename a contact to a name differing only by accents from another contact')` → `CONTACT_NAME_ALREADY_TAKEN_MESSAGE`;
  - `it('lets a contact change the case of its own name')`;
  - `it('lists exchanges of a contact including those of its job applications')`;
  - `it('lists exchanges of an agency through contacts and job applications')`;
  - `it('records an exchange without job application')`;
  - `it('refuses an exchange with a job application of another contact')` → `CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE`, nothing inserted;
  - `it('clears todo snoozes when an exchange is recorded on a job application')`, the same behavior as `recordActivityLogEntry`, using `findAlertKindsClearedByActivity` and `deleteAlertSnoozesForJobApplication`;
  - `it('returns not found for a contact or agency of another user')`;
  - `it('suggests contacts with their agency and details')`.
- [ ] **Step 2: Run** — `npm run test:integration -- contacts` → FAIL
- [ ] **Step 3: Implement**. Behavior details:
  - `insertContact` and `saveContactProfile` map unique violation `23505` to `CONTACT_NAME_ALREADY_TAKEN_MESSAGE`, and resolve `intermediaryName` with `resolveIntermediaryId` (null → `intermediary_id: null`);
  - `findContactProfile` returns `ENTITY_NOT_FOUND_MESSAGES.contact` when the contact is missing;
  - `recordContactExchange` checks, when `jobApplicationId` is not null, that `job_applications` has `id = jobApplicationId and contact_id = contactId and user_id = userId` before inserting.
- [ ] **Step 4: Run** — `npm run test:integration -- contacts && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add contacts, agencies and exchanges repositories"` (the listed files only)

---

### Task 5: Server actions

**Files:**
- Create: `src/server/actions/contact-actions.ts`, `src/server/actions/contact-actions.test.ts`

**Interfaces:**
- Consumes: task 4.
- Produces (`'use server'`, `runAuthenticatedOperation`, ids validated with `validateUuid`):
  - `listContacts(): Promise<ActionResult<ContactListItem[]>>`
  - `listIntermediaries(): Promise<ActionResult<IntermediaryListItem[]>>`
  - `getContactPage(contactId: string): Promise<ActionResult<ContactPageData>>`: profile, then missions and exchanges in parallel (`Promise.all`)
  - `getIntermediaryPage(intermediaryId: string): Promise<ActionResult<IntermediaryPageData>>`
  - `createContact(input: ContactProfileInput): Promise<ActionResult<{ id: string }>>`
  - `updateContactProfile(contactId: string, input: ContactProfileInput): Promise<ActionResult<null>>`
  - `deleteContact(contactId: string): Promise<ActionResult<null>>` (`false` → `ENTITY_NOT_FOUND_MESSAGES.contact`)
  - `addContactExchange(contactId: string, input: ContactExchangeInput): Promise<ActionResult<null>>`
  - Failure messages: the same constants as `entity-actions.ts` (« Impossible de charger… », « Impossible d'enregistrer… »).

- [ ] **Step 1: Write the failing tests**, mocking the repositories as `entity-actions.test.ts` does:
  - `it('rejects a malformed contact id without touching the database')`;
  - `it('rejects an invalid profile input')`;
  - `it('reports not found when deleting an unknown contact')`;
  - `it('loads the contact page data in one result')`.
- [ ] **Step 2: Run** — `npm test -- contact-actions` → FAIL
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** — `npm test -- contact-actions && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): expose contact server actions"`

---

### Task 6: Navigation et page Contacts (onglets Contacts et Agences)

**Files:**
- Modify: `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/app-shell.test.tsx`
- Modify: `src/domain/landing-routing.ts`, `src/domain/landing-routing.test.ts`
- Create: `src/app/(app)/contacts/page.tsx`, `src/app/(app)/agences/page.tsx` (redirects to `INTERMEDIARIES_LIST_ROUTE`)
- Create: `src/components/contacts-table/` (with controller), `src/components/intermediaries-table/` (with controller), `src/components/new-contact-form/` (with controller)

**Interfaces:**
- Consumes: `listContacts`, `listIntermediaries`, `createContact` (task 5); `filterContacts`, `sortContacts`, `toggleListSort`, `INITIAL_*_SORT` (task 2); routes (task 2); `searchEntities` (existing, for the agency in the new contact form).
- Produces:
  - `ContactsTableProps = { contacts: ContactListItem[] }`;
  - the `contacts-table` `useController({ contacts })` returns `{ query, setQuery, sort, toggleSort, visibleContacts }`;
  - `IntermediariesTableProps = { intermediaries: IntermediaryListItem[] }`, same pattern;
  - `NewContactFormProps = { createContact: (input: ContactProfileInput) => Promise<ActionResult<{ id: string }>>; searchEntities: SearchEntities }`. On success, it navigates to `contactRoute(id)`.

- [ ] **Step 1: Write the failing tests**
  - `app-shell.test.tsx`: `it('links to Mes contacts between Mes candidatures and Mon calendrier')`.
  - `landing-routing.test.ts`: `/contacts` and `/agences/x` are treated as app paths on the landing domain.
  - `contacts-table/controller.test.tsx`:
    - `it('sorts by last exchange descending at first')`;
    - `it('filters by phone fragment')`;
    - `it('keeps contacts without exchange last after reversing the sort')`.
  - `contacts-table.test.tsx`:
    - `it('shows a dash and zero for a contact without exchange nor mission')`;
    - `it('links the name to the contact page and the agency to the agency page')`;
    - `it('explains how to add contacts when the list is empty')`.
  - `intermediaries-table`: the same pattern (initial sort, search by name, links).
  - `new-contact-form/controller.test.tsx`:
    - `it('requires a name')`;
    - `it('navigates to the new contact page on success')`;
    - `it('shows the duplicate name message')`.
- [ ] **Step 2: Run** — `npm test -- app-shell landing-routing contacts-table intermediaries-table new-contact-form` → FAIL
- [ ] **Step 3: Implement**
  - Navigation: label `Mes contacts`, `href: CONTACTS_ROUTE`, active for `/contacts` and `/agences`.
  - `APP_PATH_PREFIXES` gains `CONTACTS_ROUTE` and `INTERMEDIARIES_ROUTE`.
  - Page `/contacts`: `metadata.title = 'Mes contacts · Aled'`, title `Mes contacts`, a `+ Nouveau contact` button that opens `NewContactForm`, `pill-tabs` « Contacts » / « Agences » driven by `?vue=agences`, and the error message on load failure.
  - Tables: the visual model is `job-applications-table` (`overflow-x-auto`); dates use the app's existing format; `tel:` links.
  - Empty state (contacts): « Aucun contact pour l'instant. Ajoute-en un ici ou depuis une candidature. »
  - Columns and sorting as in spec §4.2 and §4.3.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add Mes contacts page with contacts and agencies tabs"`

---

### Task 7: Fiche contact

**Files:**
- Create: `src/app/(app)/contacts/[contactId]/page.tsx`
- Create: `src/components/contact-profile-view/`, `src/components/contact-profile-form/` (with controller; `EditableBlock`/`useBlockForm` pattern like `contact-edit-form`)
- Create: `src/components/proposed-missions-list/` (shared with the agency page)
- Create: `src/components/exchanges-section/` (with controller: list, plus a « Noter un échange » form when `addContactExchange` is provided)
- Create: `src/components/delete-contact-button/` (with controller, `AlertDialog` like `delete-job-application-button`)

**Interfaces:**
- Consumes: `getContactPage`, `updateContactProfile`, `addContactExchange`, `deleteContact` (task 5); `searchEntities`; routes.
- Produces:
  - `ProposedMissionsListProps = { proposedMissions: ProposedMission[]; showsContactName: boolean }`;
  - `ExchangesSectionProps = { exchanges: Exchange[]; showsContactName: boolean; exchangeForm: { contactId: string; jobApplicationOptions: { id: string; title: string }[]; addContactExchange: AddContactExchange; now: Date } | null }`;
  - `AddContactExchange = (contactId: string, input: ContactExchangeInput) => Promise<ActionResult<null>>`;
  - after any save, the components call `router.refresh()`, like the candidature blocks do.

- [ ] **Step 1: Write the failing tests**
  - `contact-profile-form/controller.test.tsx`:
    - `it('saves all profile fields')`;
    - `it('clears a field emptied by the user')` (spec §4.4: clearing erases on the contact page);
    - `it('shows the duplicate name message')`.
  - `contact-profile-view.test.tsx`: `it('shows call, email and LinkedIn actions only when the information exists')`.
  - `exchanges-section/controller.test.tsx`:
    - `it('defaults to a call happening now')`;
    - `it('requires a summary')`;
    - `it('sends the chosen job application')`;
    - `it('sends null when no job application is chosen')`.
  - `exchanges-section.test.tsx`:
    - `it('links an exchange to its job application')`;
    - `it('hides the form when exchangeForm is null')`.
  - `delete-contact-button.test.tsx`: `it('explains that exchanges without job application are deleted and the others are kept')`. Exact text: « Ses échanges sans candidature seront supprimés. Ceux liés à une candidature restent dans le journal de la candidature. »
  - `proposed-missions-list.test.tsx`: `it('shows date, title, client, status and a link per mission')`.
- [ ] **Step 2: Run** — `npm test -- contact-profile exchanges-section delete-contact-button proposed-missions-list` → FAIL
- [ ] **Step 3: Implement**
  - The page calls `getContactPage`. On `ENTITY_NOT_FOUND_MESSAGES.contact` or an invalid id, it calls `notFound()`.
  - Layout from top to bottom, as in spec §4.4.
  - `metadata` via `generateMetadata`: `'{fullName} · Aled'`.
  - After deletion: `router.replace(CONTACTS_ROUTE)`.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add contact page with profile, missions and exchanges"`

---

### Task 8: Fiche agence

**Files:**
- Create: `src/app/(app)/agences/[intermediaryId]/page.tsx`
- Create: `src/components/intermediary-header/` (summary and kind change, reusing `updateIntermediaryKind`)
- Create: `src/components/intermediary-contacts-list/` (with the « Ajouter un contact » button, which reuses `NewContactForm` with the agency name prefilled)
- Modify: `src/components/new-contact-form/` (optional prop `initialIntermediaryName: string | null`)

**Interfaces:**
- Consumes: `getIntermediaryPage`, `createContact`, `updateIntermediaryKind`; `ProposedMissionsList` and `ExchangesSection` (task 7) with `showsContactName: true` and `exchangeForm: null`.

- [ ] **Step 1: Write the failing tests**
  - `intermediary-header.test.tsx`: `it('summarises contacts, proposed missions and last exchange')`. Exact text: « {n} contacts · {n} missions proposées · dernier échange le {date} ». Use the existing helper in `src/domain/french-plural.ts` for singular/plural. Without any exchange, it shows « aucun échange ».
  - `intermediary-contacts-list.test.tsx`:
    - `it('lists contacts first with phone and last exchange')`;
    - `it('opens the new contact form with the agency prefilled')`.
- [ ] **Step 2: Run** — FAIL
- [ ] **Step 3: Implement** the page in the order of spec §4.5: header, contacts, exchanges, missions. Unknown or foreign id → `notFound()`.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add agency page"`

---

### Task 9: Contact dans le formulaire de candidature

**Files:**
- Modify: `src/components/entity-autocomplete/` (controller, component, interfaces, tests)
- Modify: `src/components/new-job-application-form/` (controller, component, interfaces, tests)
- Modify: `src/components/contact-view/` (« Voir la fiche du contact » link)
- Modify: `src/app/(app)/candidatures/[jobApplicationId]/page.tsx` (passes `contactId` to `ContactView`)
- Modify: `src/components/delete-job-application-button/delete-job-application-button.tsx` and its test

**Interfaces:**
- Consumes: `EntitySuggestion.contactDetails` and `label` (tasks 2 and 4), `JobApplicationInput.contactLinkedinUrl` / `userEditedContactFields` (task 3), `contactRoute`.
- Produces:
  - `EntityAutocompleteControllerParameters` gains `allowsCreation?: boolean`. When it is true and the trimmed value is non-empty, the list ends with an option `Créer « {value} »`, shown whenever no suggestion has the same `normalizeEntityName`, including when there are no suggestions at all. Choosing it closes the list without changing the value. Keyboard navigation includes it.
  - Suggestions display `label`.
  - `JobApplicationFormValues` gains `contactLinkedinUrl: string`. The controller keeps `userEditedContactFields: ContactDetailFieldName[]`.
  - `ContactViewProps` gains `contactId: string | null`.

- [ ] **Step 1: Write the failing tests**
  - `entity-autocomplete/controller.test.tsx`:
    - `it('offers to create the typed contact when no suggestion matches exactly')`;
    - `it('does not offer creation when a suggestion has the same normalized name')`;
    - `it('offers creation even when the search returns nothing')`.
  - `new-job-application-form/controller.test.tsx`:
    - `it('prefills phone, email and LinkedIn when an existing contact is chosen')`;
    - `it('marks a contact field as edited when the user types in it')`;
    - `it('does not mark AI-prefilled contact fields as edited')`;
    - `it('resets edited fields when another contact is chosen')`;
    - `it('sends the LinkedIn url')`.
  - `contact-view.test.tsx`: `it('links to the contact page')`, and no link when `contactId` is null.
  - `delete-job-application-button.test.tsx`: the description becomes « Son journal, ses entretiens et sa fiche métier seront supprimés. Les échanges notés depuis la fiche d'un contact restent dans son historique. »

    This is a static sentence, which is true in every case. It is a deliberate simplification of spec §3.2, which asked for a conditional mention.
- [ ] **Step 2: Run** — `npm test -- entity-autocomplete new-job-application-form contact-view delete-job-application-button` → FAIL
- [ ] **Step 3: Implement**
  - In the new form, the Contact field uses `allowsCreation`, and `onSelectSuggestion` for `contact` copies `suggestion.contactDetails` into the three fields and empties `userEditedContactFields`. `setTextFormValue` adds the field to `userEditedContactFields` for `contactEmail`, `contactPhone` and `contactLinkedinUrl`. `toFormValues` (AI extraction) does not touch them.
  - New input `contactLinkedinUrl`, labelled « LinkedIn du contact », `type="url"`, in the « Les personnes » fieldset.
  - The Contact field in `contact-edit-form` also gets `allowsCreation`; its save logic is unchanged.
- [ ] **Step 4: Run** — `npm test && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): pick or create a contact without retyping in job applications"`

---

### Task 10: Sauvegarde, restauration et vérification finale

**Files:**
- Modify: `scripts/restore-user-data-snapshot.ts` (calls `rpc('assign_missing_contact_intermediaries')` after the upserts)
- Modify: `tests/integration/user-data-snapshot-fixtures.ts`, `tests/integration/data-snapshot.test.ts`
- Modify: `README.md` (the « Mes contacts » page in the feature list, if such a list exists)

- [ ] **Step 1: Write the failing tests**, in `data-snapshot.test.ts`:
  - `it('exports and restores an exchange without job application and contact notes')`;
  - `it('assigns agencies to restored contacts without one')`.
- [ ] **Step 2: Run** — `npm run test:integration -- data-snapshot` → FAIL
- [ ] **Step 3: Implement** the restore call and the fixtures.
- [ ] **Step 4: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npx supabase db reset && npm run test:integration`
Expected: everything PASS. Then check by hand with `npm run dev`:
  - create a contact;
  - note a call without a candidature;
  - open its agency;
  - create a candidature by choosing that contact, and check that its details are prefilled;
  - delete the candidature, and check that the call is still on the contact page.

- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): restore contact agencies from backups"`
