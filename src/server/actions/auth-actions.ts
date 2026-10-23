'use server'

import 'server-only'
import type { AuthError } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { INVALID_EMAIL_ADDRESS_MESSAGE, isValidEmailAddress } from '@/domain/email-address'
import {
  SIGN_IN_FAILURE_MESSAGE,
  SIGN_IN_RATE_LIMIT_ERROR_CODE,
  findExpectedSignInErrorMessage,
  findSignInCredentialsError,
} from '@/domain/password-sign-in'
import {
  SIGN_UP_MESSAGES,
  findNewPasswordError,
  findSignUpErrorMessage,
  findSignUpInputError,
  isAlreadyRegisteredSignUpError,
  isEmailSendRateLimitSignUpError,
  isExpectedSignUpError,
  isOAuthProvider,
  isProfessionalStatus,
  isRequestRateLimitSignUpError,
  type OAuthProvider,
  type SignUpInput,
} from '@/domain/sign-up'
import { readAppOrigin } from '@/lib/landing/landing-environment'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'

const EMAIL_CONFIRMATION_PATHNAME = '/auth/confirm'

const OAUTH_CALLBACK_PATHNAME = '/auth/callback'

const PASSWORD_UPDATE_ERROR_MESSAGES_BY_CODE: Partial<Record<string, string>> = {
  same_password: SIGN_UP_MESSAGES.samePassword,
  weak_password: SIGN_UP_MESSAGES.weakPassword,
}

const ACTION_SUCCESS: ActionResult<null> = { ok: true, data: null }

const toActionFailure = <Data>(errorMessage: string): ActionResult<Data> => ({ ok: false, errorMessage })

const readAuthErrorDiagnostics = (authError: AuthError) => ({ code: authError.code, status: authError.status })

const buildAppAuthUrl = async (pathname: string): Promise<string> => {
  const appOrigin = readAppOrigin()
  if (appOrigin) return `${appOrigin}${pathname}`
  const requestHeaders = await headers()
  const requestOrigin = requestHeaders.get('origin')
  if (requestOrigin) return `${requestOrigin}${pathname}`
  console.warn('Auth redirect origin missing')
  return pathname
}

const isSignUpInput = (candidate: unknown): candidate is SignUpInput => {
  if (typeof candidate !== 'object' || candidate === null) return false
  const { firstName, email, password, professionalStatus, hasAcceptedTerms } = candidate as Record<string, unknown>
  return (
    typeof firstName === 'string' &&
    typeof email === 'string' &&
    typeof password === 'string' &&
    (professionalStatus === null || isProfessionalStatus(professionalStatus)) &&
    typeof hasAcceptedTerms === 'boolean'
  )
}

const findExpectedPasswordUpdateErrorMessage = (errorCode: string | undefined): string | undefined =>
  errorCode !== undefined && Object.hasOwn(PASSWORD_UPDATE_ERROR_MESSAGES_BY_CODE, errorCode)
    ? PASSWORD_UPDATE_ERROR_MESSAGES_BY_CODE[errorCode]
    : undefined

const toEmailSendingResult = (emailSendingError: AuthError | null, operationLabel: string): ActionResult<null> => {
  if (!emailSendingError || isAlreadyRegisteredSignUpError(emailSendingError.code)) return ACTION_SUCCESS

  if (isEmailSendRateLimitSignUpError(emailSendingError.code)) {
    console.warn(`${operationLabel} email send throttled`, readAuthErrorDiagnostics(emailSendingError))
    return ACTION_SUCCESS
  }

  if (isRequestRateLimitSignUpError(emailSendingError.code)) {
    console.warn(`${operationLabel} throttled`, readAuthErrorDiagnostics(emailSendingError))
  } else if (!isExpectedSignUpError(emailSendingError.code)) {
    console.error(`${operationLabel} failed`, readAuthErrorDiagnostics(emailSendingError))
  }
  return toActionFailure(findSignUpErrorMessage(emailSendingError.code))
}

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

export const signUpWithPassword = async (input: SignUpInput): Promise<ActionResult<null>> => {
  if (!isSignUpInput(input)) return toActionFailure(GENERIC_ACTION_ERROR_MESSAGE)

  const trimmedInput: SignUpInput = { ...input, firstName: input.firstName.trim(), email: input.email.trim() }
  const signUpInputError = findSignUpInputError(trimmedInput)
  if (signUpInputError) return toActionFailure(signUpInputError)

  const supabase = await createServerSupabaseClient()
  const { error: signUpError } = await supabase.auth.signUp({
    email: trimmedInput.email,
    password: trimmedInput.password,
    options: {
      emailRedirectTo: await buildAppAuthUrl(EMAIL_CONFIRMATION_PATHNAME),
      data: {
        first_name: trimmedInput.firstName,
        professional_status: trimmedInput.professionalStatus,
        terms_accepted: true,
      },
    },
  })
  return toEmailSendingResult(signUpError, 'Sign-up')
}

export const resendSignUpConfirmation = async (email: string): Promise<ActionResult<null>> => {
  if (typeof email !== 'string') return toActionFailure(GENERIC_ACTION_ERROR_MESSAGE)

  const trimmedEmail = email.trim()
  if (!isValidEmailAddress(trimmedEmail)) return toActionFailure(INVALID_EMAIL_ADDRESS_MESSAGE)

  const supabase = await createServerSupabaseClient()
  const { error: resendError } = await supabase.auth.resend({
    type: 'signup',
    email: trimmedEmail,
    options: { emailRedirectTo: await buildAppAuthUrl(EMAIL_CONFIRMATION_PATHNAME) },
  })
  return toEmailSendingResult(resendError, 'Sign-up confirmation resend')
}

export const requestPasswordReset = async (email: string): Promise<ActionResult<null>> => {
  if (typeof email !== 'string') return toActionFailure(GENERIC_ACTION_ERROR_MESSAGE)

  const trimmedEmail = email.trim()
  if (!isValidEmailAddress(trimmedEmail)) return toActionFailure(INVALID_EMAIL_ADDRESS_MESSAGE)

  const supabase = await createServerSupabaseClient()
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: await buildAppAuthUrl(EMAIL_CONFIRMATION_PATHNAME),
  })
  if (!resetError) return ACTION_SUCCESS

  if (isEmailSendRateLimitSignUpError(resetError.code)) {
    console.warn('Password reset request email send throttled', readAuthErrorDiagnostics(resetError))
    return ACTION_SUCCESS
  }

  if (isRequestRateLimitSignUpError(resetError.code)) {
    console.warn('Password reset request throttled', readAuthErrorDiagnostics(resetError))
    return toActionFailure(SIGN_UP_MESSAGES.tooManyAttempts)
  }

  console.error('Password reset request failed', readAuthErrorDiagnostics(resetError))
  return ACTION_SUCCESS
}

export const updatePassword = async (password: string, confirmation: string): Promise<ActionResult<null>> => {
  if (typeof password !== 'string' || typeof confirmation !== 'string') {
    return toActionFailure(GENERIC_ACTION_ERROR_MESSAGE)
  }

  const newPasswordError = findNewPasswordError(password, confirmation)
  if (newPasswordError) return toActionFailure(newPasswordError)

  const supabase = await createServerSupabaseClient()
  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (!updateError) return ACTION_SUCCESS

  const expectedPasswordUpdateErrorMessage = findExpectedPasswordUpdateErrorMessage(updateError.code)
  if (expectedPasswordUpdateErrorMessage) return toActionFailure(expectedPasswordUpdateErrorMessage)

  console.error('Password update failed', readAuthErrorDiagnostics(updateError))
  return toActionFailure(SIGN_UP_MESSAGES.passwordUpdateFailure)
}

export const startOAuthSignIn = async (provider: OAuthProvider): Promise<ActionResult<{ url: string }>> => {
  if (!isOAuthProvider(provider)) return toActionFailure(GENERIC_ACTION_ERROR_MESSAGE)

  const supabase = await createServerSupabaseClient()
  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: await buildAppAuthUrl(OAUTH_CALLBACK_PATHNAME) },
  })

  if (oauthError) {
    console.error('OAuth sign-in start failed', readAuthErrorDiagnostics(oauthError))
    return toActionFailure(SIGN_UP_MESSAGES.oauthFailure)
  }

  if (!data.url) {
    console.error('OAuth sign-in start returned no provider URL')
    return toActionFailure(SIGN_UP_MESSAGES.oauthFailure)
  }

  return { ok: true, data: { url: data.url } }
}
