'use server'

import 'server-only'
import type { AuthError } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/domain/action-result'
import { INVALID_EMAIL_ADDRESS_MESSAGE, isValidEmailAddress } from '@/domain/email-address'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'

const MAGIC_LINK_FAILURE_MESSAGE =
  "Impossible d'envoyer le lien de connexion pour le moment. Réessaie dans quelques minutes."

const ACCOUNT_REVEALING_ERROR_CODES = new Set([
  'otp_disabled',
  'signup_disabled',
  'user_not_found',
  'over_email_send_rate_limit',
])

const isAccountRevealingError = (authError: AuthError): boolean =>
  authError.code !== undefined && ACCOUNT_REVEALING_ERROR_CODES.has(authError.code)

export const requestMagicLink = async (email: string): Promise<ActionResult<null>> => {
  if (typeof email !== 'string') return { ok: false, errorMessage: INVALID_EMAIL_ADDRESS_MESSAGE }

  const trimmedEmail = email.trim()
  if (!isValidEmailAddress(trimmedEmail)) return { ok: false, errorMessage: INVALID_EMAIL_ADDRESS_MESSAGE }

  const supabase = await createServerSupabaseClient()
  const { error: signInError } = await supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: { shouldCreateUser: false },
  })

  if (signInError?.code === 'over_email_send_rate_limit') {
    console.warn('Magic link email throttled', { code: signInError.code })
  }

  if (signInError && !isAccountRevealingError(signInError)) {
    console.error('Magic link request failed', { code: signInError.code, status: signInError.status })
    return { ok: false, errorMessage: MAGIC_LINK_FAILURE_MESSAGE }
  }

  return { ok: true, data: null }
}

export const signOut = async (): Promise<void> => {
  const supabase = await createServerSupabaseClient()
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) console.error('Sign out failed', { code: signOutError.code, status: signOutError.status })
  redirect('/login')
}
