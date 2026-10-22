# « J'ai eu un call » (mobile) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** juste après avoir raccroché, noter un appel en moins de 30 secondes : raconter l'appel (clavier ou dictée du clavier), coller le numéro, laisser l'IA préparer contact, échange et candidature, vérifier, enregistrer, puis arriver sur la fiche du contact. Une saisie sans IA reste possible, et le texte n'est jamais perdu.

**Architecture:** une route modale `src/app/appel.tsx` dans la pile racine, deux étapes dans le même écran (`call-log-screen`). Les écritures passent par les deux routes de l'app web (`POST /api/mobile/calls/draft` et `POST /api/mobile/calls`), appelées par un client API (`src/lib/api/`) qui porte le jeton de session Supabase et le rafraîchit une fois sur 401. Les lectures restent directes (RLS) : clé Claude présente (`profiles.anthropic_api_key_last_four`), contacts (`contacts_overview`), CV (`cvs_overview`). Le contrat JSON et sa validation sont la copie à l'identique de `src/domain/call-log.ts` du web. Le brouillon local (texte, numéro, heure) vit dans `expo-sqlite/localStorage`.

**Tech Stack:** Expo 58, expo-router (Stack, `presentation: 'modal'`), React Native 0.88, `@supabase/supabase-js`, `expo-clipboard`, Jest 30 (`jest-expo`) + `@testing-library/react-native`.

**Spec:** `/Users/rakedd/Personal_projects/Freeclutch/docs/superpowers/specs/2026-10-22-aled-call-log-design.md` (§5, §6, §8).

**Prérequis :**
- le plan web de cette fonctionnalité (`2026-10-22-aled-call-log-web.md`) est terminé et déployé sur l'hôte visé par `EXPO_PUBLIC_WEB_APP_URL` (tâche 2 pour le contrat, tâches 6 et 8 pour les routes) ;
- le plan mobile de la bibliothèque de CV (`2026-10-22-aled-cv-library-mobile.md`) est entièrement exécuté : `src/domain/cv-library.ts` (`CvOption`) et `src/data/repositories/cvs-repository.ts` existent ;
- le plan mobile des contacts est exécuté : `listContactListItems`, `filterContacts`, `sortContacts`, `ContactDetailScreen` et les routes `/contacts/[contactId]` et `/candidatures/contact/[contactId]` existent.

## Global Constraints

- Mêmes règles CLAUDE.md que le plan web : fonctions fléchées, `export const` (les routes `src/app` gardent `export default`), pas de `any`, pas de `console.log`, pas de commentaire, noms explicites, aucun code mort.
- Écran = `src/screens/<nom>-screen/` contenant `<nom>-screen.tsx`, `controller.tsx`, `interfaces.ts`, `index.ts` et les tests. Composant = `src/components/<nom>/` sur le même modèle, ou un sous-dossier de l'écran quand lui seul l'utilise (`call-note-form`, `call-review-form`). Les routes `src/app` restent minces : elles injectent `supabase`, `userId`, le client API, le stockage et la navigation.
- Les fichiers de `src/domain/` et `src/lib/supabase/database-types.ts` sont des **copies à l'identique** du web. On les recopie, on ne les modifie jamais ici.
- Textes en français, tutoiement. Messages d'erreur : ceux de `CALL_LOG_MESSAGES` ou ceux renvoyés par le serveur, jamais un texte recopié à la main.
- Le presse-papiers n'est lu **qu'au clic** sur « Coller le numéro », jamais à l'ouverture (avertissement de collage d'iOS).
- Le texte dicté et le jeton ne sont jamais journalisés.
- Installer expo-clipboard uniquement via `npx expo install expo-clipboard`.
- Style de code : guillemets simples, sans point-virgule, indentation 2 espaces ; ne jamais lancer prettier ni aucun formateur ; ne jamais reformater du code existant non modifié.
- Tests asynchrones, comme le reste du dépôt (`await renderHook`, `await renderWithTheme`, `userEvent.setup()`).
- Git : committer sur la branche courante, jamais de `git push`, jamais de nouvelle branche. Messages sans `Co-Authored-By` ni mention d'outil d'IA. N'ajouter que les fichiers de la tâche.
- Commandes : `npx jest <motif>`, `npm run typecheck`, `npm run lint`. Node est dans `~/.nvm/versions/node/v24.15.0/bin` si `npx` est introuvable.

## Review Focus

1. **Enregistrement hors ligne puis nouvel essai** : `fetch` échoue, l'écran affiche « Pas de connexion… », rien de ce qui a été saisi n'est perdu, et le nouvel essai part une seule fois, même sur un double appui. Après un échec partiel, le nouvel essai réutilise `createdContactId` et `createdJobApplicationId` : pas de contact ni de candidature en double. Tests dans les tâches 1 et 6.
2. **Jeton d'accès expiré** (app restée ouverte des heures, téléphone en veille) : le client rafraîchit la session une fois et rejoue la requête. Si le rafraîchissement échoue, le message « Ta session a expiré… » s'affiche et le texte reste là. Tests dans les tâches 1 et 4.
3. **Presse-papiers qui ne contient pas un numéro** (une URL, une phrase qui contient un numéro, une chaîne vide, une lecture refusée) : « Le presse-papiers ne contient pas de numéro. », et le champ garde sa valeur. Le presse-papiers n'est jamais lu à l'ouverture. Tests dans la tâche 4.
4. **App tuée en plein récit, ou stockage local corrompu** : le brouillon est restauré avec « Brouillon non envoyé restauré », et son heure d'appel aussi. Un JSON illisible est ignoré sans plantage. Tests dans la tâche 4.
5. **Saisie sans IA d'un récit de plus de 2 000 caractères** (le récit en admet 3 000, le résumé 2 000) : le résumé n'est pas tronqué en silence. Le message `Résumé : 2000 caractères maximum` s'affiche avant tout envoi. Test dans la tâche 5.

---

### Task 1: Fichiers partagés, variable d'environnement et client API

**Files:**
- Copy from web: `src/domain/call-log.ts`, `src/domain/call-log.test.ts`, `src/domain/entities.ts`, `src/domain/entities.test.ts`, `src/domain/ai-errors.ts`
- Create: `src/lib/api/web-app-environment.ts`, `src/lib/api/web-app-environment.test.ts`
- Create: `src/lib/api/supabase-access-token.ts`, `src/lib/api/supabase-access-token.test.ts`
- Create: `src/lib/api/aled-api-client.ts`, `src/lib/api/aled-api-client.test.ts`
- Create: `src/lib/api/aled-api.ts` (the app instance, no test)
- Modify: `.env.example` (adds `EXPO_PUBLIC_WEB_APP_URL=`)

**Interfaces:**
- Produces:
  - `parseWebAppUrl(rawWebAppUrl: string | undefined): string`. A missing value throws `Missing environment variable EXPO_PUBLIC_WEB_APP_URL`, like `parseSupabaseEnvironment`. A protocol other than `http:` or `https:` throws `EXPO_PUBLIC_WEB_APP_URL must be an http or https address`. The trailing slash is removed. The value is the app host (`https://app.aled.work`), never the landing domain, which answers `/api` with a 308.
  - `readSupabaseAccessToken(authClient: Pick<AledSupabaseClient['auth'], 'getSession'>): Promise<string | null>`. `getSession` already refreshes an expired session; an error gives `null`.
  - `refreshSupabaseAccessToken(authClient: Pick<AledSupabaseClient['auth'], 'refreshSession'>): Promise<string | null>`
  - `type AledApiClientDependencies = { webAppUrl: string; getAccessToken: () => Promise<string | null>; refreshAccessToken: () => Promise<string | null>; fetchImplementation: typeof fetch }`
  - `type AledApiClient = { prepareCallDraft: (request: CallDraftRequest) => Promise<CallApiResult<CallDraft>>; recordCall: (request: RecordCallRequest) => Promise<CallApiResult<RecordCallResult>> }`
  - `createAledApiClient(dependencies: AledApiClientDependencies): AledApiClient`:
    - each call is a `POST` to `{webAppUrl}/api/mobile/calls/draft` or `{webAppUrl}/api/mobile/calls`, with the headers `Authorization: Bearer <token>`, `Content-Type: application/json` and `Accept: application/json`;
    - no token → no request, and `toCallApiError('unauthorized', CALL_LOG_MESSAGES.unauthorized)`;
    - a 401 → `refreshAccessToken()`, then one replay with the new token; a missing new token or a second 401 → the same `unauthorized` error;
    - a `fetch` rejection → `network` with `CALL_LOG_MESSAGES.network`; it never throws;
    - an error body `{ error: { kind, message, createdContactId?, createdJobApplicationId? } }` → that error, with missing ids set to `null`;
    - a body that is not JSON, or that fails the guards `isCallDraft` / `isRecordCallResult` / `isCallApiErrorBody` (private narrowing on `unknown`, no cast) → `unexpected_response` with `CALL_LOG_MESSAGES.unexpectedResponse`.
  - `aled-api.ts` exports `aledApi = createAledApiClient({ webAppUrl: parseWebAppUrl(process.env.EXPO_PUBLIC_WEB_APP_URL), getAccessToken: () => readSupabaseAccessToken(supabase.auth), refreshAccessToken: () => refreshSupabaseAccessToken(supabase.auth), fetchImplementation: fetch })`.

- [ ] **Step 1: Copy** the domain files listed. Then run `diff -r` on `src/domain` between the two repos. The only expected differences are the mobile-only `todo-alert-messages(.test).ts` and the web files that mobile never copied (`call-draft.ts` among them).
- [ ] **Step 2: Write the failing tests**
  - `web-app-environment.test.ts`:
    - `it('keeps the app host without its trailing slash')`;
    - `it('names the missing variable')`;
    - `it('refuses an address that is not http or https')`.
  - `supabase-access-token.test.ts`:
    - `it('returns the access token of the current session')`;
    - `it('returns null without session or on error')`;
    - `it('returns the refreshed token, or null when refreshing fails')`.
  - `aled-api-client.test.ts`, with a `jest.fn()` fetch:
    - `it('posts the draft request as JSON with the bearer token to the app host')`;
    - `it('returns the draft sent by the server')`;
    - `it('returns the error kind and message sent by the server')` (`missing_api_key`);
    - `it('returns the created ids of a partial failure')`;
    - `it('refreshes the token once and replays the request after a 401')`: two fetch calls, the second with the new token (Review Focus 2);
    - `it('reports an expired session when the replay is refused again or no token comes back')`: at most two fetch calls;
    - `it('sends nothing and reports an expired session without access token')`;
    - `it('reports a network error without throwing')` (Review Focus 1);
    - `it('reports an unexpected response for an html page or a malformed body')`.
- [ ] **Step 3: Run** — `npx jest web-app-environment supabase-access-token aled-api-client call-log entities` → FAIL (the copied domain tests pass, the others fail)
- [ ] **Step 4: Implement** the signatures above. Add `EXPO_PUBLIC_WEB_APP_URL` to the local `.env.local` (never committed).
- [ ] **Step 5: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 6: Commit** — `git commit -m "feat(calls): sync the call log contract and add the web app api client"`

---

### Task 2: Données de l'écran et presse-papiers

**Files:**
- Modify: `src/data/repositories/cvs-repository.ts`, `src/data/repositories/cvs-repository.test.ts`
- Create: `src/data/loaders/load-call-log-context.ts`, `src/data/loaders/load-call-log-context.test.ts`
- Create: `src/lib/clipboard/read-clipboard-text.ts`, `src/lib/clipboard/read-clipboard-text.test.ts`
- Modify: `package.json`, `package-lock.json` (by `npx expo install expo-clipboard` only)

**Interfaces:**
- Consumes: `findProfileSettings`, `listContactListItems` (existing); `CvOption` (copy of `cv-library.ts`).
- Produces:
  - `listCvOptions(supabase: AledSupabaseClient, userId: string): Promise<CvOption[]>`, in `cvs-repository.ts`. It reads `cvs_overview` (`id, label, current_version_id`) for `user_id`, ordered `current_version_uploaded_at desc nulls last, created_at desc` like the web library. It drops CVs without a current version and throws on error (spec §8.1).
  - `type CallLogContext = { hasAnthropicApiKey: boolean; contacts: ContactListItem[]; cvOptions: CvOption[] }`
  - `loadCallLogContext(supabase: AledSupabaseClient, userId: string): Promise<CallLogContext>`:
    - it runs the three reads in parallel;
    - `hasAnthropicApiKey` = `anthropicApiKeyLastFour !== null`;
    - a CV failure logs `console.error('Call log cv loading failed', error)` and gives `[]`;
    - a profile or contacts failure throws.
  - `readClipboardText(): Promise<string>`: `Clipboard.getStringAsync()`; an error logs `console.warn('Clipboard reading failed', error)` and gives `''`.

- [ ] **Step 1: Install** — `npx expo install expo-clipboard`
- [ ] **Step 2: Write the failing tests**
  - `cvs-repository.test.ts`: `it('lists the cvs with a current version as options, most recent first')`.
  - `load-call-log-context.test.ts`:
    - `it('tells whether the user has a claude key')`;
    - `it('loads contacts and cv options in parallel')`;
    - `it('still loads the context when the cv library fails')`;
    - `it('throws when the contacts cannot be loaded')`.
  - `read-clipboard-text.test.ts` (`expo-clipboard` mocked):
    - `it('returns the clipboard text')`;
    - `it('returns an empty text when reading is refused')`.
- [ ] **Step 3: Run** — `npx jest cvs-repository load-call-log-context read-clipboard-text` → FAIL
- [ ] **Step 4: Implement** the signatures above.
- [ ] **Step 5: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 6: Commit** — `git commit -m "feat(calls): load the call log context and read the clipboard on demand"`

---

### Task 3: Composants de formulaire

**Files:**
- Modify: `src/components/text-field/` (interfaces, component, test)
- Create: `src/components/option-list/` (component, interfaces, index, test; no controller)
- Create: `src/components/select-field/` (component, interfaces, index, test; no controller, a single `useState`)

**Interfaces:**
- Produces:
  - `TextFieldProps` gains `placeholder?: string`, `helperText?: string`, `multiline?: boolean`, `autoCapitalize?: TextInputProps['autoCapitalize']`, `autoCorrect?: boolean`. Current defaults stay (`autoCapitalize="none"`, `autoCorrect={false}`) unless a prop overrides them. `multiline` gives a 140 px minimum height and `textAlignVertical: 'top'`. `helperText` is a `caption` / `inkMuted` line under the field, above the error.
  - `OptionListOption<Value extends string> = { value: Value; label: string }`
  - `OptionListProps<Value extends string> = { accessibilityLabel: string; options: readonly OptionListOption<Value>[]; selectedValue: Value | null; onSelect: (value: Value) => void }`. It renders a `radiogroup` of rows (`role="radio"`, `aria-checked`, at least 44 px high).
  - `SelectFieldProps<Value extends string> = { label: string; options: readonly OptionListOption<Value>[]; selectedValue: Value; onSelect: (value: Value) => void }`. It is a row « {label} · {selected option label} » that opens an `OptionList`; choosing an option closes it. It keeps the review screen short with 8 statuses.

- [ ] **Step 1: Write the failing tests**
  - `text-field.test.tsx`:
    - `it('renders a multiline input with its placeholder')`;
    - `it('shows the helper text under the field')`;
    - `it('lets sentences be capitalised and corrected when asked')`.
  - `option-list.test.tsx`:
    - `it('marks the selected option as checked')`;
    - `it('calls onSelect with the pressed option')`.
  - `select-field.test.tsx`:
    - `it('shows the selected option and opens the list on press')`;
    - `it('closes the list after a choice')`.
- [ ] **Step 2: Run** — `npx jest text-field option-list select-field` → FAIL
- [ ] **Step 3: Implement** in the app's identity (`AppText`, theme colors, `RADIUS`, `SPACING`).
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(calls): add multiline text fields, option lists and select fields"`

---

### Task 4: Écran « Raconte l'appel »

**Files:**
- Create: `src/screens/call-log-screen/` (`call-log-screen.tsx`, `controller.tsx`, `interfaces.ts`, `index.ts`, `call-note-draft.ts`, `build-manual-call-draft.ts`, and the tests `call-log-screen.test.tsx`, `controller.test.tsx`, `call-note-draft.test.ts`, `build-manual-call-draft.test.ts`)
- Create: `src/screens/call-log-screen/call-note-form/` (component, interfaces, index, test; presentational, no controller). The two step components live inside the screen folder because they import its types (`../interfaces`).
- Create: `src/app/appel.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `CallLogContext`, `loadCallLogContext`, `readClipboardText` (task 2); `aledApi` (task 1); `looksLikePhoneNumber`, `CALL_LOG_MESSAGES`, `CALL_NOTE_MAX_LENGTH`, `CallDraft`, `CallDraftRequest`, `RecordCallRequest`, `RecordCallResult`, `CallApiResult` (domain copy); `TextField` (task 3).
- Produces:
  - in `call-note-draft.ts`:
    - `CALL_NOTE_DRAFT_STORAGE_KEY = 'aled-call-note-draft'`
    - `type CallNoteDraftStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void }`
    - `type CallNoteDraft = { text: string; phone: string; occurredAt: string }`
    - `readCallNoteDraft(storage: CallNoteDraftStorage): CallNoteDraft | null`: invalid JSON, a wrong shape or a throwing storage → `console.warn('Call note draft unreadable', error)` and `null`;
    - `writeCallNoteDraft(storage: CallNoteDraftStorage, draft: CallNoteDraft): void`: it removes the key when `text` and `phone` are both blank;
    - `clearCallNoteDraft(storage: CallNoteDraftStorage): void`.
    - The draft also keeps the call time, so that a story restored hours later still dates from the call.
  - `buildManualCallDraft({ text, phone, contactId, occurredAt }: { text: string; phone: string; contactId: string | null; occurredAt: Date }): CallDraft`, in `build-manual-call-draft.ts`: no candidates, `suggestedContactId: contactId`, `phone: phone.trim() || null`, `summary: text.trim()`, `jobApplication: null` (spec §5.4).
  - `CallNoteFormProps = { preselectedContactLabel: string | null; text: string; onChangeText: (text: string) => void; phone: string; onChangePhone: (phone: string) => void; onPastePhoneNumber: () => void; clipboardMessage: string | null; isDraftRestored: boolean; aiAvailability: CallAiAvailability; isPreparing: boolean; errorMessage: string | null; contextErrorMessage: string | null; onPrepareWithAi: () => void; onWriteWithoutAi: () => void }`
  - `type CallAiAvailability = 'unknown' | 'available' | 'missing_key'`. `unknown` (still loading, or failed) shows the AI button: the server answers `missing_api_key` if needed.
  - `CallLogScreenProps = { preselectedContactId: string | null; loadCallLogContext: () => Promise<CallLogContext>; prepareCallDraft: (request: CallDraftRequest) => Promise<CallApiResult<CallDraft>>; recordCall: (request: RecordCallRequest) => Promise<CallApiResult<RecordCallResult>>; readClipboardText: () => Promise<string>; draftStorage: CallNoteDraftStorage; getNow: () => Date; onClose: () => void; onOpenContact: (contactId: string) => void }`
  - `type CallLogStep = 'note' | 'review'`, `type CallReviewMode = 'ai' | 'manual'`
  - the screen `useController` returns `{ step, context, preselectedContactLabel, text, setText, phone, setPhone, pastePhoneNumber, clipboardMessage, isDraftRestored, aiAvailability, isPreparing, noteErrorMessage, contextErrorMessage, prepareWithAi, writeWithoutAi, reviewDraft, reviewMode, backToNote }`. Task 6 adds the save.
  - Behaviour:
    - `occurredAt` = `getNow()` at mount, or the restored draft's;
    - each change of `text` or `phone` calls `writeCallNoteDraft`;
    - `pastePhoneNumber` reads `readClipboardText()` only when called. When `looksLikePhoneNumber` accepts the trimmed text, it fills `phone`; otherwise it sets `clipboardMessage` to `Le presse-papiers ne contient pas de numéro.` and leaves `phone` unchanged;
    - `prepareWithAi` refuses a blank text locally with `CALL_LOG_MESSAGES.missingCallNote`, ignores a second press while `isPreparing`, then sends `{ text, phone: phone.trim() || null, contactId: preselectedContactId, occurredAt: occurredAt.toISOString() }`. On success it goes to `step: 'review'` with `reviewMode: 'ai'`; on error, `noteErrorMessage` = `error.message`, and the text stays;
    - `writeWithoutAi` goes to the review with `reviewMode: 'manual'` and `reviewDraft = buildManualCallDraft(...)`; a blank text is allowed;
    - a context failure sets `contextErrorMessage` to `Impossible de charger tes contacts. Tu peux quand même raconter l'appel.`, and the note step stays usable.
  - Route `src/app/appel.tsx`: optional parameter `contactId`. It injects `aledApi.prepareCallDraft`, `aledApi.recordCall`, `readClipboardText`, `localStorage` (already installed by `supabase-client.ts`), `onClose={() => router.back()}` and `onOpenContact={(contactId) => router.replace({ pathname: '/contacts/[contactId]', params: { contactId } })}` (spec §8.5). Task 6 wires the save that uses the last two.
  - `_layout.tsx`: `<Stack.Screen name="appel" options={{ presentation: 'modal', headerShown: true, title: 'Noter un appel', … }} />` inside `Stack.Protected guard={session !== null}`, with the same header styles as `reglages` (spec §8.5).

- [ ] **Step 1: Write the failing tests**
  - `build-manual-call-draft.test.ts`: `it('uses the raw story as summary, keeps the preselected contact and proposes no mission')`.
  - `call-note-draft.test.ts`:
    - `it('writes and reads back the text, the phone and the call time')`;
    - `it('removes the draft when text and phone are blank')`;
    - `it('ignores an unreadable draft without throwing')` (Review Focus 4);
    - `it('survives a storage that throws')`.
  - `controller.test.tsx`:
    - `it('saves the story and the number in local storage at every change')`;
    - `it('restores an unsent draft with its call time and says so')` (Review Focus 4);
    - `it('never reads the clipboard when the screen opens')` (Review Focus 3);
    - `it('pastes a phone number from the clipboard')`;
    - `it.each(['https://www.hays.fr', 'Rappeler au 06 12 34 56 78', '', 'abc'])('refuses to paste %p and keeps the phone field')` (Review Focus 3);
    - `it('asks for a story before calling the AI')`;
    - `it('sends the story, the number, the preselected contact and the call time to the AI')`;
    - `it('sends the AI request only once on a double press')`;
    - `it('goes to the review step with the AI draft')`;
    - `it('keeps the story and shows the server message when the AI fails or the session expired')` (Review Focus 2);
    - `it('opens the review without AI with the raw story')`;
    - `it('still lets the user write the story when the context fails to load')`.
  - `call-note-form.test.tsx`:
    - `it('focuses the story field with its placeholder and the dictation tip')`. Exact texts: label « Raconte l'appel », placeholder « Jean-Marc de Hays a positionné mon CV DevOps chez BNP, 650 €/jour, démarrage en janvier. », tip « Astuce : touche le micro du clavier pour dicter. »;
    - `it('shows the preselected contact at the top')`;
    - `it('offers Préparer avec l'IA first and Noter sans IA second')`;
    - `it('replaces the AI button with the web app hint without a claude key')`. Exact text: « Ajoute ta clé Claude depuis l'app web pour que l'IA prépare tout. »;
    - `it('shows Brouillon non envoyé restauré after a restore')`.
  - `call-log-screen.test.tsx`: `it('leaves the story step once the AI answered')`.
- [ ] **Step 2: Run** — `npx jest call-note-draft build-manual-call-draft call-log-screen call-note-form` → FAIL
- [ ] **Step 3: Implement**
  - Layout, top to bottom, all in a `ScreenScrollView isBelowNativeHeader`:
    - the preselected contact (« Avec {nom} · {agence} ») when there is one;
    - the story `TextField` (`multiline`, `autoFocus`, `autoCapitalize="sentences"`, `autoCorrect`, `maxLength={CALL_NOTE_MAX_LENGTH}`);
    - the « Numéro (facultatif) » field (`keyboardType="phone-pad"`), with a « Coller le numéro » `outline` button under it and the clipboard message;
    - « Préparer avec l'IA » (`primary`, `isLoading` while preparing), then « Noter sans IA » (`outline`);
    - errors in a `View role="alert"`, like the other screens.
  - The review step renders only a « Modifier le récit » button until task 6 plugs the review form in.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device:
  - open `/appel`: no iOS paste banner;
  - dictate with the keyboard mic;
  - kill the app, reopen: the draft is restored.
- [ ] **Step 5: Commit** — `git commit -m "feat(calls): add the tell-the-call screen with local draft and number paste"`

---

### Task 5: Étape « Vérifie avant d'enregistrer » et saisie sans IA

**Files:**
- Create: `src/screens/call-log-screen/call-review-form/` (`call-review-form.tsx`, `controller.tsx`, `interfaces.ts`, `index.ts`, `call-occurred-at.ts`, and the tests `call-review-form.test.tsx`, `controller.test.tsx`, `call-occurred-at.test.ts`)

**Interfaces:**
- Consumes: `CallDraft`, `RecordCallRequest`, `validateRecordCallRequest`, `CALL_JOB_APPLICATION_STATUSES`, `CALL_LOG_MESSAGES` (domain copy); `JOB_APPLICATION_STATUS_LABELS`, `JOB_APPLICATION_VALIDATION_MESSAGES`, `filterContacts`, `sortContacts`, `INITIAL_CONTACTS_SORT`, `ContactListItem`, `CvOption`; `formatParisTime`, `formatParisLocalDateTime`, `parisLocalDateTimeToUtc`, `countParisCalendarDaysBetween`; `OptionList`, `SelectField`, `TextField` (task 3).
- Produces:
  - in `call-occurred-at.ts`:
    - `formatCallOccurredAtLabel(occurredAt: Date, now: Date): string` → `Aujourd'hui à 14h32`, `Hier à 14h32`, or `Le 20/10/2026 à 14h32`;
    - `toCallOccurredAtFields(occurredAt: Date): { dateText: string; timeText: string }` → `20/10/2026`, `14:32`;
    - `parseCallOccurredAtFields(dateText: string, timeText: string): Date | null`, in Paris time through `parisLocalDateTimeToUtc`;
    - `INVALID_CALL_OCCURRED_AT_MESSAGE = 'Date ou heure invalide (JJ/MM/AAAA et HH:MM).'`.
  - `NEW_CONTACT_OPTION_VALUE = 'new'`
  - `CallReviewFormProps = { draft: CallDraft; mode: CallReviewMode; contacts: ContactListItem[]; cvOptions: CvOption[]; isSaving: boolean; saveErrorMessage: string | null; getNow: () => Date; onSave: (request: RecordCallRequest) => void; onEditNote: () => void }`
  - `type CallContactFormValues = { fullName: string; intermediaryName: string; phone: string; email: string }`
  - `type CallJobApplicationFormValues = { title: string; endClientName: string; postedDailyRate: string; status: JobApplicationStatus; cvId: string }`, where `cvId` `''` means « Aucun »
  - The `useController` returns:
    - contact: `{ contactQuestion, contactOptions, selectedContactValue, selectContactValue, contactQuery, setContactQuery, isContactSearchVisible, contactFormValues, setContactFormValue }`;
    - exchange: `{ summary, setSummary, occurredAtLabel, isEditingOccurredAt, startEditingOccurredAt, occurredAtFields, setOccurredAtField }`;
    - mission: `{ createsJobApplication, setCreatesJobApplication, jobApplicationValues, setJobApplicationValue, statusOptions, cvSelectOptions }`;
    - submission: `{ validationMessage, submit }`.
  - Rules (spec §5.3 and §5.4):
    - **contact** in AI mode: a suggestion selects it by default, with `contactQuestion` = `C'est bien Jean-Marc Dupont · Hays ?` and the options « Oui », the other candidates (« {nom} · {agence} »), then « Un nouveau contact ». Without a suggestion, « Un nouveau contact » is selected by default;
    - **contact** in manual mode: a preselected contact is selected; otherwise `isContactSearchVisible`, with options = the 5 first contacts of `filterContacts(sortContacts(contacts, INITIAL_CONTACTS_SORT), contactQuery)`, then « Un nouveau contact »; nothing is selected by default;
    - `contactFormValues` start from `draft.contact`. Name and agency are shown only for a new contact; phone and e-mail are always shown, under « Coordonnées notées pendant l'appel ». Typing in phone or e-mail adds the field to `userEditedContactFields`; the AI prefill and a pasted number do not;
    - **mission**: `createsJobApplication` starts at `draft.jobApplication !== null`, so it is off for a call without a mission and in manual mode. Turning it on in manual mode starts from status `intermediary_contact`. `statusOptions` follow `CALL_JOB_APPLICATION_STATUSES` with `JOB_APPLICATION_STATUS_LABELS`. `cvSelectOptions` = « Aucun » then `cvOptions`; the field is hidden when `cvOptions` is empty;
    - **submit** builds a `RecordCallRequest`:
      - `contact`: `{ id }`, or `{ new: { fullName, phone, email, linkedinUrl: null, intermediaryName, referredBy: null, notes: null } }`;
      - `contactDetails` = `{ phone, email, linkedinUrl: null }` (blank → `null`);
      - `exchange` = `{ summary, occurredAt }`;
      - `jobApplication`: `null` when the switch is off; otherwise the shown fields plus the hidden draft fields sent as they are (`location`, `remotePolicy`, `desiredStart`, `duration`, `stack`). Its `intermediaryName` is the chosen contact's agency (the field for a new contact), or else the draft's;
      - no contact chosen → `CALL_LOG_MESSAGES.missingContactChoice`; an unreadable daily rate → `JOB_APPLICATION_VALIDATION_MESSAGES.invalidDailyRate`; an invalid date → `INVALID_CALL_OCCURRED_AT_MESSAGE`;
      - then `validateRecordCallRequest(request, getNow())`: a refusal shows its message and calls nothing; otherwise `onSave(request)`;
      - a second press while `isSaving` is ignored.

- [ ] **Step 1: Write the failing tests**
  - `call-occurred-at.test.ts`:
    - `it('labels today, yesterday and older calls')`;
    - `it('parses the date and time in Paris time, also across a daylight saving change')`;
    - `it('refuses an impossible date')`.
  - `controller.test.tsx`:
    - `it('selects the suggested contact by default and asks C'est bien … ?')`;
    - `it('selects a new contact prefilled by the AI when nothing is suggested')`;
    - `it('marks only the contact fields the user typed in as edited')`;
    - `it('starts with Créer la candidature on when the AI found a mission and off otherwise')`;
    - `it('sends the hidden mission fields as they are')`;
    - `it('uses the agency of the chosen contact for the job application')`;
    - `it('searches the contacts by name, agency or phone in manual mode')`;
    - `it('asks to choose a contact in manual mode before saving')`;
    - `it('refuses a summary longer than 2000 characters before sending anything')` (Review Focus 5);
    - `it('requires a title when Créer la candidature is on')`;
    - `it('builds the request for an existing contact with the call details')`;
    - `it('builds the request for a new contact')`;
    - `it('ignores a second submit while saving')`.
  - `call-review-form.test.tsx`:
    - `it('shows the contact, exchange and mission sections in this order')`;
    - `it('hides the CV envoyé field when the library is empty')`;
    - `it('shows the save error and keeps every field')`;
    - `it('calls onEditNote from Modifier le récit')`.
- [ ] **Step 2: Run** — `npx jest call-occurred-at call-review-form` → FAIL
- [ ] **Step 3: Implement**
  - Layout: three `Card`s titled « Contact », « Échange », « Mission »:
    - **Contact**: the question or the search field « Rechercher un contact », then an `OptionList`, then the contact fields;
    - **Échange**: « Résumé » (`multiline`), then the date label with a « Modifier » text button that shows the « Date » and « Heure » fields;
    - **Mission**: a React Native `Switch` labelled « Créer la candidature ». When it is on: « Intitulé », « Client final », « TJM (€/jour) » (`keyboardType="number-pad"`), then the `SelectField` « Statut » and the `SelectField` « CV envoyé »;
    - « Enregistrer » (`primary`, `isLoading={isSaving}`), then « Modifier le récit » (`outline`).
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(calls): review the call draft before saving, with or without AI"`

---

### Task 6: Enregistrement, reprise et retour sur la fiche contact

**Files:**
- Modify: `src/screens/call-log-screen/` (controller, interfaces, screen, tests): the screen now renders the review form of task 5
- Create: `src/screens/call-log-screen/apply-record-call-retry.ts`, `apply-record-call-retry.test.ts`

**Interfaces:**
- Consumes: `recordCall` (task 1), `clearCallNoteDraft` (task 4), `CallReviewForm` (task 5).
- Produces:
  - `type RecordCallRetryState = { createdContactId: string; createdJobApplicationId: string | null }`
  - `applyRecordCallRetry(request: RecordCallRequest, retryState: RecordCallRetryState | null): RecordCallRequest`. With a state, `contact` becomes `{ id: createdContactId }`, and `existingJobApplicationId` becomes `createdJobApplicationId` when it is not null (spec §8.4).
  - The screen controller gains `{ saveCall, isSaving, saveErrorMessage }`:
    - `saveCall(request: RecordCallRequest)` ignores a call while `isSaving`, then sends `applyRecordCallRetry(request, retryState)`;
    - on success it runs `clearCallNoteDraft`, then `onClose()` when `contactId === preselectedContactId` (the contact page below refreshes on focus), otherwise `onOpenContact(contactId)`;
    - on error, `saveErrorMessage` = `error.message`. An error with `createdContactId` stores the retry state; a network error keeps it unchanged;
    - `prepareWithAi` and `writeWithoutAi` reset the retry state, because a new analysis will suggest the contact already created.
  - At the review step, the screen renders `CallReviewForm` with `onSave={saveCall}`, `isSaving`, `saveErrorMessage` and `onEditNote={backToNote}`. It gives the form a `key` that changes with each new draft, so that a new analysis starts from clean fields.

- [ ] **Step 1: Write the failing tests**
  - `apply-record-call-retry.test.ts`:
    - `it('keeps the request without retry state')`;
    - `it('targets the created contact and job application on retry')`;
    - `it('creates the job application on retry when only the contact was created')`.
  - `controller.test.tsx`:
    - `it('records the call, clears the local draft and opens the contact page')`;
    - `it('closes the modal when the call was logged from the same contact page')`;
    - `it('keeps the draft and shows Pas de connexion when the network fails, then retries once with the same request')` (Review Focus 1);
    - `it('retries with the created contact and job application after a partial failure')` (Review Focus 1);
    - `it('sends a single request on a double press of Enregistrer')`;
    - `it('forgets the retry state when the story is analysed again')`.
  - `call-log-screen.test.tsx`: `it('renders the review form after the AI answered and goes back to the story with Modifier le récit')`.
- [ ] **Step 2: Run** — `npx jest apply-record-call-retry call-log-screen` → FAIL
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device, against the app host:
  - a call with a mission lands on the contact page, which shows the new exchange and the proposed mission;
  - the back gesture from that page returns to the screen the user started from, not to a second home screen. If `router.replace` stacks a second tab navigator, replace it with `router.dismiss()` followed by `router.push(...)`, and note it in the commit;
  - airplane mode: « Pas de connexion… », then back online: one record only.
- [ ] **Step 5: Commit** — `git commit -m "feat(calls): save the reviewed call and open the contact page"`

---

### Task 7: Points d'entrée — accueil et fiche contact

**Files:**
- Modify: `src/screens/home-screen/` (interfaces, component, tests), `src/app/(tabs)/index.tsx`
- Modify: `src/screens/contact-detail-screen/` (interfaces, component, tests), `src/app/(tabs)/contacts/[contactId].tsx`, `src/app/(tabs)/candidatures/contact/[contactId].tsx`

**Interfaces:**
- Produces:
  - `HomeScreenProps` gains `onLogCall: () => void`. The route passes `() => router.push('/appel')`.
  - `ContactDetailScreenProps` gains `onLogCall: () => void`. Both routes pass `() => router.push({ pathname: '/appel', params: { contactId } })`.

- [ ] **Step 1: Write the failing tests**
  - `home-screen.test.tsx`:
    - `it('opens the call screen from J'ai eu un call, right under the summary sentence')`;
    - `it('keeps J'ai eu un call available while loading and on load errors')`, so that a call can be logged offline, like the settings button.
  - `contact-detail-screen.test.tsx`:
    - `it('shows Noter un appel under Appeler and opens the call screen')`;
    - `it('shows Noter un appel even when the contact has no phone')`.
- [ ] **Step 2: Run** — `npx jest home-screen contact-detail-screen` → FAIL
- [ ] **Step 3: Implement**
  - Home: an `AppButton` « J'ai eu un call » (`primary`, full width) right under the summary sentence, above the next interview card and « À faire » (spec §5.1). In the loading and error states, it goes above the indicator or the message.
  - Contact page: an `outline` `AppButton` « Noter un appel » in the actions block, right after « Appeler ». The block is now always shown.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device, end to end:
  - home → « J'ai eu un call » → dictate « Jean-Marc de Hays a positionné mon CV DevOps chez BNP, 650 €/jour » → « Préparer avec l'IA » → « Oui » → « Enregistrer » → the contact page shows the call and the mission « CV positionné » with the CV;
  - contact page → « Noter un appel » → « Noter sans IA » → save → back on that page, refreshed;
  - check dark mode and one-handed use on a small screen.
- [ ] **Step 5: Commit** — `git commit -m "feat(calls): open the call screen from home and contact pages"`
