# Contacts et agences (mobile) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** retrouver un contact en plein appel sur l'app mobile (recherche par nom, agence ou numéro), consulter les fiches contact et agence, et appeler en un geste. Tout en lecture seule.

**Architecture:** le mobile lit directement les vues Supabase créées par le plan web (`contacts_overview`, `intermediaries_overview`, `exchanges_overview`, `job_applications_overview`). Il reprend à l'identique les fichiers de domaine du web. Il suit le schéma existant : route mince dans `src/app` → loader dans `src/data/loaders` → écran dans `src/screens` avec `useController` et `useLoadedResource`.

**Tech Stack:** Expo 58, expo-router (NativeTabs, Stack), React Native 0.88, `@supabase/supabase-js`, Jest 30 (`jest-expo`) + `@testing-library/react-native`.

**Spec:** `/Users/rakedd/Personal_projects/Freeclutch/docs/superpowers/specs/2026-10-22-aled-contacts-agences-design.md` (§5).

**Prérequis :** les tâches 1 et 2 du plan web (`2026-10-22-aled-contacts-agences-web.md`) sont terminées. La migration est appliquée sur le projet Supabase visé par `.env.local`.

## Global Constraints

- Mêmes règles CLAUDE.md que le plan web : fonctions fléchées, `export const` (les routes `src/app` gardent `export default`), pas de `any`, pas de `console.log`, pas de commentaire, noms explicites, aucun code mort.
- Écran = `src/screens/<nom>-screen/` contenant `<nom>-screen.tsx`, `controller.tsx`, `interfaces.ts`, `index.ts` et les tests. Les routes `src/app` restent minces : elles injectent `supabase`, `userId` et la navigation.
- Les fichiers de `src/domain/` et `src/lib/supabase/database-types.ts` sont des **copies à l'identique** du web (`Freeclutch/src/domain/`, `Freeclutch/src/server/supabase/database-types.ts`). On les recopie, on ne les modifie jamais ici.
- Textes en français, tutoiement. L'action principale d'une fiche contact est « Appeler ».
- Tests asynchrones, comme le reste du dépôt (`await renderHook`, `await renderWithTheme`, `userEvent.setup()`).
- Git : committer sur la branche courante, jamais de `git push`, jamais de nouvelle branche. Messages sans `Co-Authored-By` ni mention d'outil d'IA. N'ajouter que les fichiers de la tâche.
- Commandes : `npx jest <motif>`, `npm run typecheck`, `npm run lint`. Node est dans `~/.nvm/versions/node/v24.15.0/bin` si `npx` est introuvable.

## Review Focus

1. **Numéro inconnu qui rappelle** : taper `06 12` puis le reste du numéro dans la recherche doit trouver le contact, quel que soit le format enregistré. Test dans la tâche 3.
2. **Contact sans téléphone** : pas de bouton « Appeler » mort, le bouton n'apparaît pas. Test dans la tâche 4.
3. **Hors ligne ou erreur réseau** sur la liste ou une fiche : message « Pas de connexion » avec bouton Réessayer, comme les autres écrans (`StateMessage`), et non un écran vide. Test dans la tâche 3.
4. **Identifiant de contact invalide ou d'un autre utilisateur** (lien profond, contact supprimé entre-temps) : écran « Contact introuvable », pas de crash. Test dans la tâche 4.
5. **Retour depuis une fiche ouverte depuis une candidature** : le geste de retour ramène à la candidature, pas à la liste des contacts. À vérifier à la main dans la tâche 4.

---

### Task 1: Synchroniser les fichiers partagés et retirer le code d'écriture inutilisé

**Files:**
- Copy from web: `src/lib/supabase/database-types.ts`, `src/domain/contacts.ts`, `src/domain/contacts.test.ts`, `src/domain/contact-search.ts`, `src/domain/contact-search.test.ts`, `src/domain/entities.ts`, `src/domain/job-application.ts`, `src/domain/job-application.test.ts`, `src/domain/opportunities.ts`, `src/domain/opportunities.test.ts`, `src/domain/routes.ts` (if present on mobile; otherwise do not create it)
- Modify: `src/data/repositories/entities-repository.ts`, `src/data/repositories/job-applications-repository.ts`, `src/data/repositories/activity-log-repository.ts`

**Interfaces:**
- Produces: the domain types `ContactListItem`, `IntermediaryListItem`, `ContactProfile`, `Exchange`, `ProposedMission`, `ContactPageData`, `IntermediaryPageData`, plus `filterContacts`, `sortContacts`, `filterIntermediaries`, `sortIntermediaries` and `INITIAL_*_SORT`, all identical to the web.

- [ ] **Step 1: Copy** the files listed. Then run `diff -r` on `src/domain` between the two repos. The only expected difference is the mobile-only `todo-alert-messages(.test).ts`, plus web files that mobile never copied.
- [ ] **Step 2: Remove the dead write code from the mobile copies**. These functions are called by no screen: `insertJobApplication`, `updateJobApplicationRow`, `resolveJobApplicationEntityColumns` and its helpers (`resolveContactId`, `fillEmptyContactField`, `resolveIntermediaryId`, …), `searchEntitySuggestions`, `findContactDetails`, `saveContactDetails`, `saveIntermediaryKind`, `assignEndClientParent`. Check with `grep -rn "<name>" src` before deleting each one. Delete `entities-repository.ts` if nothing is left in it.
- [ ] **Step 3: Fix the nullable `job_application_id` mapping** in `activity-log-repository.ts`, as on the web: `job_application_id ?? jobApplicationId`.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS
- [ ] **Step 5: Commit** — `git commit -m "chore(contacts): sync shared domain and types, drop unused write repositories"`

---

### Task 2: Repository et loaders de lecture

**Files:**
- Create: `src/data/repositories/contacts-repository.ts`, `src/data/repositories/contacts-repository.test.ts`
- Create: `src/data/loaders/load-contacts-directory.ts`, `src/data/loaders/load-contact-detail.ts`, `src/data/loaders/load-intermediary-detail.ts`, and their `.test.ts` files

**Interfaces:**
- Consumes: task 1 types; views from the web plan, task 1.
- Produces:
  - `contacts-repository.ts` (each function takes `supabase: AledSupabaseClient, userId: string` first). These are copies adapted from the web read functions (tasks 4 and 5 of the web plan: same queries, same mapping helpers `toContactListItem`, `toIntermediaryListItem`, `toExchange`), without `server-only`:
    - `listContactListItems`, `listContactListItemsForIntermediary`, `findContactProfile`;
    - `listIntermediaryListItems`, `findIntermediaryListItem`;
    - `listExchangesForContact`, `listExchangesForIntermediary`;
    - `listProposedMissionsForContact`, `listProposedMissionsForIntermediary`.
  - `loadContactsDirectory(supabase, userId): Promise<{ contacts: ContactListItem[]; intermediaries: IntermediaryListItem[] }>`
  - `loadContactDetail(supabase, userId, contactId: string): Promise<ContactPageData | null>`. It returns `null` for an invalid UUID or a missing contact, and throws on a network error, like `loadJobApplicationDetail`.
  - `loadIntermediaryDetail(supabase, userId, intermediaryId: string): Promise<IntermediaryPageData | null>`, same rules.

- [ ] **Step 1: Write the failing tests** with a fake Supabase client, the way `job-applications-repository.test.ts` and `load-job-application-detail.test.ts` do:
  - `it('maps contacts overview rows to contact list items')` (dates turned into `Date`, `null` kept);
  - `it('returns null for a malformed contact id without querying')`;
  - `it('returns null when the contact does not exist')`;
  - `it('throws when a query fails')`;
  - `it('loads contacts and agencies in parallel')`.
- [ ] **Step 2: Run** — `npx jest contacts-repository load-contact` → FAIL
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add read-only contacts repository and loaders"`

---

### Task 3: Onglet Contacts et déplacement des Réglages

**Files:**
- Create: `src/screens/contacts-screen/` (screen, controller, interfaces, index, tests)
- Create: `src/app/(tabs)/contacts/_layout.tsx` (Stack, same style as `candidatures/_layout.tsx`), `src/app/(tabs)/contacts/index.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`: remove the `reglages` trigger and add `contacts` (label `Contacts`, icons `sf="person.2.fill"` `md="contacts"`). Tab order: Accueil, Candidatures, Contacts, Opportunités, Calendrier.
- Move: `src/app/(tabs)/reglages.tsx` → `src/app/reglages.tsx`. In `src/app/_layout.tsx`, declare it inside the `session !== null` guard, with `headerShown: true` and `title: 'Réglages'`.
- Modify: `src/screens/home-screen/` (prop `onOpenSettings: () => void`, gear button at the top right, `accessibilityLabel="Réglages"`), `src/app/(tabs)/index.tsx` (`router.push('/reglages')`)

**Interfaces:**
- Consumes: `loadContactsDirectory` (task 2), `filterContacts`, `sortContacts`, `filterIntermediaries`, `sortIntermediaries`, `INITIAL_CONTACTS_SORT`, `INITIAL_INTERMEDIARIES_SORT` (task 1).
- Produces:
  - `ContactsScreenProps = { loadContactsDirectory: () => Promise<{ contacts: ContactListItem[]; intermediaries: IntermediaryListItem[] }>; getNow: () => Date; refreshKey?: number; onOpenContact: (contactId: string) => void; onOpenIntermediary: (intermediaryId: string) => void }`
  - `useController` returns `{ status, segment, selectSegment, query, setQuery, visibleContacts, visibleIntermediaries, isRefreshing, refresh }`, where `segment` is `'contacts' | 'intermediaries'`.

- [ ] **Step 1: Write the failing tests**
  - `controller.test.tsx`:
    - `it('shows contacts sorted by last exchange first')`;
    - `it('finds a contact by a phone number typed with spaces')`;
    - `it('switches to agencies and filters them by name')`.
  - `contacts-screen.test.tsx`:
    - `it('shows name, agency and last exchange on each row')`;
    - `it('opens the contact when its row is pressed')`;
    - `it('shows the offline message with a retry button when loading fails')`;
    - `it('explains that contacts are added from the web app when the list is empty')`. Exact text: « Aucun contact pour l'instant. Ajoute-les depuis l'app web, dans Mes contacts. »
  - `home-screen.test.tsx`: `it('opens the settings from the gear button')`.
- [ ] **Step 2: Run** — `npx jest contacts-screen home-screen` → FAIL
- [ ] **Step 3: Implement**
  - Layout: `ScreenScrollView` titled `Contacts`, then `SegmentedControl` (« Contacts » / « Agences »), then a search `TextField` labelled « Rechercher », then `PressableCard` rows.
  - The route pushes `/contacts/[contactId]` and `/contacts/agences/[intermediaryId]`.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand in Expo: the tabs, the settings button, and sign-out from Réglages.
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add Contacts tab and move settings to the home screen"`

---

### Task 4: Fiches contact et agence, lien depuis la candidature

**Files:**
- Create: `src/screens/contact-detail-screen/`, `src/screens/intermediary-detail-screen/` (screen, controller, interfaces, index, tests)
- Create: `src/app/(tabs)/contacts/[contactId].tsx`, `src/app/(tabs)/contacts/agences/[intermediaryId].tsx` (and declare them in the Stack layout: titles `Contact` and `Agence`, `headerBackTitle` `Contacts`)
- Create: `src/lib/linking/open-phone-dialer.ts` (+ test). `openPhoneDialer(phoneNumber: string): Promise<void>` calls `Linking.openURL('tel:' + phoneNumber with spaces removed)` from `expo-linking`. Do the same for `mailto:`, with `openEmailComposer(email: string): Promise<void>` in the same file.
- Modify: `src/screens/job-application-detail-screen/` (prop `onOpenContact: (contactId: string) => void`; the « Contact » row becomes pressable when `overview.contactId` is not null) and `src/app/(tabs)/candidatures/[jobApplicationId].tsx`

**Interfaces:**
- Consumes: `loadContactDetail`, `loadIntermediaryDetail` (task 2), `openWebPage` (existing, for LinkedIn).
- Produces:
  - `ContactDetailScreenProps = { loadContactDetail: () => Promise<ContactPageData | null>; getNow: () => Date; refreshKey?: number; callPhoneNumber: (phoneNumber: string) => void; writeEmail: (email: string) => void; openLinkedin: (url: string) => void; onOpenIntermediary: (intermediaryId: string) => void; onOpenJobApplication: (jobApplicationId: string) => void }`
  - `IntermediaryDetailScreenProps = { loadIntermediaryDetail: () => Promise<IntermediaryPageData | null>; getNow: () => Date; refreshKey?: number; onOpenContact: (contactId: string) => void; onOpenJobApplication: (jobApplicationId: string) => void }`

- [ ] **Step 1: Write the failing tests**
  - `contact-detail-screen.test.tsx`:
    - `it('puts the call button first and calls the contact phone')`;
    - `it('hides the call button when the contact has no phone')`;
    - `it('shows referred by, notes, proposed missions and exchanges')`;
    - `it('shows Contact introuvable when the loader returns null')`;
    - `it('opens the agency when its name is pressed')`.
  - `intermediary-detail-screen.test.tsx`:
    - `it('lists contacts before exchanges and proposed missions')`;
    - `it('summarises contacts, missions and last exchange')`. Use the same text as web task 8: « {n} contacts · {n} missions proposées · dernier échange le {date} ».
  - `job-application-detail-screen.test.tsx`:
    - `it('opens the contact page from the contact row')`;
    - `it('keeps the contact row static when there is no contact')`.
  - `open-phone-dialer.test.ts`: `it('opens tel: without spaces')`, `it('opens mailto:')`.
- [ ] **Step 2: Run** — `npx jest contact-detail intermediary-detail job-application-detail open-phone-dialer` → FAIL
- [ ] **Step 3: Implement**
  - The candidature → contact route pushes `/contacts/[contactId]`. Check that going back returns to the candidature (Review Focus 5). If the tab stack makes that impossible, declare a `contact/[contactId]` route in the `candidatures` stack that renders the same screen.
- [ ] **Step 4: Run** — `npx jest && npm run typecheck && npm run lint` → PASS. Then check by hand on a device:
  - search, then « Appeler » opens the dialer;
  - LinkedIn opens;
  - candidature → contact → back.
- [ ] **Step 5: Commit** — `git commit -m "feat(contacts): add contact and agency pages with one-tap call"`
