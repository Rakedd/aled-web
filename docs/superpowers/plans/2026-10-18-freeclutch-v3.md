# Freeclutch V3 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Livrer les quatre lots de la V3 :
1. la stack reprise sur « J'ai postulé » ;
2. la préparation d'entretien (brief par langue en modale, questions à poser) ;
3. la fiche candidature en lecture avec crayons par bloc et la suppression ;
4. la navigation, la page d'accueil et la recherche dans « Mes opportunités ».

**Architecture :** On s'appuie sur l'existant :
- extraction IA de stack (`extractJobSpecStack`) ;
- génération de brief (`generateClientBrief`) ;
- actions via `runAuthenticatedOperation` ;
- repositories `(supabase, userId, …)` ;
- contrôleurs `useController` avec actions injectées.

Nouveautés côté données : les briefs passent par langue dans une table dédiée, et les questions d'entretien sont rangées par candidature et par langue. Chaque lot se déploie seul.

**Tech Stack :** Next.js (App Router), TypeScript, Supabase, `@anthropic-ai/sdk`, `react-markdown`, Jest et React Testing Library.

**Spec :** [docs/superpowers/specs/2026-10-18-freeclutch-v3-design.md](../specs/2026-10-18-freeclutch-v3-design.md)

## Global Constraints

- **Les Global Constraints des plans V1 et V2 s'appliquent toutes :**
  - `docs/superpowers/plans/2026-10-17-freeclutch-v1.md` ;
  - `docs/superpowers/plans/2026-10-18-mes-opportunites.md`.

  En résumé :
  - aucun `any`, fonctions fléchées, exports nommés ;
  - un dossier kebab-case par composant, avec `controller.tsx` et `useController` ;
  - pas de `console.log` ni de commentaires, `server-only` dans `src/server` ;
  - types partagés dans `src/domain` ;
  - les fichiers `'use server'` n'exportent que des actions ;
  - filtre `user_id` en plus de la RLS ;
  - contrôleurs : `GENERIC_ACTION_ERROR_MESSAGE` sur exception, `onDataChanged` vers `router.refresh()`, garde contre le double clic ;
  - Europe/Paris ;
  - textes d'interface en français ;
  - style du dépôt : guillemets simples, sans point-virgule.
- **Migrations additives**, compatibles avec les données en production. Ne jamais modifier une migration existante.
- **Modèles :**
  - brief : `CLAUDE_MODELS.brief` avec recherche web, budget existant de 240 s ;
  - questions et extraction de stack : `CLAUDE_MODELS.extraction`, sans recherche web.
- **Langues :** `BRIEF_LANGUAGES = ['fr', 'en'] as const`, avec `fr` par défaut.
- **Questions :** entre **8 et 10** par génération.
- **Accueil :** au plus **5** rappels, **3** prochains rendez-vous et **2** missions intéressantes, publiées depuis moins de **48 h** et triées par TJM décroissant (TJM non communiqué en dernier).
- **Recherche :** titre, entreprise et lieu, sans tenir compte de la casse ni des accents ; saisie différée de **300 ms**.
- **Git :** commit sur `main`, jamais de push ni de branche, aucune mention d'IA. Aucune action sur la production avant les points de déploiement, faits par le contrôleur avec l'accord du porteur.

## Review Focus

1. **« J'ai postulé » sans clé Claude, ou avec une IA en échec ou trop lente :** la candidature est quand même créée (sans stack ou avec les compétences Free-Work), sans erreur visible. → Tâche 1.
2. **Brief déjà présent pour le client dans la langue choisie :** « Générer le brief » ne relance pas la recherche web et ne génère que les questions. → Tâche 4.
3. **Suppression d'une candidature qui a une fiche métier en PDF et vient d'une opportunité :** le PDF est retiré du stockage, la mission revient dans « À traiter », et la suppression d'une candidature d'un autre utilisateur est refusée. → Tâche 6.
4. **Saisie en cours dans un bloc pendant un `router.refresh()`** (par exemple après « Noter un échange ») : la saisie n'est pas écrasée. → Tâche 7.
5. **Anciennes adresses `/settings` et `/settings/opportunites/free-work` gardées en favori :** elles redirigent vers `/preferences/...`. → Tâche 8.

---

## Lot 1 — La stack sur « J'ai postulé »

### Task 1 : Extraction de la stack au clic sur « J'ai postulé »

**Files :**
- Modify : `src/server/opportunities/apply-to-opportunity.ts`, `src/app/(app)/opportunites/page.tsx` (`maxDuration = 60`)
- Create : `src/server/opportunities/extract-opportunity-stack.ts`
- Test : `src/server/opportunities/extract-opportunity-stack.test.ts`, `src/server/opportunities/apply-to-opportunity.test.ts` (ajouts)

**Interfaces :**
- Consomme :
  - `extractJobSpecStack(client, { kind: 'text', text })` (`src/server/ai/extract-job-spec-stack.ts`) ;
  - `createAnthropicClient`, `getDecryptedAnthropicApiKeyForUser(userId)`, `describeAiErrorForLogs` ;
  - `buildJobApplicationInputFromOpportunity`, `MAXIMUM_STACK_ITEM_COUNT`, `MAXIMUM_STACK_ITEM_NAME_LENGTH`.
- Produit :
  - `extractOpportunityStack(dependencies: { getApiKey: () => Promise<string | null>; extract: (apiKey: string, description: string) => Promise<StackItem[]> }, description: string | null): Promise<StackItem[]>`. Elle renvoie `[]` sans clé, sans description, ou en cas d'erreur (avec `console.error` du seul type d'erreur). Les éléments renvoyés ont `origin: 'posting'`.
  - `mergeStackItems(base: StackItem[], extra: StackItem[]): StackItem[]` dans `src/domain/opportunities.ts` : fusion sans doublon (comparaison avec `normalizeForKeywordMatch`), en gardant l'ordre de `base`, plafonnée aux limites existantes.

- [ ] **Step 1 : Tests qui échouent**
  - `mergeStackItems` :
    - `[React]` et `[react, TypeScript]` donnent `[React, TypeScript]` ;
    - 150 éléments sont plafonnés à `MAXIMUM_STACK_ITEM_COUNT`.
  - `extractOpportunityStack` :
    - sans clé, renvoie `[]` sans appeler `extract` ;
    - si `extract` lève une erreur, renvoie `[]` et appelle `console.error` sans la description ;
    - un résultat d'origine `job_spec` est converti en `posting`.
  - `applyToOpportunityForUser` : la candidature créée contient la stack extraite, fusionnée avec les compétences Free-Work. Si l'extraction échoue, la candidature est créée quand même (`ok: true`).
- [ ] **Step 2 :** `npm test -- extract-opportunity-stack apply-to-opportunity opportunities`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. L'extraction se fait dans `applyToOpportunityForUser`, avant l'insertion, **seulement** si aucune candidature n'existe déjà pour cette décision : le chemin idempotent ne relance pas l'IA. Appel avec `maxRetries: 1` et un délai de 30 s.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `fix(opportunities): extract the stack from the posting when applying`.

> **Déploiement lot 1** (contrôleur, avec l'accord du porteur) : `git push` par le porteur, puis vérifier que Vercel est passé en « Ready ».

---

## Lot 2 — Préparation d'entretien

### Task 2 : Données — briefs par langue et questions d'entretien

**Files :**
- Create : `supabase/migrations/20261019000000_briefs_by_language_and_interview_questions.sql`
- Modify : `src/server/supabase/database-types.ts` (régénéré), `src/server/data-snapshot/build-user-data-snapshot.ts`, `scripts/restore-user-data-snapshot.ts`
- Create : `src/domain/interview-preparation.ts`
- Test : `tests/integration/interview-preparation-isolation.test.ts`, `tests/integration/data-snapshot.test.ts` (ajouts)

**Interfaces :**
- Produit (SQL) :
  - **`end_client_briefs`** : `id`, `user_id`, `end_client_id` (clé composite même propriétaire, `on delete cascade`), `language text check in ('fr','en')`, `markdown text not null`, `sources jsonb not null default '[]'`, `generated_at timestamptz not null`, avec la contrainte `unique (user_id, end_client_id, language)` ;
  - **`interview_questions`** : `id`, `user_id`, `job_application_id` (clé composite, `on delete cascade`), `language`, `questions jsonb not null` (tableau de chaînes), `generated_at`, avec la contrainte `unique (user_id, job_application_id, language)` ;
  - RLS sur les deux tables : quatre politiques par utilisateur, `revoke` pour `anon` ;
  - **reprise des données** : chaque `end_clients` qui a un `brief_markdown` non nul donne une ligne `language = 'fr'`. Les colonnes `brief_*` de `end_clients` sont **conservées** (non supprimées) mais plus lues.
- Produit (domaine, `interview-preparation.ts`) :
  - `BRIEF_LANGUAGES`, `BriefLanguage`, `BRIEF_LANGUAGE_LABELS = { fr: 'Français', en: 'English' }` ;
  - `isBriefLanguage(candidate: unknown): candidate is BriefLanguage` ;
  - `MIN_INTERVIEW_QUESTIONS = 8`, `MAX_INTERVIEW_QUESTIONS = 10` ;
  - `InterviewQuestions = { language: BriefLanguage; questions: string[]; generatedAt: Date }` ;
  - `LanguageBrief = { language: BriefLanguage; markdown: string; sources: ClientBriefSource[]; generatedAt: Date }`.
- **Sauvegarde** : le snapshot gagne `endClientBriefs` et `interviewQuestions` (lignes brutes). Un ancien snapshot sans ces champs reste restaurable. La restauration vérifie l'appartenance à l'utilisateur, comme pour les autres tables.

- [ ] **Step 1 : Tests d'intégration qui échouent**
  - B ne lit, ne modifie et n'insère pas de brief ni de questions pour A ;
  - pas de deuxième brief `fr` pour le même client ;
  - la reprise des données transforme un brief existant en ligne `fr` ;
  - supprimer la candidature supprime ses questions ;
  - l'aller-retour du snapshot inclut les deux tables.
- [ ] **Step 2 :** `npx supabase db reset && npm run test:integration -- interview-preparation-isolation data-snapshot`. Attendu : FAIL.
- [ ] **Step 3 :** Écrire la migration, puis `npm run db:types`, puis mettre à jour le snapshot et la restauration.
- [ ] **Step 4 :** Relancer, puis `npm run typecheck`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(db): store briefs by language and interview questions`.

### Task 3 : IA — brief dans la langue choisie et questions d'entretien

**Files :**
- Modify : `src/server/ai/generate-client-brief.ts`
- Create : `src/server/ai/generate-interview-questions.ts`
- Test : `src/server/ai/generate-client-brief.test.ts` (ajouts), `src/server/ai/generate-interview-questions.test.ts`

**Interfaces :**
- Modifie : `generateClientBrief(client, { endClientName, parentGroupName, language: BriefLanguage })`. Le prompt :
  - impose la langue ;
  - impose en tête deux sections, `## Chiffres clés` / `## Key figures` puis `## Dates clés` / `## Key dates`, chacune en liste à puces (une donnée et sa date ou sa source par puce, « Non trouvé » / « Not found » si rien n'est trouvé) ;
  - garde ensuite les sections existantes.

  Le budget de 240 s, la gestion des reprises et les sources ne changent pas.
- Produit : `generateInterviewQuestions(client: Anthropic, input: { language: BriefLanguage; missionTitle: string; stack: StackItem[]; jobSpecText: string | null; endClientName: string | null; intermediaryName: string | null; briefMarkdown: string | null }): Promise<string[]>`.
  - Modèle `CLAUDE_MODELS.extraction`, sortie structurée (`{ questions: string[] }`), pas de recherche web, `maxRetries: 1`, délai de 30 s.
  - Les questions doivent être spécifiques à la mission : équipe, contexte projet, stack, organisation, attentes. Pas de questions génériques sur le salaire.
  - Résultat coupé à 10 questions. Moins de 8 questions lève `AiError('unknown')`.
  - Les champs texte sont balisés comme des données (`<mission>`, `<brief>`…) et les chevrons des noms sont retirés, comme dans le brief existant.

- [ ] **Step 1 : Tests qui échouent** (faux client existant `src/server/ai/testing/fake-anthropic-client.ts`)
  - le brief en `en` envoie une consigne en anglais et exige « Key figures » et « Key dates » ;
  - le brief en `fr` exige « Chiffres clés » et « Dates clés » ;
  - les questions : le bon modèle, aucun outil de recherche web, la langue dans la consigne ;
  - 12 questions renvoyées donnent 10 ;
  - 5 questions renvoyées donnent une erreur `unknown` ;
  - les valeurs `null` sont omises du prompt ;
  - un refus (`stop_reason` `refusal`) donne une erreur `refused`.
- [ ] **Step 2 :** `npm test -- generate-client-brief generate-interview-questions`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter, en suivant le skill `claude-api` pour TypeScript (sortie structurée et vérification du refus, sur le modèle de `extract-job-posting.ts`).
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ai): brief in the chosen language with key figures and interview questions`.

### Task 4 : Actions de préparation d'entretien

**Files :**
- Create : `src/server/repositories/interview-preparation-repository.ts`, `src/server/actions/interview-preparation-actions.ts`
- Modify : `src/server/actions/client-brief-actions.ts` (retirer `generateBriefForEndClient` et `getEndClientBrief` s'ils ne servent plus ; garder `updateEndClientNotes`)
- Test : `tests/integration/interview-preparation-actions.test.ts`, `src/server/actions/interview-preparation-actions.test.ts`

**Interfaces :**
- Produit :
  - `InterviewPreparation = { language: BriefLanguage; endClientId: string | null; endClientName: string | null; brief: LanguageBrief | null; questions: InterviewQuestions | null; notes: string | null; lastUsedLanguage: BriefLanguage | null }` (dans `src/domain/interview-preparation.ts`) ;
  - `getInterviewPreparation(jobApplicationId: string, language: BriefLanguage): Promise<ActionResult<InterviewPreparation>>`. `lastUsedLanguage` est la langue des questions les plus récentes de la candidature ;
  - `generateInterviewPreparation(jobApplicationId: string, language: BriefLanguage, regenerate: boolean): Promise<ActionResult<InterviewPreparation>>` :
    - **sans régénération**, génère seulement ce qui manque : le brief si un client est connu et qu'il n'a pas de brief dans cette langue, puis les questions si elles manquent ;
    - **avec régénération**, génère les deux, et le brief seulement si un client est connu ;
    - les questions sont générées **après** le brief, à partir de son markdown ;
    - le texte de la fiche métier n'est utilisé que pour une fiche collée (`source_kind = 'text'`), jamais un PDF ;
    - pas de clé Claude : `ok: false` avec `CLIENT_BRIEF_AI_ERROR_MESSAGES.missing_api_key` ;
    - si le brief réussit mais que les questions échouent, le brief est enregistré, et l'action renvoie `ok: false` avec le message de l'IA. Le bouton reste alors sur « Générer le brief », qui ne génère plus que les questions.

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration (IA simulée par injection) :**
    - un brief `fr` existant pour le client : `generateInterviewPreparation(..., 'fr', false)` n'appelle pas le générateur de brief et appelle celui des questions ;
    - avec `regenerate`, les deux sont appelés et le brief est remplacé ;
    - client inconnu : seulement les questions ;
    - B ne peut pas générer pour la candidature de A (`ok: false`, rien d'écrit) ;
    - échec des questions après un brief réussi : le brief est enregistré, `ok: false`.
  - **Unitaires :**
    - langue invalide refusée sans appel à la base ;
    - identifiant non UUID refusé ;
    - le fichier `'use server'` n'exporte que les deux actions.
- [ ] **Step 2 :** `npm run test:integration -- interview-preparation-actions && npm test -- interview-preparation-actions`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Le cœur testable va dans un module `server-only` sans `'use server'`, avec les générateurs injectés. La page de la fiche garde `maxDuration = 300`.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(prep): generate only the missing brief or questions per language`.

### Task 5 : Bouton et modale « Brief »

**Files :**
- Create : `src/components/interview-preparation-button/*`, `src/components/interview-preparation-modal/*`, `src/components/markdown-content/*` (rendu markdown sûr extrait de `client-brief-section`)
- Modify : `src/app/(app)/candidatures/[jobApplicationId]/page.tsx` (remplace `ClientBriefSection`)
- Delete : `src/components/client-brief-section/*` (sa logique de notes va dans la modale)
- Test : `controller.test.tsx` et un test de rendu pour le bouton et la modale

**Interfaces :**
- Consomme : Tâche 4 (`getInterviewPreparation`, `generateInterviewPreparation`), `updateEndClientNotes` (V1), Tâche 2 (types, langues).
- Produit : `InterviewPreparationButton`, avec les props `{ jobApplicationId: string; initialPreparation: InterviewPreparation; …actions injectées }`.

**Comportement (spec §3.1)** :
- **Bouton :** « Générer le brief » tant qu'une partie manque (questions seules si le client est inconnu), sinon « Brief généré · voir mon brief ».
- **Langue :** un sélecteur Français / English à côté du bouton, présélectionné sur `lastUsedLanguage ?? 'fr'`. Changer de langue recharge la préparation de cette langue.
- **Pendant la génération :** le bouton est désactivé et affiche « Génération… (jusqu'à 4 min) ».
- **Modale accessible :** titre, focus piégé, Échap pour fermer, retour du focus au bouton. Elle affiche, dans l'ordre :
  1. le brief en markdown sûr (pas de HTML brut, liens http et https uniquement, `target="_blank" rel="noopener noreferrer"`), ou « Client inconnu, demande-le à l'intermédiaire. » ;
  2. « Mes notes sur l'entreprise », avec l'enregistrement automatique existant (800 ms, non perdu à la fermeture) ;
  3. « Questions à poser en entretien », en liste numérotée ;
  4. « Voir les sources (N) », replié par défaut ;
  5. la date de génération et « Régénérer » (qui demande la langue).

- [ ] **Step 1 : Tests qui échouent**
  - **Contrôleur :**
    - le libellé du bouton dans chaque état (rien ; brief seul ; questions seules avec client inconnu ; les deux) ;
    - un double clic ne génère qu'une fois ;
    - une erreur affiche le message de l'IA ;
    - le changement de langue recharge ;
    - « Régénérer » passe `regenerate = true`.
  - **Rendu :**
    - les sources sont repliées puis dépliées au clic ;
    - les questions sont numérotées ;
    - Échap ferme la modale ;
    - aucun lien `javascript:` n'est rendu.
- [ ] **Step 2 :** `npm test -- interview-preparation markdown-content`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Réutiliser le composant de dialogue déjà utilisé par le calendrier (`@base-ui` `Dialog`).
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): brief modal with key figures, notes, interview questions and folded sources`.

> **Déploiement lot 2** (contrôleur) : `npx supabase db push` (après un `--dry-run` montré au porteur), puis `git push` par le porteur, puis vérification sur Vercel.

---

## Lot 3 — Fiche candidature en lecture et suppression

### Task 6 : Supprimer une candidature

**Files :**
- Modify : `src/server/repositories/job-applications-repository.ts`, `src/server/actions/job-application-actions.ts`, `src/server/repositories/job-specs-repository.ts`, `src/server/repositories/opportunity-decisions-repository.ts`
- Create : `src/components/delete-job-application-button/*`
- Modify : `src/app/(app)/candidatures/page.tsx` (ou la page du tableau après la tâche 8 : message « Candidature supprimée » via `?supprimee=1`)
- Test : `tests/integration/delete-job-application.test.ts`, `src/components/delete-job-application-button/controller.test.tsx`

**Interfaces :**
- Produit : `deleteJobApplication(jobApplicationId: string): Promise<ActionResult<null>>`, qui fait dans l'ordre :
  1. vérifie l'appartenance ;
  2. lit le `storage_path` de la fiche métier ;
  3. supprime les décisions d'opportunité liées (`job_application_id = id` et `decision = 'applied'`) ;
  4. supprime la candidature (les cascades font le reste) ;
  5. supprime le PDF du stockage. Un échec à cette étape est journalisé et ne fait pas échouer l'action.
- **Bouton :** rouge, libellé « Supprimer la candidature », placé tout en bas de la fiche.
  - Il ouvre une confirmation : « Supprimer définitivement cette candidature ? Son journal, ses entretiens et sa fiche métier seront supprimés. », avec « Annuler » et « Supprimer ».
  - En cas de succès : navigation injectée vers `/candidatures?supprimee=1`.

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration :**
    - la candidature est supprimée avec ses entretiens, son journal, ses reports, sa fiche métier et ses questions ;
    - le PDF est absent du stockage ;
    - une opportunité d'où elle venait revient en « À traiter » ;
    - le brief du client est conservé ;
    - B ne peut pas supprimer la candidature de A (`ok: false`, rien supprimé) ;
    - un identifiant inexistant donne `ok: false`.
  - **Contrôleur :**
    - « Annuler » n'appelle rien ;
    - « Supprimer » appelle une seule fois malgré un double clic ;
    - une exception affiche le message générique.
- [ ] **Step 2 :** `npm run test:integration -- delete-job-application && npm test -- delete-job-application-button`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(applications): delete an application with its files`.

### Task 7 : Fiche en lecture avec crayon par bloc

**Files :**
- Create : `src/components/editable-block/*` (bascule lecture / modification), `src/components/job-application-summary/*` (en-tête en lecture), `src/components/mission-details-view/*`, `src/components/contact-view/*`, `src/components/stack-view/*`
- Modify : `src/components/mission-info-form/*`, découpé en quatre formulaires de bloc : `header-edit-form`, `mission-details-form`, `contact-edit-form`, `stack-edit-form`. Ils réutilisent la logique existante (diff des champs modifiés, resynchronisation par champ, validation du domaine).
- Modify : `src/app/(app)/candidatures/[jobApplicationId]/page.tsx`
- Test : les contrôleurs des quatre formulaires, `editable-block`, et des tests de rendu des vues

**Interfaces :**
- Produit : `EditableBlock`, avec les props `{ title: string; view: ReactNode; renderEdit: (close: () => void) => ReactNode }`. Un bouton crayon porte l'`aria-label` « Modifier {titre} ».

**Blocs (spec §4.2)** :
- **En-tête :** titre, source, lien de l'annonce, intermédiaire et son type, client final et son groupe parent, date de candidature.
- **Infos mission :** TJM affiché, TJM demandé, lieu, présentiel, démarrage souhaité, démarrage effectif, durée, notes.
- **Contact :** nom, téléphone (`tel:`), e-mail (`mailto:`), LinkedIn.
- **Stack :** étiquettes par catégorie.

**Restent hors crayon :** statut et KO (`job-application-header`), journal, entretiens, fiche métier, bouton du brief.

**Mise en page (spec §4.1)** :
- en haut, le résumé et le prochain entretien (le plus proche dans le futur, sinon rien) ;
- au milieu, la stack, le bouton du brief, la fiche métier, les infos mission et le contact ;
- en bas, les entretiens, le journal, puis le bouton de suppression (tâche 6).

- [ ] **Step 1 : Tests qui échouent**
  - **Chaque formulaire :**
    - « Enregistrer » envoie seulement les champs de son bloc qui ont changé ;
    - « Annuler » revient à la lecture sans rien envoyer ;
    - un rafraîchissement des données pendant la saisie ne l'écrase pas, mais met à jour les champs non touchés (Review Focus 4).
  - **`editable-block` :** le crayon est accessible et le focus va au premier champ.
  - **Vues :**
    - un téléphone s'affiche en lien `tel:` ;
    - un champ vide affiche « — » ;
    - le prochain entretien est le bon.
- [ ] **Step 2 :** `npm test -- editable-block header-edit-form mission-details-form contact-edit-form stack-edit-form job-application-summary`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. Supprimer le code devenu inutile de `mission-info-form`.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(ui): read-first application page with per-block editing`.

> **Déploiement lot 3** (contrôleur) : `git push` par le porteur, puis vérification.

---

## Lot 4 — Navigation, accueil et recherche

### Task 8 : Routes et menu

**Files :**
- Move : `src/app/(app)/page.tsx` vers `src/app/(app)/candidatures/page.tsx` (tableau et bandeau « À faire »)
- Move : `src/app/(app)/settings/**` vers `src/app/(app)/preferences/**`
- Modify : `next.config.ts` (redirections permanentes de `/settings` vers `/preferences` et de `/settings/:path*` vers `/preferences/:path*`)
- Modify : `src/components/app-shell/*` (libellés et ordre du menu), `src/components/settings-navigation/*` (liens), et tous les liens et messages internes qui mentionnent `/settings` ou « réglages »
- Test : `app-shell.test.tsx`, `settings-navigation` (test de rendu à créer), un test des redirections

**Menu, dans l'ordre :** « Mes candidatures » (`/candidatures`), « Mon calendrier » (`/calendar`), « Mes opportunités » (`/opportunites`, avec le compteur), « Préférences » (`/preferences`). Le logo pointe vers `/`.

- [ ] **Step 1 : Tests qui échouent**
  - les libellés et l'ordre du menu ;
  - le lien actif sur `/candidatures/abc` est « Mes candidatures » ;
  - `next.config` redirige `/settings/opportunites/free-work` vers `/preferences/opportunites/free-work` ;
  - aucun texte de l'interface ne contient « réglages » (un test qui parcourt les constantes de messages exportées).
- [ ] **Step 2 :** `npm test -- app-shell settings-navigation next-config`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter. `grep -rn "/settings\|Réglages\|réglages" src` doit ensuite ne renvoyer que les redirections.
- [ ] **Step 4 :** Relancer, puis `npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(nav): new menu labels, candidatures route and preferences`.

### Task 9 : Page d'accueil

**Files :**
- Create : `src/app/(app)/page.tsx` (accueil), `src/components/home-dashboard/*`, `src/server/opportunities/highlighted-opportunities.ts`
- Modify : `src/server/actions/opportunity-actions.ts` (nouvelle action)
- Test : `src/components/home-dashboard/*.test.tsx`, `tests/integration/highlighted-opportunities.test.ts`

**Interfaces :**
- Produit : `listHighlightedOpportunities(): Promise<ActionResult<OpportunityListItem[]>>`, qui renvoie au plus 2 missions de « À traiter » (filtres de l'utilisateur appliqués), publiées depuis moins de 48 h, triées par TJM effectif décroissant, TJM inconnu en dernier, puis par date décroissante.
- La page réutilise `computeTodoAlerts` et le bandeau existant (au plus 5 alertes et « Voir tout » vers `/candidatures`), `listUpcomingInterviews` (les 3 prochains), et `OpportunityCard` en mode compact (« J'ai postulé », « Voir sur Free-Work »).

**Textes exacts :**
- en-tête : « Bonjour {prénom} », ou « Bonjour » sans prénom ;
- boutons : « Voir mes candidatures », « Voir mon calendrier », « Voir mes opportunités » ;
- états vides : « Rien d'urgent aujourd'hui. », « Aucun entretien prévu. », « Pas de nouvelle mission intéressante depuis 48 h. ».

La page exporte `maxDuration = 60`, à cause de « J'ai postulé » (tâche 1).

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration :** parmi 4 missions (une de 72 h, TJM 700 ; une de 10 h, TJM 600 ; une de 5 h, TJM non communiqué ; une de 20 h, TJM 650), on obtient celle à 650 puis celle à 600.
  - **Rendu :**
    - « Bonjour Rayan » et « Bonjour » ;
    - au plus 5 rappels, et « Voir tout » au-delà ;
    - 3 rendez-vous au plus ;
    - les trois états vides ;
    - les trois boutons et leurs liens.
- [ ] **Step 2 :** `npm run test:integration -- highlighted-opportunities && npm test -- home-dashboard`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer, puis `npm run lint && npm run typecheck && npm run build`. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(home): dashboard with reminders, next interviews and highlighted missions`.

### Task 10 : Recherche dans « Mes opportunités »

**Files :**
- Modify : `src/server/opportunities/opportunity-listing.ts`, `src/server/actions/opportunity-actions.ts` (`listOpportunities(tab, cursor, search)`), `src/domain/opportunities.ts` (validation de la recherche, au plus 100 caractères), `src/components/opportunities-board/*`
- Test : intégration du listing et contrôleur du tableau

**Interfaces :**
- `listOpportunities(tab: OpportunityTab, cursor: OpportunityCursor | null, search: string): Promise<ActionResult<OpportunityListing>>` :
  - une recherche vide équivaut à l'absence de recherche ;
  - la correspondance est `normalizeForKeywordMatch(champ).includes(normalizeForKeywordMatch(recherche))` sur le titre, l'entreprise ou le lieu ;
  - les `counts` tiennent compte de la recherche.
- Tableau : un champ « Rechercher une mission… » au-dessus des onglets, différé de 300 ms. Une nouvelle recherche recharge depuis le début (curseur `null`), et les réponses arrivées dans le désordre sont ignorées.

- [ ] **Step 1 : Tests qui échouent**
  - **Intégration :**
    - « societe generale » trouve « Société Générale » dans l'entreprise ;
    - « paris » trouve le lieu ;
    - les compteurs filtrés ;
    - la recherche combinée aux filtres Free-Work (les deux s'appliquent) ;
    - la pagination par curseur avec une recherche.
  - **Contrôleur :**
    - la saisie est différée de 300 ms ;
    - une réponse obsolète est ignorée ;
    - l'effacement de la recherche rétablit la liste.
- [ ] **Step 2 :** `npm run test:integration -- opportunity && npm test -- opportunities-board`. Attendu : FAIL.
- [ ] **Step 3 :** Implémenter.
- [ ] **Step 4 :** Relancer. Attendu : PASS.
- [ ] **Step 5 :** Commit `feat(opportunities): search missions by title, company or location`.

### Task 11 : Vérification finale et README

- [ ] **Step 1 :** Mettre à jour le README : routes (`/`, `/candidatures`, `/preferences`), brief par langue, suppression.
- [ ] **Step 2 :** `npm run lint && npm run typecheck && npm test && npm run test:tz && npm run test:integration && npm run build`. Attendu : tout passe.
- [ ] **Step 3 :** Commit `docs: describe v3 navigation, briefs by language and deletion`.

> **Déploiement lot 4** (contrôleur) : `git push` par le porteur, puis vérification de l'accueil, de la redirection `/settings` et de la recherche.
