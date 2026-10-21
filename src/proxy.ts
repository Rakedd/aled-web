import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isAppPathname,
  isLandingHostname,
  isLandingInternalPathname,
  isWwwHostname,
  toBareLandingHost,
  toLandingInternalPathname,
} from '@/domain/landing-routing'
import { isProductionDeployment, readAppOrigin, readLandingHostnames } from '@/lib/landing/landing-environment'
import type { Database } from '@/server/supabase/database-types'
import { readSupabaseEnvironmentVariable } from '@/server/supabase/supabase-environment'

const PUBLIC_PATHNAMES = ['/login', '/auth/confirm', '/robots.txt', '/.well-known']

const PERMANENT_REDIRECT_STATUS = 308

const isPublicPathname = (pathname: string): boolean =>
  PUBLIC_PATHNAMES.some((publicPathname) => pathname === publicPathname || pathname.startsWith(`${publicPathname}/`))

const readRequestHost = (request: NextRequest): string => request.headers.get('host') ?? request.nextUrl.host

const routeLandingRequest = (request: NextRequest, requestHost: string): NextResponse => {
  const { pathname, search, protocol } = request.nextUrl

  if (isWwwHostname(requestHost)) {
    const bareLandingUrl = new URL(`${pathname}${search}`, `${protocol}//${toBareLandingHost(requestHost)}`)
    return NextResponse.redirect(bareLandingUrl, PERMANENT_REDIRECT_STATUS)
  }

  if (isLandingInternalPathname(pathname)) return NextResponse.next()

  const appOrigin = readAppOrigin()
  if (appOrigin && isAppPathname(pathname)) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, appOrigin), PERMANENT_REDIRECT_STATUS)
  }

  const internalLandingUrl = request.nextUrl.clone()
  internalLandingUrl.pathname = toLandingInternalPathname(pathname)
  return NextResponse.rewrite(internalLandingUrl)
}

const routeInternalLandingRequestOnAppDomain = (): NextResponse =>
  isProductionDeployment() ? new NextResponse(null, { status: 404 }) : NextResponse.next()

export const proxy = async (request: NextRequest) => {
  const requestHost = readRequestHost(request)
  if (isLandingHostname(requestHost, readLandingHostnames())) return routeLandingRequest(request, requestHost)
  if (isLandingInternalPathname(request.nextUrl.pathname)) return routeInternalLandingRequestOnAppDomain()

  let sessionResponse = NextResponse.next({ request })
  let authCacheHeaders: Record<string, string> = {}

  const supabase = createServerClient<Database>(
    readSupabaseEnvironmentVariable('SUPABASE_URL'),
    readSupabaseEnvironmentVariable('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          sessionResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options))
          authCacheHeaders = { ...authCacheHeaders, ...headers }
          Object.entries(authCacheHeaders).forEach(([headerName, headerValue]) =>
            sessionResponse.headers.set(headerName, headerValue),
          )
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims)

  if (!isAuthenticated && !isPublicPathname(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    const loginRedirectResponse = NextResponse.redirect(loginUrl)
    sessionResponse.cookies.getAll().forEach((authCookie) => loginRedirectResponse.cookies.set(authCookie))
    Object.entries(authCacheHeaders).forEach(([headerName, headerValue]) =>
      loginRedirectResponse.headers.set(headerName, headerValue),
    )
    return loginRedirectResponse
  }

  return sessionResponse
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
