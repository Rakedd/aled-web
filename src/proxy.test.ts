/** @jest-environment node */
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/supabase-environment', () => ({
  readSupabaseEnvironmentVariable: (variableName: string) => `test-${variableName}`,
}))
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))

const EXPIRED_AUTH_COOKIE = { name: 'sb-127-auth-token', value: '', options: { path: '/', maxAge: 0 } }
const AUTH_CACHE_HEADERS = { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0' }

const mockSupabaseSession = ({ claims, clearsAuthCookie }: { claims: { sub: string } | null; clearsAuthCookie: boolean }) => {
  jest.mocked(createServerClient).mockImplementation(((
    _supabaseUrl: string,
    _supabaseKey: string,
    { cookies }: { cookies: CookieMethodsServer },
  ) => ({
    auth: {
      getClaims: async () => {
        if (clearsAuthCookie) await cookies.setAll?.([EXPIRED_AUTH_COOKIE], AUTH_CACHE_HEADERS)
        return { data: claims ? { claims } : null, error: null }
      },
    },
  })) as unknown as typeof createServerClient)
}

const buildRequest = (pathname: string) => new NextRequest(new URL(pathname, 'http://localhost:3000'))

describe('proxy', () => {
  it('redirects an unauthenticated request for an app route to the login page', async () => {
    mockSupabaseSession({ claims: null, clearsAuthCookie: false })

    const response = await proxy(buildRequest('/calendar?view=week'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('keeps the auth cookies cleared by Supabase on the login redirect', async () => {
    mockSupabaseSession({ claims: null, clearsAuthCookie: true })

    const response = await proxy(buildRequest('/'))

    expect(response.status).toBe(307)
    expect(response.cookies.get(EXPIRED_AUTH_COOKIE.name)).toMatchObject({ value: '', maxAge: 0, path: '/' })
    expect(response.headers.get('cache-control')).toBe(AUTH_CACHE_HEADERS['Cache-Control'])
  })

  it.each(['/login', '/auth/confirm', '/robots.txt'])('lets an unauthenticated request reach the public path %s', async (pathname) => {
    mockSupabaseSession({ claims: null, clearsAuthCookie: false })

    const response = await proxy(buildRequest(pathname))

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('lets an authenticated request through with its refreshed cookies', async () => {
    mockSupabaseSession({ claims: { sub: 'user-id' }, clearsAuthCookie: true })

    const response = await proxy(buildRequest('/'))

    expect(response.headers.get('location')).toBeNull()
    expect(response.cookies.get(EXPIRED_AUTH_COOKIE.name)).toMatchObject({ value: '' })
  })
})

const ORIGINAL_ENVIRONMENT = process.env

const buildRequestForUrl = (url: string) => new NextRequest(new URL(url))

const readRewrittenPathname = (response: Response): string | null => {
  const rewrittenUrl = response.headers.get('x-middleware-rewrite')
  return rewrittenUrl ? new URL(rewrittenUrl).pathname : null
}

describe('proxy on the landing domain', () => {
  beforeEach(() => {
    jest.mocked(createServerClient).mockClear()
    process.env = {
      ...ORIGINAL_ENVIRONMENT,
      LANDING_HOSTNAMES: 'aled.work,www.aled.work',
      APP_ORIGIN: 'https://app.aled.work',
    }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENVIRONMENT
  })

  it('serves the landing home without touching Supabase', async () => {
    const response = await proxy(buildRequestForUrl('https://aled.work/'))

    expect(readRewrittenPathname(response)).toBe('/vitrine')
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it.each([
    ['https://aled.work/mentions-legales', '/vitrine/mentions-legales'],
    ['https://aled.work/robots.txt', '/vitrine/robots.txt'],
    ['https://aled.work/sitemap.xml', '/vitrine/sitemap.xml'],
  ])('rewrites %s to the internal landing page %s', async (url, internalPathname) => {
    const response = await proxy(buildRequestForUrl(url))

    expect(readRewrittenPathname(response)).toBe(internalPathname)
  })

  it('lets an internal landing asset through without rewriting it twice', async () => {
    const response = await proxy(buildRequestForUrl('https://aled.work/vitrine/opengraph-image'))

    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('redirects www to the bare landing domain', async () => {
    const response = await proxy(buildRequestForUrl('https://www.aled.work/confidentialite'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://aled.work/confidentialite')
  })

  it.each([
    ['https://aled.work/login?error=invalid-link', 'https://app.aled.work/login?error=invalid-link'],
    [
      'https://aled.work/auth/confirm?token_hash=abc&type=email',
      'https://app.aled.work/auth/confirm?token_hash=abc&type=email',
    ],
    ['https://aled.work/candidatures/42', 'https://app.aled.work/candidatures/42'],
  ])('sends the old app link %s to the app', async (url, appUrl) => {
    const response = await proxy(buildRequestForUrl(url))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(appUrl)
  })

  it('recognises the landing from the Host header when the server builds URLs with its own hostname', async () => {
    const response = await proxy(new NextRequest(new URL('http://localhost:3000/'), { headers: { host: 'aled.work' } }))

    expect(readRewrittenPathname(response)).toBe('/vitrine')
  })

  it('redirects www to the bare domain named by the Host header', async () => {
    const response = await proxy(
      new NextRequest(new URL('https://localhost:3000/confidentialite'), { headers: { host: 'www.aled.work' } }),
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://aled.work/confidentialite')
  })

  it('never redirects www to another site named by a forged Host header', async () => {
    const response = await proxy(
      new NextRequest(new URL('https://localhost:3000/confidentialite'), { headers: { host: 'www.aled.work:@evil.com' } }),
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://aled.work/confidentialite')
  })

  it('recognises the local landing hostname with its port', async () => {
    process.env.LANDING_HOSTNAMES = 'aled.localhost'

    const response = await proxy(buildRequestForUrl('http://aled.localhost:3000/'))

    expect(readRewrittenPathname(response)).toBe('/vitrine')
  })

  it('hides the internal landing segment on the production app domain', async () => {
    process.env.VERCEL_ENV = 'production'

    const response = await proxy(buildRequestForUrl('https://app.aled.work/vitrine'))

    expect(response.status).toBe(404)
  })

  it('lets a preview deployment show the landing without logging in', async () => {
    process.env.VERCEL_ENV = 'preview'

    const response = await proxy(buildRequestForUrl('https://aled-preview.vercel.app/vitrine/mentions-legales'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(createServerClient).not.toHaveBeenCalled()
  })
})
