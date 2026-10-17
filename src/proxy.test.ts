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

  it.each(['/login', '/auth/confirm'])('lets an unauthenticated request reach the public path %s', async (pathname) => {
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
