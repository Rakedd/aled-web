# Landing Aled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir une landing page taquine sur `aled.work` depuis le même projet Next.js que l'app (`app.aled.work`).

**Architecture:** Le proxy reconnaît les domaines de la landing (`LANDING_HOSTNAMES`) et réécrit leurs chemins vers le segment interne `src/app/vitrine/`, sans jamais créer de client Supabase. Les pages de la landing sont statiques, leurs textes vivent dans un module de copie unique, et les liens vers l'app passent par `APP_ORIGIN`.

**Tech Stack:** Next.js 16 (App Router, proxy), React 19, TypeScript, Tailwind v4 (tokens Atelier), `next/og`, `@vercel/analytics`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-21-aled-landing-design.md`

## Global Constraints

- Conventions du porteur (`~/.claude/CLAUDE.md`) : fonctions fléchées, exports nommés (sauf pages/layouts/metadata routes Next), aucun `any`, aucun `console.log`, pas de commentaires, un dossier kebab-case par composant avec `<nom>.tsx`, `interfaces.ts`, `index.ts`.
- Aucun hexadécimal ni classe `dark:` dans les `.ts`/`.tsx` hors tests (garde-fou `src/app/atelier-theme.test.ts`) : uniquement les tokens de `globals.css`.
- Le mot « freelance » n'apparaît dans aucun texte visible de la landing, quelle que soit la casse.
- Aucun nom de plateforme (Free-Work, Malt, Collective…) dans les textes de la landing.
- Aucun domaine écrit en dur : `LANDING_HOSTNAMES` (liste séparée par des virgules) et `APP_ORIGIN` (ex. `https://app.aled.work`).
- Segment interne de la landing : `/vitrine`.
- Route d'inscription visée par les appels à l'action : `/inscription` sur `APP_ORIGIN`.
- Mobile d'abord : lisible sans défilement horizontal dès 360 px.
- Pas de commit pendant l'exécution : le porteur a du travail en cours sur `main` et commite lui-même.
- Commandes Node : préfixer par `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" &&`.

## Review Focus

1. Le domaine de la landing reçoit `/robots.txt`, `/sitemap.xml`, l'image d'aperçu et `/_vercel/insights/*` : chacun doit arriver au bon endroit, sans double réécriture `/vitrine/vitrine` (tests Task 2).
2. `aled.work/login?error=invalid-link` ou `aled.work/auth/confirm?token_hash=…` (anciens liens) doivent rediriger vers l'app **avec** la query string (tests Task 2).
3. Le domaine arrive avec un port en local (`aled.localhost:3000`) ou en majuscules (`ALED.work`) : il doit être reconnu (tests Task 1).
4. `APP_ORIGIN` ou `LANDING_HOSTNAMES` absents (build de prévisualisation, CI) : le build et les pages ne doivent pas planter, les liens retombent sur des chemins relatifs (tests Task 1 et Task 5).
5. Sur une prévisualisation, les liens internes de la landing (pied de page, logo) doivent rester sous `/vitrine` pour ne pas tomber sur la page de connexion de l'app (tests Task 1 et Task 5).

---

### Task 1: Routage et environnement de la landing (fonctions pures)

**Files:**
- Create: `src/domain/landing-routing.ts`
- Create: `src/domain/landing-routing.test.ts`
- Create: `src/lib/landing/landing-environment.ts`
- Create: `src/lib/landing/landing-environment.test.ts`

**Interfaces:**
- Produces (`src/domain/landing-routing.ts`, imports relatifs uniquement car `next.config.ts` l'importe) :
  - `LANDING_INTERNAL_PATH_PREFIX = '/vitrine'`
  - `SIGN_UP_PATHNAME = '/inscription'`, `SIGN_IN_PATHNAME = '/login'`
  - `LEGAL_NOTICE_PATHNAME = '/mentions-legales'`, `PRIVACY_POLICY_PATHNAME = '/confidentialite'`
  - `parseLandingHostnames(rawValue: string | undefined): string[]` — découpe, trim, minuscules, ignore les vides.
  - `isLandingHostname(hostname: string, landingHostnames: string[]): boolean` — insensible à la casse, ignore un éventuel port.
  - `isWwwHostname(hostname: string): boolean`, `stripWwwPrefix(hostname: string): string`
  - `isLandingInternalPathname(pathname: string): boolean` — `/vitrine` ou `/vitrine/...`.
  - `toLandingInternalPathname(pathname: string): string` — `/` → `/vitrine`, `/x` → `/vitrine/x`.
  - `isAppPathname(pathname: string): boolean` — préfixes `/login`, `/auth`, `/candidatures`, `/calendar`, `/opportunites`, `/preferences`, `/settings`, `/api`, `/inscription` (les constantes de `./routes` quand elles existent).
- Produces (`src/lib/landing/landing-environment.ts`) :
  - `readLandingHostnames(): string[]` — `parseLandingHostnames(process.env.LANDING_HOSTNAMES)`.
  - `readAppOrigin(): string` — `process.env.APP_ORIGIN` sans `/` final, `''` si absent.
  - `isProductionDeployment(): boolean` — `process.env.VERCEL_ENV === 'production'`.
  - `readLandingOrigin(): URL | undefined` — `https://<premier domaine>` si la liste n'est pas vide.
  - `buildAppUrl(pathname: string): string` — `${readAppOrigin()}${pathname}`.
  - `buildLandingHref(pathname: string): string` — en production `pathname` ; sinon `toLandingInternalPathname(pathname)`.

- [ ] **Step 1: Write the failing tests**

`landing-routing.test.ts` :
- `parseLandingHostnames(' aled.work, WWW.aled.work ,,')` → `['aled.work', 'www.aled.work']` ; `parseLandingHostnames(undefined)` → `[]`.
- `isLandingHostname('ALED.work', ['aled.work'])` → `true` ; `isLandingHostname('aled.localhost:3000', ['aled.localhost'])` → `true` ; `isLandingHostname('app.aled.work', ['aled.work'])` → `false`.
- `stripWwwPrefix('www.aled.work')` → `'aled.work'` ; `isWwwHostname('aled.work')` → `false`.
- `toLandingInternalPathname('/')` → `'/vitrine'` ; `toLandingInternalPathname('/mentions-legales')` → `'/vitrine/mentions-legales'`.
- `isLandingInternalPathname('/vitrine')`, `('/vitrine/confidentialite')` → `true` ; `('/vitrines')` → `false`.
- `it.each(['/login', '/auth/confirm', '/candidatures/42', '/calendar', '/opportunites', '/preferences/opportunites', '/settings', '/api/export', '/inscription'])` → `isAppPathname` vrai ; `it.each(['/', '/mentions-legales', '/confidentialite', '/robots.txt', '/loginx'])` → faux.

`landing-environment.test.ts` (sauvegarder/restaurer `process.env` dans `beforeEach`/`afterEach`) :
- `APP_ORIGIN='https://app.aled.work/'` → `buildAppUrl('/inscription')` === `'https://app.aled.work/inscription'`.
- `APP_ORIGIN` absent → `buildAppUrl('/login')` === `'/login'`.
- `LANDING_HOSTNAMES='aled.work,www.aled.work'` → `readLandingOrigin()?.href` === `'https://aled.work/'` ; absent → `undefined`.
- `VERCEL_ENV='production'` → `buildLandingHref('/mentions-legales')` === `'/mentions-legales'` ; `VERCEL_ENV='preview'` → `'/vitrine/mentions-legales'` ; `buildLandingHref('/')` en prévisualisation → `'/vitrine'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/domain/landing-routing src/lib/landing`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Implement both modules with the signatures above**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/domain/landing-routing src/lib/landing`
Expected: PASS.

---

### Task 2: Proxy par domaine et redirection de `/api`

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/proxy.test.ts`
- Modify: `next.config.ts`
- Modify: `next.config.test.ts`

**Interfaces:**
- Consumes: Task 1 (toutes les fonctions de `landing-routing` et `landing-environment`).
- Produces: `buildLandingApiRedirects(environment: { landingHostnames: string | undefined; appOrigin: string | undefined }): Redirect[]` exporté depuis `next.config.ts`, utilisé par `redirects`.

Comportement du proxy, dans cet ordre, **avant** `createServerClient` :
1. Domaine de landing + `www.` → redirection 308 vers la même URL sans `www.`.
2. Domaine de landing + chemin interne `/vitrine...` → `NextResponse.next()`.
3. Domaine de landing + `isAppPathname` + `APP_ORIGIN` défini → redirection 308 vers `APP_ORIGIN + pathname + search`.
4. Domaine de landing, autre chemin → `NextResponse.rewrite` vers `toLandingInternalPathname(pathname)` en gardant la query string.
5. Autre domaine + chemin `/vitrine...` : en production → réponse 404 ; sinon → `NextResponse.next()` sans authentification.
6. Sinon : comportement actuel inchangé.

Matcher : ajouter `_vercel` à l'exclusion (`/((?!api/|_next/static|_next/image|_vercel|favicon.ico|...).*)`).

- [ ] **Step 1: Write the failing proxy tests**

Ajouter à `src/proxy.test.ts` un `describe('proxy on the landing domain')` avec `process.env.LANDING_HOSTNAMES = 'aled.work,www.aled.work'`, `process.env.APP_ORIGIN = 'https://app.aled.work'` (restaurés après), et `buildRequest(url: string)` acceptant une URL absolue :
- `'https://aled.work/'` → header `x-middleware-rewrite` se termine par `/vitrine` ; `createServerClient` non appelé.
- `'https://aled.work/mentions-legales'` → réécriture vers `/vitrine/mentions-legales`.
- `'https://aled.work/robots.txt'` → réécriture vers `/vitrine/robots.txt`.
- `'https://aled.work/vitrine/opengraph-image'` → pas de réécriture (`x-middleware-next` === `'1'`).
- `'https://www.aled.work/confidentialite'` → 308, `location` === `'https://aled.work/confidentialite'`.
- `'https://aled.work/login?error=invalid-link'` → 308, `location` === `'https://app.aled.work/login?error=invalid-link'`.
- `'https://aled.work/auth/confirm?token_hash=abc&type=email'` → 308 vers `'https://app.aled.work/auth/confirm?token_hash=abc&type=email'`.
- `'http://aled.localhost:3000/'` avec `LANDING_HOSTNAMES='aled.localhost'` → réécriture vers `/vitrine`.

Et pour le domaine de l'app :
- `VERCEL_ENV='production'`, `'https://app.aled.work/vitrine'` → statut 404.
- `VERCEL_ENV='preview'`, `'https://preview.vercel.app/vitrine/mentions-legales'` → `x-middleware-next` === `'1'`, `createServerClient` non appelé.
- Les tests existants passent inchangés.

- [ ] **Step 2: Write the failing next.config test**

Dans `next.config.test.ts` :
- `buildLandingApiRedirects({ landingHostnames: 'aled.work,www.aled.work', appOrigin: 'https://app.aled.work' })` → deux règles `{ source: '/api/:path*', has: [{ type: 'host', value: 'aled.work' }], destination: 'https://app.aled.work/api/:path*', permanent: true }` (et `www.aled.work`).
- `appOrigin: undefined` → `[]`.
- `(await nextConfig.redirects?.())` contient toujours les deux redirections `/settings`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/proxy.test.ts next.config.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the proxy routing, the matcher change and `buildLandingApiRedirects`**

`next.config.ts` importe `parseLandingHostnames` par chemin relatif (`./src/domain/landing-routing`) et lit `process.env` au build.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/proxy.test.ts next.config.test.ts`
Expected: PASS.

---

### Task 3: Logo partagé, `noindex` de l'app et `robots.txt` de l'app

**Files:**
- Create: `src/components/brand-logo-link/brand-logo-link.tsx`, `interfaces.ts`, `index.ts`, `brand-logo-link.test.tsx`
- Modify: `src/components/app-shell/app-shell.tsx` (remplace le `Link` du logo)
- Modify: `src/app/layout.tsx` (metadata `robots: { index: false, follow: false }`)
- Create: `src/app/robots.ts`, `src/app/robots.test.ts`

**Interfaces:**
- Produces: `BrandLogoLink({ href }: BrandLogoLinkProps)` — `Link` vers `href`, classes actuelles du logo du header (`block h-9 w-20 shrink-0 bg-(image:--brand-logo) bg-contain bg-left bg-no-repeat`), texte `sr-only` « Aled ».
- Produces: `src/app/robots.ts` default export `(): MetadataRoute.Robots` → `{ rules: { userAgent: '*', disallow: '/' } }`.

- [ ] **Step 1: Write the failing tests**
- `BrandLogoLink` : `getByRole('link', { name: 'Aled' })` a `href` `'/vitrine'` quand on passe `href="/vitrine"`.
- `robots()` → `toEqual({ rules: { userAgent: '*', disallow: '/' } })`.
- Le test existant `app-shell.test.tsx` « points the logo to the home page » reste vert.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/brand-logo-link src/app/robots.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `BrandLogoLink`, use it in `AppShell`, add root `robots.ts` and the root `noindex`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/brand-logo-link src/components/app-shell src/app/robots.test.ts`
Expected: PASS.

---

### Task 4: Textes et sections de la landing

**Files:**
- Create: `src/domain/landing-copy.ts`, `src/domain/landing-copy.test.ts`
- Create (un dossier chacun, avec `interfaces.ts` si props, `index.ts`, test) : `src/components/landing-hero/`, `src/components/landing-pain-section/`, `src/components/landing-journey-section/`, `src/components/landing-closing-section/`

**Interfaces:**
- Produces: `LANDING_COPY` (objet `as const`) avec exactement les textes du §2 de la spec :
  - `hero: { titleStart: 'Trouver du boulot', struckText: 'en traversant la rue', titleEnd: 'depuis ton canapé.', subtitle, callToAction: 'Je reste sur mon canapé' }`
  - `pain: { titleStart: '300 sites. 1 boîte mail.', highlightedText: '0 idée', titleEnd: "de qui t'a répondu.", text, emails: { subject: string; detail: string }[] }` (4 e-mails, `subject` en gras)
  - `journey: { title: 'Du premier clic au premier jour.', text, steps: { title: string; text: string }[] }` (7 étapes)
  - `closing: { title: "« ALED, je sais plus à qui j'ai postulé. »", text: 'Normal. Aled s\'en souvient pour toi.', callToAction: 'Aled, sauve-moi' }`
  - `header: { signIn: 'Se connecter' }`, `footer: { copyright: '© Aled', legalNotice: 'Mentions légales', privacyPolicy: 'Confidentialité' }`
- Produces: `LandingHero({ signUpUrl }: LandingHeroProps)`, `LandingPainSection()`, `LandingJourneySection()`, `LandingClosingSection({ signUpUrl }: LandingClosingSectionProps)`.

Rendu (tokens uniquement) :
- Hero : seul `h1`, `struckText` dans `<del>` avec `decoration-peach` épaisse ; appel à l'action `Link`/`a` stylé `buttonVariants({ variant: 'ink', size: 'lg' })`.
- Douleur : `section` sur `bg-card`, `h2`, `highlightedText` sur `bg-peach text-on-peach` ; pile d'e-mails décalés en `aria-hidden`.
- Parcours : `h2`, `<ol>` de 7 `<li>` en grille (`grid-cols-1` puis plusieurs colonnes à partir de `sm`) ; la 7e étape sur `bg-deep-surface text-on-deep-surface`.
- Conclusion : `section` sur `bg-brand-tile`, `next/image` `/brand/aled-logo-on-dark.png` (alt « Aled », 107×48), `h2`, appel à l'action pêche (`bg-peach text-on-peach`).

- [ ] **Step 1: Write the failing tests**
- `landing-copy.test.ts` : `JSON.stringify(LANDING_COPY)` ne matche pas `/freelance/i` ni `/free-work|malt|collective/i` ; `LANDING_COPY.journey.steps` a 7 éléments, le dernier titré `'Premier jour'`.
- `LandingHero` : `getByRole('heading', { level: 1 })` contient `'Trouver du boulot'` et `'depuis ton canapé.'` ; `getByRole('link', { name: 'Je reste sur mon canapé' })` a `href` = prop `signUpUrl`.
- `LandingPainSection` : `getByRole('heading', { level: 2 })` contient `'0 idée'` ; la pile d'e-mails est dans un conteneur `aria-hidden="true"`.
- `LandingJourneySection` : `getAllByRole('listitem')` a 7 éléments ; le texte `'Relire le contrat'` est présent et aucun texte `/bientôt/i`.
- `LandingClosingSection` : `getByRole('img', { name: 'Aled' })` ; `getByRole('link', { name: 'Aled, sauve-moi' })` a `href` = `signUpUrl`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/domain/landing-copy src/components/landing-`
Expected: FAIL.

- [ ] **Step 3: Implement `LANDING_COPY` and the four section components**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/domain/landing-copy src/components/landing-`
Expected: PASS.

---

### Task 5: Layout de la landing, en-tête, pied de page, page d'accueil, mesure d'audience

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install @vercel/analytics@2.0.1`)
- Create: `src/components/landing-header/` et `src/components/landing-footer/` (composant, `interfaces.ts`, `index.ts`, test)
- Create: `src/app/vitrine/layout.tsx`, `src/app/vitrine/page.tsx`, `src/app/vitrine/page.test.tsx`, `src/app/vitrine/layout.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`buildAppUrl`, `buildLandingHref`, `readLandingOrigin`, constantes de chemins), Task 3 (`BrandLogoLink`), Task 4 (sections, `LANDING_COPY`), `ThemeMenu`.
- Produces: `LandingHeader({ homeHref, signInUrl }: LandingHeaderProps)`, `LandingFooter({ legalNoticeHref, privacyPolicyHref }: LandingFooterProps)`.
- Produces: `src/app/vitrine/layout.tsx` default export + `metadata` construit par `buildLandingMetadata(): Metadata` (exporté pour les tests) :
  - `metadataBase: readLandingOrigin()`, `title: 'Aled · Du premier clic au premier jour'`, `description: LANDING_COPY.hero.subtitle`, `alternates: { canonical: '/' }`, `robots: { index: true, follow: true }`, `openGraph: { type: 'website', locale: 'fr_FR', siteName: 'Aled' }`, `twitter: { card: 'summary_large_image' }`.
  - Le layout rend `LandingHeader`, `children`, `LandingFooter` et `<Analytics />` (`@vercel/analytics/next`).

- [ ] **Step 1: Install the dependency**

Run: `npm install @vercel/analytics@2.0.1`
Expected: ajout dans `dependencies`.

- [ ] **Step 2: Write the failing tests**
- `LandingHeader` : lien « Aled » vers `homeHref` ; lien `'Se connecter'` vers `signInUrl` ; bouton `'Thème'` présent.
- `LandingFooter` : liens `'Mentions légales'` et `'Confidentialité'` vers les props ; texte `'© Aled'`.
- `page.test.tsx` (avec `APP_ORIGIN='https://app.aled.work'`) : les deux appels à l'action pointent vers `'https://app.aled.work/inscription'` ; le texte de `document.body` ne matche pas `/freelance/i` ; un seul `h1`.
- `layout.test.tsx` : `buildLandingMetadata()` avec `LANDING_HOSTNAMES='aled.work'` → `metadataBase?.href === 'https://aled.work/'` et `robots` indexable ; sans variable → `metadataBase` `undefined`. Le layout rendu (avec `jest.mock('@vercel/analytics/next', () => ({ Analytics: () => <div data-testid="analytics" /> }))`) contient `analytics` ; `getByRole('link', { name: 'Se connecter' })` a `href` `'https://app.aled.work/login'`.
- Garde-fou : `src/app/(app)/layout.tsx` ne contient pas la chaîne `@vercel/analytics` (lecture du fichier).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/components/landing-header src/components/landing-footer src/app/vitrine`
Expected: FAIL.

- [ ] **Step 4: Implement header, footer, layout and home page**

La page enchaîne `LandingHero`, `LandingPainSection`, `LandingJourneySection`, `LandingClosingSection` avec `signUpUrl = buildAppUrl(SIGN_UP_PATHNAME)`. Liens internes via `buildLandingHref`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/landing-header src/components/landing-footer src/app/vitrine`
Expected: PASS.

---

### Task 6: Pages légales avec emplacements à compléter

**Files:**
- Create: `src/domain/legal-copy.ts`, `src/domain/legal-copy.test.ts`
- Create: `src/components/legal-document/` (composant, `interfaces.ts`, `index.ts`, test)
- Create: `src/app/vitrine/mentions-legales/page.tsx`, `src/app/vitrine/confidentialite/page.tsx`, `src/app/vitrine/legal-pages.test.tsx`

**Interfaces:**
- Produces: `LEGAL_PLACEHOLDER_MARKER = '[À COMPLÉTER'`, `LEGAL_NOTICE_DOCUMENT: LegalDocumentContent`, `PRIVACY_POLICY_DOCUMENT: LegalDocumentContent`, avec `type LegalDocumentContent = { title: string; sections: { heading: string; paragraphs: string[] }[] }` (dans `src/domain/legal-copy.ts`).
- Produces: `LegalDocument({ document }: LegalDocumentProps)` — `h1` = `title`, un `h2` par section.

Contenu :
- Mentions légales : sections Éditeur (`[À COMPLÉTER : nom de l'éditeur]`, `[À COMPLÉTER : statut et adresse]`), Directeur de la publication (`[À COMPLÉTER : nom]`), Contact (`[À COMPLÉTER : adresse e-mail]`), Hébergeur : « Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com ».
- Confidentialité : la landing ne crée pas de compte et ne dépose aucun cookie ; mesure d'audience Vercel Web Analytics sans cookie ni donnée personnelle identifiante ; contact via les mentions légales. Pas de lien vers une politique de l'app.
- Chaque page exporte `metadata` avec `title` et `alternates.canonical` = son chemin.

- [ ] **Step 1: Write the failing tests**
- `LegalDocument` : un `h1` et autant de `h2` que de sections.
- `legal-pages.test.tsx` : chaque page rend son `h1` (`'Mentions légales'`, `'Confidentialité'`) ; la page Mentions légales contient `'Vercel Inc.'`.
- `legal-copy.test.ts` : aucun texte ne matche `/freelance/i` ; et le garde-fou de lancement :
  `it.skip('contains no placeholder left — à activer avant le lancement', () => expect(JSON.stringify([LEGAL_NOTICE_DOCUMENT, PRIVACY_POLICY_DOCUMENT])).not.toContain(LEGAL_PLACEHOLDER_MARKER))`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/domain/legal-copy src/components/legal-document src/app/vitrine/legal-pages`
Expected: FAIL.

- [ ] **Step 3: Implement legal copy, component and both pages**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/domain/legal-copy src/components/legal-document src/app/vitrine/legal-pages`
Expected: PASS (le garde-fou apparaît en « skipped »).

---

### Task 7: `robots.txt`, `sitemap.xml` et image d'aperçu de la landing

**Files:**
- Create: `src/app/vitrine/robots.txt/route.ts`, `src/app/vitrine/robots.test.ts`
- Create: `src/app/vitrine/sitemap.ts`, `src/app/vitrine/sitemap.test.ts`
- Create: `src/lib/theme/read-light-theme-colour.ts`, `src/lib/theme/read-light-theme-colour.test.ts`
- Create: `src/app/vitrine/opengraph-image.tsx`
- Create: `assets/fonts/manrope-latin-800-normal.woff` (téléchargé depuis `https://cdn.jsdelivr.net/npm/@fontsource/manrope@5.2.8/files/manrope-latin-800-normal.woff`)

**Interfaces:**
- Produces: `buildLandingRobotsText(landingOrigin: URL | undefined): string` (exporté par la route) → `User-Agent: *\nAllow: /\n` puis `Sitemap: <origin>/sitemap.xml\n` si l'origine existe. `GET` renvoie ce texte en `text/plain`, `export const dynamic = 'force-static'`.
- Produces: `src/app/vitrine/sitemap.ts` default export → trois entrées (`/`, `/mentions-legales`, `/confidentialite`) en URL absolues sur `readLandingOrigin()`, `[]` si absente.
- Produces: `readLightThemeColour(tokenName: string): string` — lit le bloc `:root { … }` de `src/app/globals.css`, suit les `var(--x)`, renvoie l'hexadécimal ; lève une erreur si le token n'existe pas.
- Produces: `opengraph-image.tsx` exporte `alt = 'Aled — Trouver du boulot depuis ton canapé'`, `size = { width: 1200, height: 630 }`, `contentType = 'image/png'` et une image : fond `--brand-tile`, logo `public/brand/aled-logo-on-dark.png`, accroche du hero avec le passage barré en `--peach`, police Manrope 800.

- [ ] **Step 1: Write the failing tests**
- `buildLandingRobotsText(new URL('https://aled.work'))` === `'User-Agent: *\nAllow: /\nSitemap: https://aled.work/sitemap.xml\n'` ; avec `undefined` → pas de ligne `Sitemap`.
- `sitemap()` avec `LANDING_HOSTNAMES='aled.work'` → URLs `'https://aled.work/'`, `'https://aled.work/mentions-legales'`, `'https://aled.work/confidentialite'` ; sans variable → `[]`.
- `readLightThemeColour('brand-tile')` === `'#1F5C46'` ; `readLightThemeColour('peach')` === `'#FFB48A'` ; `readLightThemeColour('inexistant')` lève une erreur.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/vitrine/robots src/app/vitrine/sitemap src/lib/theme/read-light-theme-colour`
Expected: FAIL.

- [ ] **Step 3: Download the font, implement routes, colour reader and OG image**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/vitrine/robots src/app/vitrine/sitemap src/lib/theme/read-light-theme-colour`
Expected: PASS.

---

### Task 8: Documentation et vérification complète

**Files:**
- Modify: `.env.example` (ajouter `LANDING_HOSTNAMES=` et `APP_ORIGIN=`)
- Modify: `README.md` (section « Landing page » : routage par domaine, deux variables, `/vitrine` en prévisualisation, `http://aled.localhost:3000` en local avec `LANDING_HOSTNAMES=aled.localhost` et `APP_ORIGIN=http://localhost:3000`, checklist de lancement de la spec §7)

- [ ] **Step 1: Update `.env.example` and `README.md`**

- [ ] **Step 2: Run the full checks**

Run: `npx jest && npx tsc --noEmit -p . && npx eslint .`
Expected: tout passe.

- [ ] **Step 3: Build with landing variables**

Run: `LANDING_HOSTNAMES=aled.localhost APP_ORIGIN=http://localhost:3000 npx next build`
Expected: build OK ; `/vitrine`, `/vitrine/mentions-legales`, `/vitrine/confidentialite`, `/vitrine/sitemap.xml`, `/vitrine/robots.txt` et `/vitrine/opengraph-image` prérendus (statiques).

- [ ] **Step 4: Smoke test the landing locally**

Run: `next start` puis `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n'` sur `http://aled.localhost:3000/`, `/mentions-legales`, `/robots.txt`, `/login`, et `http://localhost:3000/vitrine`.
Expected: `200` pour les trois premiers, `308` vers `http://localhost:3000/login` pour `/login`, `200` pour `/vitrine` hors production.
