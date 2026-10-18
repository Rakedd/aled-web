# Freeclutch V2 « Mes opportunités » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Remplacer le salon Discord du profil `dev` par un onglet Freeclutch « Mes opportunités ». Le watcher career-ops pousse toutes les missions Free-Work des 7 derniers jours ; Freeclutch les filtre pour chaque utilisateur selon ses réglages Free-Work, et transforme une mission en candidature en un clic.

**Architecture :**
- Le watcher (GCP Cloud Function) devient un collecteur sans filtre. Il envoie des paquets de 100 missions à `POST /api/opportunities/ingest`, avec un jeton Bearer.
- Freeclutch stocke les missions une seule fois dans une table commune, et garde par utilisateur ses décisions (postulé, ignoré) et ses filtres par source.
- Le filtrage est calculé côté serveur en TypeScript, en deux temps : métadonnées légères d'abord, puis lignes complètes paginées.

**Tech Stack :** Freeclutch (Next.js, TypeScript, Supabase, Jest, React Testing Library) ; watcher (Node 22 ESM `// @ts-check`, `node --test`, `@google-cloud/storage`).

**Spec :** [docs/superpowers/specs/2026-10-18-mes-opportunites-design.md](../specs/2026-10-18-mes-opportunites-design.md)

**Dépôts :**
- **F** = Freeclutch, `/Users/rakedd/Personal_projects/Freeclutch`, branche `main` ;
- **W** = watcher, `/Users/rakedd/Freelance/development/carreer-ops/cloud/free-work-watcher`, branche `main`.

## Global Constraints

- **Toutes les Global Constraints du plan V1** (`docs/superpowers/plans/2026-10-17-freeclutch-v1.md`) s'appliquent au dépôt F :
  - aucun `any` ;
  - fonctions fléchées uniquement ;
  - exports nommés uniquement ;
  - un dossier kebab-case par composant, avec `controller.tsx` et `useController` ;
  - aucun `console.log` et aucun commentaire ;
  - `import 'server-only'` dans `src/server` ;
  - types partagés dans `src/domain` ;
  - les fichiers `'use server'` n'exportent que des actions ;
  - repositories `(supabase, userId, …)` filtrés par `user_id` ;
  - actions via `runAuthenticatedOperation` ;
  - contrôleurs : `GENERIC_ACTION_ERROR_MESSAGE` sur exception, `onDataChanged` vers `router.refresh()` après une mutation réussie, boutons désactivés pendant l'envoi ;
  - fuseau Europe/Paris ;
  - textes d'interface en français.
- **Dépôt W :** JavaScript ESM avec `// @ts-check` et JSDoc, suivre le style des fichiers existants, tests `node --test`. On part du code commité ; le stash `cyber` du porteur n'est **ni appliqué ni supprimé**.
- **Git :**
  - commit sur la branche courante de chaque dépôt ;
  - jamais de `push`, de création ou de changement de branche ;
  - aucune mention d'IA dans les messages de commit.
- **Valeurs du spec :**
  - fenêtre de collecte : **7 jours** ;
  - « À traiter » : **7 jours** ;
  - historique et purge : **30 jours** ;
  - paquets de **100** missions ;
  - `FREECLUTCH_MAX_PAGES` = **120** ;
  - délai de la fonction : **300 s** ;
  - alerte de fraîcheur si plus de **4 h** sans réception entre **9 h et 22 h** (Paris) ;
  - pagination de la liste : **50** (choix du plan).
- **Secrets :**
  - `OPPORTUNITIES_INGEST_TOKEN` côté Vercel ;
  - secret GCP `freeclutch-ingest-token` monté en `FREECLUTCH_INGEST_TOKEN`.

  Jamais journalisés, jamais commités.
- **Production :** aucune action sur la production (`supabase db push`, déploiement Vercel, `deploy.sh`) avant la tâche 14, et seulement avec le feu vert explicite du porteur.

## Review Focus

1. **Mission renvoyée avec des champs modifiés** (TJM ou description corrigés) : la mission est mise à jour, sans doublon, et la décision existante de l'utilisateur est conservée. → Tâche 3.
2. **Mots-clés avec caractères spéciaux** (`c#`, `.net`, `node.js`, `c++`) : ils sont reconnus littéralement, et `java` ne reconnaît toujours pas `javascript`. → Tâche 2.
3. **Étiquettes vides ou faites d'espaces** dans les filtres : elles sont ignorées, et des filtres entièrement vides montrent toutes les missions. → Tâches 2 et 5.
4. **Double clic sur « J'ai postulé »**, ou mission déjà postulée : une seule candidature est créée, et le second appel renvoie la même. → Tâche 4.
5. **Paquet partiellement livré par le watcher** (le 2e paquet sur 3 échoue) : le 1er reste marqué livré, les 2e et 3e sont renvoyés au passage suivant, et le watcher ne plante pas. → Tâche 12.

---

### Task 1 (F) : Schéma des opportunités

**Files :**
- Create : `supabase/migrations/20261018000000_opportunities.sql`
- Modify : `src/server/supabase/database-types.ts` (régénéré avec `npm run db:types`)
- Test : `tests/integration/opportunities-isolation.test.ts`

**Interfaces :**
- Produit les tables et colonnes suivantes :
  - **`opportunities`** :
    - `id uuid pk`, `source text not null`, `external_id text not null`, `url text not null`, `title text not null`, `title_normalized text not null`, `company text`, `description text` ;
    - `rate_min int`, `rate_max int`, `rate_label text`, `currency text`, `remote_mode text check in ('full','partial','none')`, nullable ;
    - `location_label text`, `region text`, `country text`, `duration_months int`, `published_at timestamptz not null`, `skills jsonb not null default '[]'` ;
    - `received_at timestamptz not null default now()`, `updated_at timestamptz` ;
    - contrainte `unique (source, external_id)`, index sur `published_at` et sur `received_at`.
  - **`opportunity_decisions`** :
    - `user_id`, `opportunity_id` (référence `opportunities`, `on delete cascade`), `decision text check in ('applied','dismissed')`, `job_application_id uuid null`, `decided_at timestamptz default now()` ;
    - contrainte `unique (user_id, opportunity_id)` ;
    - clé étrangère composite `(user_id, job_application_id) → job_applications(user_id, id) on delete set null (job_application_id)`.
  - **`opportunity_filters`** :
    - `user_id`, `source text`, `include_keywords text[] default '{}'`, `always_exclude_keywords text[]`, `rescuable_exclude_keywords text[]`, `rescue_keywords text[]`, `rate_floor_full_remote int`, `rate_floor_hybrid int`, `rate_floor_onsite int` (planchers nullables, `check >= 0`), `regions text[]`, `updated_at` ;
    - contrainte `unique (user_id, source)`.
  - **`profiles.opportunities_last_viewed_at timestamptz`.**
- RLS :
  - `opportunities` : `select` pour `authenticated`, aucune écriture hors service role ;
  - les deux autres tables : quatre politiques `user_id = (select auth.uid())`.

- [ ] **Step 1 :** Écrire `opportunities-isolation.test.ts`, en réutilisant `createSignedInTestClient` et `createServiceRoleTestClient`. Les tests :
  - le service role insère une opportunité ;
  - A et B la lisent tous les deux ;
  - B ne peut ni lire, ni modifier, ni supprimer la décision de A ou ses filtres ;
  - B ne peut pas insérer dans `opportunities` (erreur `42501`) ;
  - une décision `applied` de B qui pointe vers une candidature de A est refusée (`23503`) ;
  - insérer deux fois le même `(source, external_id)` échoue (`23505`) ;
  - supprimer l'opportunité supprime la décision en cascade.
- [ ] **Step 2 :** `npx supabase start && npm run test:integration -- opportunities-isolation`. Attendu : FAIL (relations absentes).
- [ ] **Step 3 :** Écrire la migration, puis lancer `npx supabase db reset` et `npm run db:types`.
- [ ] **Step 4 :** Relancer. Attendu : PASS. Lancer aussi `npm run typecheck`.
- [ ] **Step 5 :** Commit `feat(db): add opportunities, decisions and per-source filters`.

---

### Task 2 (F) : Domaine des opportunités (filtrage, conversion, fraîcheur)

**Files :**
- Create : `src/domain/opportunities.ts`, `src/domain/opportunity-filters.ts`
- Test : `src/domain/opportunity-filters.test.ts`, `src/domain/opportunities.test.ts`

**Interfaces :**
- Produit (`opportunities.ts`) :
  - `OPPORTUNITY_SOURCES = ['free-work'] as const`, `OpportunitySource` ;
  - `RemoteMode = 'full' | 'partial' | 'none'` ;
  - `REMOTE_MODE_LABELS: Record<RemoteMode, string>` = `{ full: 'Full remote', partial: 'Hybride', none: 'Sur site' }` ;
  - `Opportunity` = `{ id, source, externalId, url, title, company, description, rateMin, rateMax, rateLabel, currency, remoteMode: RemoteMode | null, locationLabel, region, country, durationMonths, publishedAt: Date, skills: string[], receivedAt: Date }` (les champs optionnels en `string | null` ou `number | null`) ;
  - `OpportunityDecision = 'applied' | 'dismissed'`, `OpportunityTab = 'to_process' | 'applied' | 'dismissed'` ;
  - `OpportunityListItem = Opportunity & { decision: OpportunityDecision | null; jobApplicationId: string | null }` ;
  - `OpportunityListing = { items: OpportunityListItem[]; hasMore: boolean; counts: Record<OpportunityTab, number>; lastReceivedAt: Date | null; lastViewedAt: Date | null }` ;
  - `OPPORTUNITY_PAGE_SIZE = 50`, `TO_PROCESS_WINDOW_DAYS = 7`, `HISTORY_WINDOW_DAYS = 30` ;
  - `formatOpportunityRate(opportunity): string` : `rateLabel`, sinon `"min-max €/j"` ou `"N €/j"`, sinon `'Non communiqué'` ;
  - `buildJobApplicationInputFromOpportunity(opportunity: Opportunity, today: Date): JobApplicationInput` ;
  - `isOpportunityFeedStale(lastReceivedAt: Date | null, now: Date): boolean`.
- Produit (`opportunity-filters.ts`) :
  - `OpportunityFilters = { includeKeywords: string[]; alwaysExcludeKeywords: string[]; rescuableExcludeKeywords: string[]; rescueKeywords: string[]; rateFloorFullRemote: number | null; rateFloorHybrid: number | null; rateFloorOnsite: number | null; regions: string[] }` ;
  - `EMPTY_OPPORTUNITY_FILTERS` ;
  - `OpportunityMatchCandidate = Pick<Opportunity, 'title' | 'rateMin' | 'rateMax' | 'remoteMode' | 'region' | 'locationLabel'>` ;
  - `normalizeForKeywordMatch(text: string): string` : minuscules, sans accents, espaces réduits, comme `normalizeForMatch` du watcher ;
  - `buildKeywordMatcher(keywords: string[]): (normalizedText: string) => string`, port fidèle des lookarounds Unicode `(?<![\p{L}\d])…(?![\p{L}\d])` avec échappement des métacaractères ; les mots vides ou faits d'espaces sont ignorés ;
  - `createOpportunityMatcher(filters: OpportunityFilters): (candidate: OpportunityMatchCandidate) => boolean` ;
  - `validateOpportunityFilters(candidate: unknown): ActionResult<OpportunityFilters>` : chaque mot coupé aux bords, vides retirés, doublons retirés sans tenir compte de la casse, au plus 100 mots par liste et 60 caractères par mot, planchers entiers entre 0 et 5000 ou `null`, au plus 30 régions.

**Règles de `createOpportunityMatcher`** (spec §5.3, ordre du watcher) :
1. inclusion : si la liste n'est pas vide, au moins un mot est présent dans le titre ;
2. exclusion dure : mission écartée ;
3. exclusion rattrapable : mission écartée, sauf si un mot de rattrapage est présent ;
4. TJM : le TJM retenu est `rateMax ?? rateMin`. S'il est `null`, la mission passe. Le plancher dépend du mode (`full` → full remote, `partial` → hybride, `none` → sur site). Mode `null` : on prend le plus grand des planchers renseignés. Si aucun plancher n'est renseigné, la règle ne s'applique pas ;
5. régions : si la liste n'est pas vide, la mission passe si elle est en `full`, si elle n'a ni région ni lieu, ou si une région saisie (normalisée) est égale à `region` (normalisée) ou contenue dans `locationLabel` (normalisé).

**Règles de `buildJobApplicationInputFromOpportunity`** (spec §5.4) :
- `title` = titre ; `source: 'Free-Work'` ; `postingUrl` = url ; `postingRawText` = description ; `status: 'applied'` ;
- `postedDailyRate` = `rateMax ?? rateMin` ; `requestedDailyRate: null` ;
- `location` = `locationLabel` ; `remotePolicy` = libellé du mode ou `null` ; `duration` = `"N mois"` ou `null` ;
- `appliedOn: today` ; `stack` = compétences au format `{ name, category: 'other', origin: 'posting' }`, dédoublonnées sans tenir compte de la casse ;
- `intermediaryName` = `company` ; tous les autres champs à `null`.

**Règle de `isOpportunityFeedStale`** : vrai si l'heure de Paris est entre 9 h et 22 h et que `lastReceivedAt` est `null` ou date de plus de 4 h. Faux en dehors de cette plage.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
const filters = (override: Partial<OpportunityFilters>): OpportunityFilters => ({ ...EMPTY_OPPORTUNITY_FILTERS, ...override })
const candidate = (override: Partial<OpportunityMatchCandidate>): OpportunityMatchCandidate => ({ title: 'Dev React', rateMin: null, rateMax: null, remoteMode: 'partial', region: 'Île-de-France', locationLabel: 'Paris, Île-de-France', ...override })

it('shows everything when no filter is set', () => {
  expect(createOpportunityMatcher(EMPTY_OPPORTUNITY_FILTERS)(candidate({ title: 'Plombier' }))).toBe(true)
})
it('matches whole words only, accents and case ignored', () => {
  const matcher = createOpportunityMatcher(filters({ includeKeywords: ['java', 'IA'] }))
  expect(matcher(candidate({ title: 'Dev JavaScript' }))).toBe(false)
  expect(matcher(candidate({ title: 'Spécialiste data' }))).toBe(false)
  expect(matcher(candidate({ title: 'Ingénieur ia générative' }))).toBe(true)
})
it.each([['c#', 'Dev C# senior'], ['.net', 'Lead .NET Core'], ['node.js', 'Backend Node.js'], ['c++', 'Dev C++ embarqué']])('matches %s literally', (keyword, title) => {
  expect(createOpportunityMatcher(filters({ includeKeywords: [keyword] }))(candidate({ title }))).toBe(true)
})
it('rescues a rescuable exclusion but never a hard exclusion', () => {
  const matcher = createOpportunityMatcher(filters({ rescuableExcludeKeywords: ['java'], rescueKeywords: ['react'], alwaysExcludeKeywords: ['stage'] }))
  expect(matcher(candidate({ title: 'Dev Fullstack React / Java' }))).toBe(true)
  expect(matcher(candidate({ title: 'Dev Java Spring' }))).toBe(false)
  expect(matcher(candidate({ title: 'Stage React' }))).toBe(false)
})
it('applies the rate floor of the remote mode, unknown mode takes the strictest, unknown rate passes', () => {
  const matcher = createOpportunityMatcher(filters({ rateFloorFullRemote: 400, rateFloorHybrid: 450, rateFloorOnsite: 500 }))
  expect(matcher(candidate({ remoteMode: 'full', rateMax: 420 }))).toBe(true)
  expect(matcher(candidate({ remoteMode: 'partial', rateMin: 300, rateMax: 440 }))).toBe(false)
  expect(matcher(candidate({ remoteMode: null, rateMax: 480 }))).toBe(false)
  expect(matcher(candidate({ remoteMode: 'none', rateMin: null, rateMax: null }))).toBe(true)
})
it('matches regions on region or location label, full remote always passes', () => {
  const matcher = createOpportunityMatcher(filters({ regions: ['paris'] }))
  expect(matcher(candidate({ region: 'Île-de-France', locationLabel: 'Paris 8e' }))).toBe(true)
  expect(matcher(candidate({ region: 'Auvergne-Rhône-Alpes', locationLabel: 'Lyon' }))).toBe(false)
  expect(matcher(candidate({ region: 'Bretagne', locationLabel: 'Rennes', remoteMode: 'full' }))).toBe(true)
  expect(matcher(candidate({ region: null, locationLabel: null }))).toBe(true)
  expect(createOpportunityMatcher(filters({ regions: ['ile-de-france'] }))(candidate({ region: 'Île-de-France', locationLabel: null }))).toBe(true)
})
it('drops blank and duplicate keywords on validation', () => {
  const result = validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: ['  React ', 'react', '   ', ''] })
  expect(result).toEqual({ ok: true, data: expect.objectContaining({ includeKeywords: ['React'] }) })
})
```

Tests de `opportunities.test.ts` :
- `buildJobApplicationInputFromOpportunity` donne exactement les valeurs des règles ci-dessus, pour une opportunité complète et pour une opportunité sans aucun champ optionnel ;
- `isOpportunityFeedStale` est vrai à 15 h Paris avec une dernière réception à 10 h 30, faux à 15 h avec une réception à 12 h, faux à 23 h 30 avec une réception à 10 h, et vrai à 10 h avec `null` ;
- `formatOpportunityRate` couvre les quatre cas.

Ajouter ces deux fichiers à `test:tz`.

- [ ] **Step 2 :** `npm test -- opportunit`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter selon les signatures et les règles ci-dessus.
- [ ] **Step 4 :** `npm test -- opportunit && npm run test:tz`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(domain): add opportunity filters matcher and application conversion`.

---

### Task 3 (F) : Point d'entrée de réception `POST /api/opportunities/ingest`

**Files :**
- Create : `src/app/api/opportunities/ingest/route.ts`, `src/domain/opportunity-ingest-payload.ts`, `src/server/repositories/opportunities-repository.ts` (fonctions d'écriture)
- Create : `src/server/security/is-authorized-bearer-request.ts`, extraite du cron de sauvegarde, que le cron réutilise
- Modify : `src/app/api/cron/backup/route.ts`, `.env.example` (`OPPORTUNITIES_INGEST_TOKEN`)
- Test : `src/app/api/opportunities/ingest/route.test.ts`, `src/domain/opportunity-ingest-payload.test.ts`, `tests/integration/opportunities-ingest.test.ts`

**Interfaces :**
- Consomme : Tâche 2 (`normalizeForKeywordMatch`, `RemoteMode`) ; le client service role (`createServiceRoleSupabaseClient`).
- Produit :
  - `isAuthorizedBearerRequest(request: Request, expectedSecret: string | undefined): boolean` : comparaison sha256 avec `timingSafeEqual`, et refus si le secret attendu n'est pas défini ;
  - `MAX_MISSIONS_PER_INGEST = 100` ;
  - `parseIngestPayload(body: unknown): { missions: IngestMission[]; skippedInvalid: number } | { error: string }`, où `IngestMission` reprend la forme `Mission` du watcher plus `source: 'free-work'`. `remoteMode: ''` devient `null`. Un tableau de plus de 100 missions donne `{ error }`. Une mission invalide est comptée dans `skippedInvalid` sans faire échouer les autres ;
  - `upsertOpportunities(serviceClient, missions: IngestMission[]): Promise<number>` : upsert sur `(source, external_id)` qui ne modifie jamais `received_at` à la mise à jour, et calcule `title_normalized` ;
  - `purgeOpportunitiesPublishedBefore(serviceClient, cutoff: Date): Promise<number>` ;
  - la route `POST` répond :
    - 401 si le jeton est absent ou faux ;
    - 400 si le JSON est invalide, ou s'il y a trop de missions (`{ error }`) ;
    - 200 sinon, avec `{ received, upserted, skippedInvalid, purged }`.

- [ ] **Step 1 : Tests qui échouent**
  - **Payload :**
    - 101 missions donnent `error` ;
    - une mission sans `id` ni `url` est comptée dans `skippedInvalid` et les autres passent ;
    - `remoteMode: ''` devient `null` ;
    - `publishedAt` invalide est compté invalide.
  - **Route (dépendances simulées) :**
    - sans en-tête, ou avec un mauvais jeton : 401 ;
    - `OPPORTUNITIES_INGEST_TOKEN` absent : 401 et `console.error` ;
    - un corps valide renvoie les compteurs ;
    - la purge est appelée avec la date de maintenant moins 30 jours.
  - **Intégration (Supabase local) :**
    - le même lot envoyé deux fois donne une seule ligne par mission ;
    - un renvoi avec un TJM modifié met à jour `rate_max` sans changer `received_at`, et une décision existante sur cette mission est toujours là ;
    - une mission publiée il y a 31 jours est purgée, ainsi que sa décision.
  - **Cron de sauvegarde :** ses tests existants passent toujours avec le helper extrait.
- [ ] **Step 2 :** `npm test -- ingest && npm run test:integration -- opportunities-ingest`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. La route lit le corps avec `request.json()` dans un `try`, n'utilise que le service role, et ne journalise jamais le jeton ni le contenu des missions (seulement les compteurs). Exporter `maxDuration = 60`.
- [ ] **Step 4 :** Relancer (et `npm test -- cron/backup`). Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(opportunities): add authenticated idempotent ingest endpoint`.

---

### Task 4 (F) : Lecture, décisions et filtres (repositories et actions)

**Files :**
- Modify : `src/server/repositories/opportunities-repository.ts` (fonctions de lecture)
- Create : `src/server/repositories/opportunity-decisions-repository.ts`, `src/server/repositories/opportunity-filters-repository.ts`, `src/server/actions/opportunity-actions.ts`
- Test : `tests/integration/opportunity-actions.test.ts` (repositories), `src/server/actions/opportunity-actions.test.ts`

**Interfaces :**
- Consomme : Tâche 2 (types, `createOpportunityMatcher`, `buildJobApplicationInputFromOpportunity`, constantes), `insertJobApplication(supabase, userId, input)` (`job-applications-repository.ts`), `runAuthenticatedOperation`.
- Produit (actions `'use server'`) :
  - `listOpportunities(tab: OpportunityTab, page: number): Promise<ActionResult<OpportunityListing>>`. Deux temps :
    1. charger les métadonnées légères (`id, title, rate_min, rate_max, remote_mode, region, location_label, published_at`) des 7 derniers jours pour « À traiter », ou des 30 derniers jours pour les autres onglets, plus les décisions de l'utilisateur ;
    2. appliquer le filtre de l'utilisateur, puis charger les lignes complètes de la page demandée.

    Les `counts` reflètent les trois onglets. Tri par `published_at` décroissant.
  - `countOpportunitiesToProcess(): Promise<ActionResult<number>>` ;
  - `applyToOpportunity(opportunityId: string): Promise<ActionResult<{ jobApplicationId: string }>>`. Idempotent :
    - si une décision `applied` existe déjà avec une candidature, renvoie cet identifiant sans rien créer ;
    - sinon, crée la candidature, puis la décision (upsert sur `(user_id, opportunity_id)`) ;
    - si la décision échoue après la création, journalise l'erreur et renvoie quand même l'identifiant.
  - `dismissOpportunity(opportunityId: string)` et `restoreOpportunity(opportunityId: string)`, qui renvoient `Promise<ActionResult<null>>` ;
  - `markOpportunitiesViewed(): Promise<ActionResult<null>>` ;
  - `getOpportunityFilters(source: OpportunitySource): Promise<ActionResult<OpportunityFilters>>` : `EMPTY_OPPORTUNITY_FILTERS` s'il n'y a aucune ligne ;
  - `saveOpportunityFilters(source: OpportunitySource, filters: unknown): Promise<ActionResult<OpportunityFilters>>` ;
  - `listKnownOpportunityRegions(): Promise<ActionResult<string[]>>` : régions distinctes non vides des 30 derniers jours, triées.

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration :**
    - avec des filtres `includeKeywords: ['react']`, « À traiter » ne contient que les missions React des 7 derniers jours ;
    - une mission publiée il y a 10 jours n'apparaît pas dans « À traiter » ;
    - `applyToOpportunity` appelé deux fois donne une seule candidature (statut `applied`, source `Free-Work`) et le même `jobApplicationId` ;
    - une mission ignorée sort de « À traiter » et apparaît dans « Ignorées » ; `restoreOpportunity` la remet ;
    - B ne voit pas les décisions ni les filtres de A, et `applyToOpportunity` de B sur une opportunité réelle crée une candidature chez B uniquement ;
    - un identifiant inexistant donne `ok: false` avec `'Opportunité introuvable'`.
  - **Unitaires :**
    - un identifiant qui n'est pas un UUID est refusé sans appel à la base ;
    - `saveOpportunityFilters` refuse un plancher négatif.
- [ ] **Step 2 :** `npm run test:integration -- opportunity-actions && npm test -- opportunity-actions`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(opportunities): add listing, decisions and per-source filters actions`.

---

### Task 5 (F) : Réglages → Opportunités → Free-Work

**Files :**
- Create : `src/app/(app)/settings/opportunites/free-work/page.tsx`, `src/components/opportunity-filters-form/*`, `src/components/keyword-tags-input/*`, `src/components/settings-navigation/*`
- Modify : `src/app/(app)/settings/page.tsx` (lien vers la navigation des réglages)
- Test : `src/components/opportunity-filters-form/controller.test.tsx`, `src/components/keyword-tags-input/controller.test.tsx`

**Interfaces :**
- Consomme : Tâche 4 (`getOpportunityFilters`, `saveOpportunityFilters`, `listKnownOpportunityRegions`), Tâche 2 (`OpportunityFilters`, `validateOpportunityFilters`).
- Produit :
  - `KeywordTagsInput`, avec les props `{ label: string; helpText: string; values: string[]; onChange: (values: string[]) => void; suggestions?: string[] }` ;
  - la navigation des réglages, avec « Profil » (`/settings`) et « Opportunités · Free-Work » (`/settings/opportunites/free-work`).

**Libellés et aides** (exacts) :
- **« Doit contenir au moins un de »** — aide : « Une mission doit avoir au moins un de ces mots dans son titre. Vide = pas de contrainte. »
- **« Exclure toujours »** — aide : « Écarte la mission dès qu'un de ces mots est dans le titre (ex. stage, alternance). »
- **« Exclure, sauf si rattrapé »** — aide : « Écarte la mission, sauf si elle contient aussi un mot de rattrapage (ex. java). »
- **« Mots de rattrapage »** — aide : « Garde une mission exclue ci-dessus si elle contient un de ces mots (ex. react). »
- **TJM minimum** : « Full remote », « Hybride », « Sur site » (en €/j, vide = pas de minimum).
- **« Régions »** — aide : « La mission doit être dans une de ces régions ou villes (ex. Île-de-France, Paris). Le full remote passe toujours. »

Message en haut du formulaire : « Sans aucun filtre, toutes les missions Free-Work s'affichent. »

- [ ] **Step 1 : Tests qui échouent**
  - **`keyword-tags-input` :**
    - Entrée ou virgule ajoute le mot ;
    - un mot vide ou fait d'espaces est ignoré ;
    - un doublon (casse ignorée) n'est pas ajouté ;
    - Retour arrière sur un champ vide retire le dernier mot.
  - **`opportunity-filters-form` :**
    - l'enregistrement envoie les filtres validés ;
    - un plancher « abc » est refusé avec « Montant invalide » ;
    - le succès appelle `onDataChanged` ;
    - une exception affiche `GENERIC_ACTION_ERROR_MESSAGE` ;
    - le bouton est désactivé pendant l'envoi.
- [ ] **Step 2 :** `npm test -- opportunity-filters-form keyword-tags-input`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(settings): add free-work opportunity filters page`.

---

### Task 6 (F) : Page « Mes opportunités » et navigation

**Files :**
- Create : `src/app/(app)/opportunites/page.tsx`, `src/components/opportunities-board/*`, `src/components/opportunity-card/*`, `src/components/opportunity-feed-freshness/*`
- Modify : `src/components/app-shell/*` (entrée « Opportunités » entre « Candidatures » et « Calendrier », avec le compteur « À traiter »), `src/app/(app)/layout.tsx` (charge `countOpportunitiesToProcess`)
- Test : `src/components/opportunities-board/controller.test.tsx`, `src/components/opportunity-card/opportunity-card.test.tsx`, `src/components/opportunity-feed-freshness/opportunity-feed-freshness.test.tsx`

**Interfaces :**
- Consomme : Tâche 4 (toutes les actions de lecture et de décision), Tâche 2 (`formatOpportunityRate`, `REMOTE_MODE_LABELS`, `isOpportunityFeedStale`, `OpportunityTab`).
- Produit : la route `/opportunites`, avec `?tab=to_process|applied|dismissed`.

**Comportement :**
- **Onglets :** « À traiter (n) », « Postulées (n) », « Ignorées (n) ».
- **Carte :**
  - titre, entreprise, TJM, présentiel, lieu, durée (« N mois »), publication (« aujourd'hui à 16h32 », sinon « jj/mm à 16h32 », heure de Paris) ;
  - description sur 3 lignes, dépliable ;
  - badge « nouveau » si `receivedAt > lastViewedAt` (valeur lue **avant** l'appel à `markOpportunitiesViewed`, que la page déclenche une fois au montage).
- **Boutons :**
  - « Voir sur Free-Work » : lien `target="_blank" rel="noopener noreferrer"`, http et https uniquement ;
  - « J'ai postulé » : affiche ensuite « Candidature créée · Voir la candidature » avec un lien vers `/candidatures/<id>` ;
  - « Pas intéressé » ;
  - dans « Ignorées », « Remettre » ;
  - dans « Postulées », « Voir la candidature ».
- **« Voir plus »** charge la page suivante (50 par page).
- **Indicateur de fraîcheur :**
  - « Dernière réception il y a X », avec le style d'avertissement et le texte « Aucune mission reçue depuis plus de 4 h : vérifie le watcher. » quand `isOpportunityFeedStale` est vrai ;
  - « Aucune mission reçue pour l'instant. » si `null`.
- **États vides :**
  - « À traiter » vide avec des filtres : « Rien de nouveau qui correspond à tes filtres. », avec un lien vers les réglages Free-Work ;
  - « À traiter » vide sans aucune mission reçue : le message de l'indicateur.

- [ ] **Step 1 : Tests qui échouent**
  - **Contrôleur :**
    - « J'ai postulé » appelle `applyToOpportunity` une seule fois malgré deux clics, puis expose `jobApplicationId` et appelle `onDataChanged` ;
    - « Pas intéressé » retire la carte de façon optimiste, puis la remet en cas d'échec avec le message d'erreur ;
    - une exception affiche `GENERIC_ACTION_ERROR_MESSAGE` ;
    - « Voir plus » ajoute la page 2 ;
    - changer d'onglet recharge la page 1.
  - **Carte :**
    - pas de lien pour une URL `javascript:` ;
    - affiche « Non communiqué » ;
    - affiche le badge « nouveau » selon `lastViewedAt`.
  - **Fraîcheur :** avertissement à 15 h avec une réception à 10 h (fausse horloge, heure de Paris).
- [ ] **Step 2 :** `npm test -- opportunities-board opportunity-card opportunity-feed-freshness`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): add my opportunities page with freshness indicator`.

---

### Task 7 (F) : Export, sauvegarde et restauration

**Files :**
- Modify : `src/server/data-snapshot/build-user-data-snapshot.ts`, `scripts/restore-user-data-snapshot.ts`
- Test : `tests/integration/data-snapshot.test.ts` (ajouts)

**Interfaces :**
- `UserDataSnapshot` gagne deux champs :
  - `opportunityFilters: Tables<'opportunity_filters'>[]` ;
  - `opportunityDecisions: { source: string; externalId: string; decision: OpportunityDecision; jobApplicationId: string | null; decidedAt: string }[]`, avec la mission référencée par `(source, externalId)` et non par l'id interne.
- La table commune `opportunities` n'est **pas** incluse.

- [ ] **Step 1 : Tests qui échouent**
  - **Aller-retour :** les filtres et les décisions sont restaurés à l'identique quand l'opportunité existe encore.
  - Une décision dont l'opportunité n'existe plus est ignorée, sans faire échouer la restauration.
  - Le snapshot d'un utilisateur ne contient aucune décision ni aucun filtre d'un autre.
  - Les garde-fous existants (`user_id` étranger, identifiant réutilisé) s'appliquent aussi aux nouvelles tables.
- [ ] **Step 2 :** `npm run test:integration -- data-snapshot`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(backup): include opportunity filters and decisions`.

---

### Task 8 (F) : Documentation Freeclutch et vérification

**Files :**
- Modify : `README.md` (variable `OPPORTUNITIES_INGEST_TOKEN` dans les tableaux local et Vercel ; section « Opportunités » expliquant le point d'entrée, son jeton, et que le watcher career-ops l'alimente)

- [ ] **Step 1 :** Mettre à jour le README. Le jeton se génère avec `openssl rand -hex 32` et la **même valeur** va dans Vercel et dans le secret GCP `freeclutch-ingest-token`.
- [ ] **Step 2 :** `npm run lint && npm run typecheck && npm test && npm run test:tz && npm run test:integration && npm run build`. Attendu : tout passe.
- [ ] **Step 3 :** Commit `docs: document the opportunities ingest token`.

---

### Task 9 (W) : Récupération Free-Work sur 7 jours

**Files :**
- Modify : `src/free-work.mjs`, `src/time.mjs` si un utilitaire de date manque
- Test : `tests/free-work.test.mjs`

**Interfaces :**
- Produit : `fetchMissionsPublishedSince({ sinceDateKey, timeZone, maxPages, fetchJson }) => Promise<{ missions: Mission[], pagesFetched: number, reachedPageCap: boolean }>`.
  - Garde les missions dont la date de publication (Paris) est égale ou postérieure à `sinceDateKey`.
  - S'arrête à la première page qui contient une mission plus ancienne, ou au plafond de pages.
  - Réutilise `normalizeMission` et l'API existante.
  - `fetchMissionsPublishedOn` reste inchangée.

- [ ] **Step 1 : Tests qui échouent** (`fetchJson` simulé)
  - 3 pages couvrant 9 jours avec `sinceDateKey` à J-6 : seules les missions de J-6 à J sont gardées, et la lecture s'arrête après la page qui franchit la limite ;
  - le plafond à 2 pages donne `reachedPageCap: true` ;
  - les missions publiées autour de minuit sont classées selon leur date à Paris.
- [ ] **Step 2 :** `npm test`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** `npm test`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(free-work): fetch missions over a multi-day window`.

---

### Task 10 (W) : Mémoire des missions livrées à Freeclutch

**Files :**
- Modify : `src/state.mjs`
- Test : `tests/state.test.mjs`

**Interfaces :**
- Produit :
  - `createGcsDeliveredStore({ bucketName, storage, objectName = 'sent-freeclutch/delivered.json', retentionDays = 8 })` ;
  - `createMemoryDeliveredStore(initial = {})` ;
  - les deux exposent `load(): Promise<{ delivered: Map<string, string>, generation: number }>` (identifiant Free-Work → date de publication) et `markDelivered(entries: { id: string, dateKey: string }[], todayDateKey: string): Promise<void>`.
- `markDelivered` fusionne avec la dernière version (même schéma `ifGenerationMatch` et nouvel essai sur 412 que `createGcsSentStore`), puis élague les entrées publiées plus de 8 jours avant `todayDateKey`.
- Un objet absent équivaut à vide. C'est le cas après le cycle de vie du bucket (7 jours sans écriture) : la semaine est alors renvoyée, ce qui est sans risque grâce à l'enregistrement idempotent côté Freeclutch.

- [ ] **Step 1 : Tests qui échouent**
  - les entrées marquées sont présentes ;
  - l'élagage retire une entrée de J-9 ;
  - un conflit 412 simulé fusionne les deux versions ;
  - un objet absent donne une Map vide.
- [ ] **Step 2 :** `npm test`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** `npm test`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(state): track missions delivered to freeclutch`.

---

### Task 11 (W) : Envoi des missions à Freeclutch

**Files :**
- Create : `src/freeclutch.mjs`
- Test : `tests/freeclutch.test.mjs`

**Interfaces :**
- Produit : `postMissionsToFreeclutch({ ingestUrl, token, missions, onBatchDelivered, fetchImpl = fetch, sleepImpl, batchSize = 100 }) => Promise<{ batchesSent: number, missionsSent: number }>`.
  - Corps de chaque requête : `{ missions: [...mission, source: 'free-work'] }`, en-tête `Authorization: Bearer <token>`.
  - `await onBatchDelivered(batch)` après chaque paquet réussi.
  - 429 (en respectant `Retry-After`) et 5xx : jusqu'à 4 essais avec attente croissante, comme `discord.mjs`.
  - Les autres 4xx lèvent immédiatement une erreur qui contient le statut, jamais le jeton.

- [ ] **Step 1 : Tests qui échouent**
  - 230 missions donnent 3 requêtes de 100, 100 et 30, et 3 appels à `onBatchDelivered` ;
  - l'en-tête Bearer est présent ;
  - un 503 puis un 200 réussit ;
  - un 401 lève une erreur sans réessayer ;
  - un échec du 2e paquet lève une erreur après un seul `onBatchDelivered`.
- [ ] **Step 2 :** `npm test`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** `npm test`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(freeclutch): post missions to the freeclutch ingest endpoint`.

---

### Task 12 (W) : Branchement dans le passage du watcher et configuration

**Files :**
- Modify : `src/config.mjs`, `src/run-scan.mjs`, `index.mjs`, `scripts/local-dry-run.mjs`, `.env.example`
- Test : `tests/run-scan.test.mjs`, `tests/config.test.mjs` (à créer si absent)

**Interfaces :**
- `loadConfig` ajoute `freeclutch: { ingestUrl, token, maxPages, lookbackDays, enabled }`, lu depuis les variables suivantes :
  - `FREECLUTCH_INGEST_URL` et `FREECLUTCH_INGEST_TOKEN` (`enabled` exige les deux) ;
  - `FREECLUTCH_MAX_PAGES`, 120 par défaut ;
  - `FREECLUTCH_LOOKBACK_DAYS`, 7 par défaut.
- Le webhook Discord devient optionnel : sans `DISCORD_WEBHOOK_URL`, le parcours Discord et `postAlert` ne font rien.
- `runScan` accepte en injection `postToFreeclutch = postMissionsToFreeclutch` et `deliveredStore`. Le parcours Freeclutch :
  1. `fetchMissionsPublishedSince` sur J-6 à J (Paris), avec le plafond Freeclutch ;
  2. retire les missions déjà livrées ;
  3. envoie, avec `onBatchDelivered` qui appelle `markDelivered` ;
  4. si le plafond de pages est atteint, `console.warn` avec le nombre de pages.
- Une erreur du parcours Freeclutch est attrapée : `console.error` sans le jeton. Le passage ne lève pas d'erreur pour autant, et le parcours Discord (s'il est configuré) s'exécute quand même.
- Le récapitulatif renvoyé contient `freeclutch: { fetched, alreadyDelivered, sent, pagesFetched, reachedPageCap, error? }`.
- Le mode test (`dryRun`) liste le nombre et les 10 premiers titres qui seraient envoyés, sans rien envoyer ni enregistrer.

- [ ] **Step 1 : Tests qui échouent** (dépendances simulées, mémoire en RAM)
  - sans Discord configuré, le passage envoie à Freeclutch et ne poste rien sur Discord ;
  - une mission déjà livrée n'est pas renvoyée ;
  - le 2e paquet sur 3 échoue : le 1er reste marqué, le passage se termine sans exception avec `freeclutch.error`, et au passage suivant seuls les paquets 2 et 3 partent ;
  - `dryRun` n'appelle ni `postToFreeclutch` ni `markDelivered` ;
  - la configuration désactive Freeclutch si le jeton manque.
- [ ] **Step 2 :** `npm test`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** `npm test && npm run dry-run` (le dry-run local doit lister des missions réelles sans rien envoyer). Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(watcher): deliver all weekly missions to freeclutch, discord optional`.

---

### Task 13 (W) : Script de déploiement et documentation du watcher

**Files :**
- Modify : `deploy.sh`, `DEPLOIEMENT.md`

- [ ] **Step 1 :** Modifier `deploy.sh` :
  - il exige `FREECLUTCH_INGEST_TOKEN`, crée ou met à jour le secret `freeclutch-ingest-token`, accorde l'accès au compte `free-work-watcher-run`, et le monte en `FREECLUTCH_INGEST_TOKEN` ;
  - il ajoute `FREECLUTCH_INGEST_URL` (par défaut `https://freeclutch.vercel.app/api/opportunities/ingest`) aux variables ;
  - il passe `--timeout=300s` ;
  - il ne monte le secret Discord que si `DISCORD_WEBHOOK_URL` est fourni ;
  - le script reste idempotent ;
  - le jeton n'est jamais affiché (pas de `set -x` sur ces lignes).
- [ ] **Step 2 :** `bash -n deploy.sh`. Attendu : aucune erreur de syntaxe.
- [ ] **Step 3 :** Ajouter à `DEPLOIEMENT.md` une section « Freeclutch » : génération du jeton, même valeur dans Vercel, commande de déploiement, vérification par `?dryRun=1`, lecture des logs, et le fait que le flux Discord `dev` est arrêté.
- [ ] **Step 4 :** Commit `chore(deploy): ship freeclutch delivery and drop dev discord`.

---

### Task 14 : Mise en production (avec le feu vert du porteur, étape par étape)

Cette tâche n'est **pas** confiée à un sous-agent. Le contrôleur demande l'accord du porteur avant chaque point :

1. Le porteur fait `git push` sur Freeclutch (le dépôt career-ops n'a pas besoin d'être poussé pour `deploy.sh`).
2. `npx supabase db push`, après un `--dry-run` montré au porteur.
3. Générer le jeton (`openssl rand -hex 32`) sans l'afficher, puis l'envoyer directement :
   - à `vercel env add OPPORTUNITIES_INGEST_TOKEN production` ;
   - à `deploy.sh`, via la variable d'environnement de la commande.
4. Déployer Freeclutch sur Vercel, puis vérifier que `POST /api/opportunities/ingest` sans jeton renvoie 401.
5. Lancer `deploy.sh` (projet GCP `career-ops-rk`), puis appeler la fonction avec `?dryRun=1` et montrer le récapitulatif.
6. Lancer un passage réel (via Cloud Scheduler « Forcer l'exécution », ou l'URL authentifiée), puis vérifier les compteurs dans les logs et que « Mes opportunités » affiche la semaine.
