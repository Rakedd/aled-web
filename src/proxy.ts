import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  SIGN_IN_PATHNAME,
  SIGN_UP_PATHNAME,
  isAppPathname,
  isLandingHostname,
  isLandingInternalPathname,
  isWwwHostname,
  toBareLandingHost,
  toLandingInternalPathname,
} from '@/domain/landing-routing'
import { FORGOT_PASSWORD_ROUTE, HOME_ROUTE } from '@/domain/routes'
import { isProductionDeployment, readAppOrigin, readLandingHostnames } from '@/lib/landing/landing-environment'
import type { Database } from '@/server/supabase/database-types'
import { readSupabaseEnvironmentVariable } from '@/server/supabase/supabase-environment'

const PUBLIC_PATHNAMES = [
  SIGN_IN_PATHNAME,
  SIGN_UP_PATHNAME,
  FORGOT_PASSWORD_ROUTE,
  '/auth/confirm',
  '/auth/callback',
  '/robots.txt',
  '/.well-known',
]

const SIGNED_OUT_ONLY_PATHNAMES = [SIGN_IN_PATHNAME, SIGN_UP_PATHNAME]

const PERMANENT_REDIRECT_STATUS = 308

const isPublicPathname = (pathname: string): boolean =>
  PUBLIC_PATHNAMES.some((publicPathname) => pathname === publicPathname || pathname.startsWith(`${publicPathname}/`))

const isSignedOutOnlyPageRequest = (request: NextRequest): boolean =>
  request.method === 'GET' && SIGNED_OUT_ONLY_PATHNAMES.includes(request.nextUrl.pathname)

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

  const redirectKeepingSession = (pathname: string): NextResponse => {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = pathname
    redirectUrl.search = ''
    const redirectResponse = NextResponse.redirect(redirectUrl)
    sessionResponse.cookies.getAll().forEach((authCookie) => redirectResponse.cookies.set(authCookie))
    Object.entries(authCacheHeaders).forEach(([headerName, headerValue]) =>
      redirectResponse.headers.set(headerName, headerValue),
    )
    return redirectResponse
  }

  if (!isAuthenticated && !isPublicPathname(request.nextUrl.pathname)) return redirectKeepingSession(SIGN_IN_PATHNAME)
  if (isAuthenticated && isSignedOutOnlyPageRequest(request)) return redirectKeepingSession(HOME_ROUTE)

  return sessionResponse
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
