import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthRedirectUrl } from '@/app/auth/build-auth-redirect-url'
import { HOME_ROUTE, NEW_PASSWORD_ROUTE } from '@/domain/routes'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'

const SUPPORTED_EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'invite', 'signup', 'recovery']

const isSupportedEmailOtpType = (otpType: string | null): otpType is EmailOtpType =>
  otpType !== null && SUPPORTED_EMAIL_OTP_TYPES.includes(otpType)

const findVerifiedLinkDestination = (otpType: EmailOtpType): string =>
  otpType === 'recovery' ? NEW_PASSWORD_ROUTE : HOME_ROUTE

export const GET = async (request: NextRequest) => {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const otpType = request.nextUrl.searchParams.get('type')

  if (tokenHash && isSupportedEmailOtpType(otpType)) {
    const supabase = await createServerSupabaseClient()
    const { error: verificationError } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    if (!verificationError) {
      return NextResponse.redirect(buildAuthRedirectUrl(request, findVerifiedLinkDestination(otpType)))
    }
    console.warn('Magic link verification failed', { code: verificationError.code, status: verificationError.status })
  }

  return NextResponse.redirect(buildAuthRedirectUrl(request, '/login', { error: 'invalid-link' }))
}
