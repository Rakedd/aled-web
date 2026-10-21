'use server'

import 'server-only'
import { redirect } from 'next/navigation'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import {
  SIGN_IN_FAILURE_MESSAGE,
  SIGN_IN_RATE_LIMIT_ERROR_CODE,
  findExpectedSignInErrorMessage,
  findSignInCredentialsError,
} from '@/domain/password-sign-in'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'

export const signInWithPassword = async (email: string, password: string): Promise<ActionResult<null>> => {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
  }

  const trimmedEmail = email.trim()
  const credentialsError = findSignInCredentialsError(trimmedEmail, password)
  if (credentialsError) return { ok: false, errorMessage: credentialsError }

  const supabase = await createServerSupabaseClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
  if (!signInError) return { ok: true, data: null }

  if (signInError.code === SIGN_IN_RATE_LIMIT_ERROR_CODE) {
    console.warn('Password sign-in throttled', { code: signInError.code })
  }

  const expectedSignInErrorMessage = findExpectedSignInErrorMessage(signInError.code)
  if (expectedSignInErrorMessage) return { ok: false, errorMessage: expectedSignInErrorMessage }

  console.error('Password sign-in failed', { code: signInError.code, status: signInError.status })
  return { ok: false, errorMessage: SIGN_IN_FAILURE_MESSAGE }
}

export const signOut = async (): Promise<void> => {
  const supabase = await createServerSupabaseClient()
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) console.error('Sign out failed', { code: signOutError.code, status: signOutError.status })
  redirect('/login')
}
