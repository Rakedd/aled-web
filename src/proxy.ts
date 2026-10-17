import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/server/supabase/database-types'
import { readSupabaseEnvironmentVariable } from '@/server/supabase/supabase-environment'

const PUBLIC_PATHNAMES = ['/login', '/auth/confirm']

const isPublicPathname = (pathname: string): boolean =>
  PUBLIC_PATHNAMES.some((publicPathname) => pathname === publicPathname || pathname.startsWith(`${publicPathname}/`))

export const proxy = async (request: NextRequest) => {
  let sessionResponse = NextResponse.next({ request })

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
          Object.entries(headers).forEach(([headerName, headerValue]) => sessionResponse.headers.set(headerName, headerValue))
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
    return NextResponse.redirect(loginUrl)
  }

  return sessionResponse
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
