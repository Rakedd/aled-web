import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { HOME_ROUTE } from '@/domain/routes'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'

const SUPPORTED_EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'invite']

const isSupportedEmailOtpType = (otpType: string | null): otpType is EmailOtpType =>
  otpType !== null && SUPPORTED_EMAIL_OTP_TYPES.includes(otpType)

const buildRedirectUrl = (request: NextRequest, pathname: string, searchParameters: Record<string, string> = {}) => {
  const redirectUrl = new URL(pathname, request.url)
  redirectUrl.search = new URLSearchParams(searchParameters).toString()
  return redirectUrl
}

export const GET = async (request: NextRequest) => {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const otpType = request.nextUrl.searchParams.get('type')

  if (tokenHash && isSupportedEmailOtpType(otpType)) {
    const supabase = await createServerSupabaseClient()
    const { error: verificationError } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    if (!verificationError) return NextResponse.redirect(buildRedirectUrl(request, HOME_ROUTE))
    console.warn('Magic link verification failed', { code: verificationError.code, status: verificationError.status })
  }

  return NextResponse.redirect(buildRedirectUrl(request, '/login', { error: 'invalid-link' }))
}
