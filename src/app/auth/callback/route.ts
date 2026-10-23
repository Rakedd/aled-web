import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthRedirectUrl } from '@/app/auth/build-auth-redirect-url'
import { HOME_ROUTE } from '@/domain/routes'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

const redirectToOAuthFailure = (request: NextRequest) =>
  NextResponse.redirect(buildAuthRedirectUrl(request, '/login', { error: 'oauth' }))

const recordTermsAcceptanceIfMissing = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<void> => {
  const { error: recordingError, status } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', userId)
    .is('terms_accepted_at', null)
  if (recordingError) console.warn('Terms acceptance recording failed', { code: recordingError.code, status })
}

export const GET = async (request: NextRequest) => {
  const authorizationCode = request.nextUrl.searchParams.get('code')
  const hasProviderError = request.nextUrl.searchParams.has('error')
  if (hasProviderError || !authorizationCode) return redirectToOAuthFailure(request)

  const supabase = await createServerSupabaseClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authorizationCode)
  if (exchangeError) {
    console.warn('OAuth code exchange failed', { code: exchangeError.code, status: exchangeError.status })
    return redirectToOAuthFailure(request)
  }

  await recordTermsAcceptanceIfMissing(supabase, data.user.id)
  return NextResponse.redirect(buildAuthRedirectUrl(request, HOME_ROUTE))
}
