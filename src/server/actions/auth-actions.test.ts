import { AuthApiError } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SIGN_UP_MESSAGES, type SignUpInput } from '@/domain/sign-up'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import {
  requestPasswordReset,
  resendSignUpConfirmation,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startOAuthSignIn,
  updatePassword,
} from './auth-actions'

jest.mock('server-only', () => ({}))
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const authSignInWithPassword = jest.fn()
const authSignOut = jest.fn()
const authSignUp = jest.fn()
const authResend = jest.fn()
const authResetPasswordForEmail = jest.fn()
const authUpdateUser = jest.fn()
const authSignInWithOAuth = jest.fn()

const ORIGINAL_ENVIRONMENT = process.env
const APP_ORIGIN = 'https://app.aled.work'
const REQUEST_ORIGIN = 'http://localhost:3000'

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENVIRONMENT, APP_ORIGIN: `${APP_ORIGIN}/` }
  jest.mocked(headers).mockResolvedValue(
    new Headers({ origin: REQUEST_ORIGIN }) as unknown as Awaited<ReturnType<typeof headers>>,
  )
  jest.mocked(createServerSupabaseClient).mockResolvedValue(
    {
      auth: {
        signInWithPassword: authSignInWithPassword,
        signOut: authSignOut,
        signUp: authSignUp,
        resend: authResend,
        resetPasswordForEmail: authResetPasswordForEmail,
        updateUser: authUpdateUser,
        signInWithOAuth: authSignInWithOAuth,
      },
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  )
})

afterAll(() => {
  process.env = ORIGINAL_ENVIRONMENT
})

const spyOnConsoleError = () => jest.spyOn(console, 'error').mockImplementation(() => undefined)

const spyOnConsoleWarn = () => jest.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('signInWithPassword', () => {
  it('rejects an invalid email without calling Supabase', async () => {
    await expect(signInWithPassword('not-an-email', 'secret')).resolves.toEqual({
      ok: false,
      errorMessage: 'Adresse e-mail invalide',
    })
    expect(authSignInWithPassword).not.toHaveBeenCalled()
  })

  it('rejects an empty password without calling Supabase', async () => {
    await expect(signInWithPassword('freelance@example.com', '')).resolves.toEqual({
      ok: false,
      errorMessage: 'Saisis ton mot de passe.',
    })
    expect(authSignInWithPassword).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, 'secret'],
    [42, 'secret'],
    ['freelance@example.com', null],
    ['freelance@example.com', { password: 'secret' }],
  ])('rejects the non-string payload (%p, %p) without calling Supabase', async (email, password) => {
    await expect(signInWithPassword(email as unknown as string, password as unknown as string)).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authSignInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in with the trimmed email and the untouched password', async () => {
    authSignInWithPassword.mockResolvedValue({ data: {}, error: null })

    await expect(signInWithPassword(' freelance@example.com ', ' secret ')).resolves.toEqual({ ok: true, data: null })
    expect(authSignInWithPassword).toHaveBeenCalledWith({ email: 'freelance@example.com', password: ' secret ' })
  })

  it('reports wrong credentials with one message for both unknown emails and wrong passwords', async () => {
    authSignInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    })

    await expect(signInWithPassword('freelance@example.com', 'wrong')).resolves.toEqual({
      ok: false,
      errorMessage: 'E-mail ou mot de passe incorrect.',
    })
  })

  it('explains that an unconfirmed account cannot sign in yet', async () => {
    authSignInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
    })

    await expect(signInWithPassword('freelance@example.com', 'secret')).resolves.toEqual({
      ok: false,
      errorMessage: "Ton compte n'est pas encore activé.",
    })
  })

  it('asks to retry later and warns the operator with the error code only when sign-ins are throttled', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    authSignInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    })

    await expect(signInWithPassword('freelance@example.com', 'secret')).resolves.toEqual({
      ok: false,
      errorMessage: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.',
    })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Password sign-in throttled', { code: 'over_request_rate_limit' })
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain('freelance@example.com')
    consoleWarnSpy.mockRestore()
  })

  it('reports a generic error and logs it without credentials when Supabase fails for another reason', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    authSignInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Unexpected failure', 500, 'unexpected_failure'),
    })

    await expect(signInWithPassword('freelance@example.com', 'secret')).resolves.toEqual({
      ok: false,
      errorMessage: 'Connexion impossible pour le moment. Réessaie dans quelques minutes.',
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Password sign-in failed', { code: 'unexpected_failure', status: 500 })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toMatch(/freelance@example\.com|secret/)
    consoleErrorSpy.mockRestore()
  })
})

describe('signOut', () => {
  it('ends the Supabase session and redirects to the login page', async () => {
    authSignOut.mockResolvedValue({ error: null })

    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT')

    expect(authSignOut).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})

const validSignUpInput: SignUpInput = {
  firstName: '  Ada  ',
  email: ' ada@example.com ',
  password: 'correct horse battery',
  professionalStatus: 'freelance',
  hasAcceptedTerms: true,
}

describe('signUpWithPassword', () => {
  it('signs up with the trimmed first name and email, the profile metadata and the confirmation link', async () => {
    authSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({ ok: true, data: null })
    expect(authSignUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct horse battery',
      options: {
        emailRedirectTo: `${APP_ORIGIN}/auth/confirm`,
        data: { first_name: 'Ada', professional_status: 'freelance', terms_accepted: true },
      },
    })
  })

  it('falls back to the request origin for the confirmation link when APP_ORIGIN is not set', async () => {
    delete process.env.APP_ORIGIN
    authSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    await signUpWithPassword(validSignUpInput)

    expect(authSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ emailRedirectTo: `${REQUEST_ORIGIN}/auth/confirm` }),
      }),
    )
  })

  it('warns and uses a relative confirmation link when neither APP_ORIGIN nor the request origin is known', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    delete process.env.APP_ORIGIN
    jest.mocked(headers).mockResolvedValue(new Headers() as unknown as Awaited<ReturnType<typeof headers>>)
    authSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    await signUpWithPassword(validSignUpInput)

    expect(consoleWarnSpy).toHaveBeenCalledWith('Auth redirect origin missing')
    expect(authSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: '/auth/confirm' }) }),
    )
    consoleWarnSpy.mockRestore()
  })

  it('rejects an invalid input without calling Supabase', async () => {
    await expect(signUpWithPassword({ ...validSignUpInput, firstName: '   ' })).resolves.toEqual({
      ok: false,
      errorMessage: 'Saisis ton prénom.',
    })
    expect(authSignUp).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...validSignUpInput, professionalStatus: 'admin' }],
    [{ ...validSignUpInput, hasAcceptedTerms: 'yes' }],
    [{ ...validSignUpInput, email: 42 }],
    [null],
  ])('rejects the malformed payload %p without calling Supabase', async (malformedInput) => {
    await expect(signUpWithPassword(malformedInput as unknown as SignUpInput)).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authSignUp).not.toHaveBeenCalled()
  })

  it.each(['user_already_exists', 'email_exists'])(
    'answers like a new sign-up when Supabase reports %s, so the address stays secret',
    async (alreadyRegisteredCode) => {
      authSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError('User already registered', 422, alreadyRegisteredCode),
      })

      await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({ ok: true, data: null })
    },
  )

  it('answers like a new sign-up when the email sending to this address is throttled, so the address stays secret', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    })

    await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({ ok: true, data: null })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Sign-up email send throttled', {
      code: 'over_email_send_rate_limit',
      status: 429,
    })
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain('ada@example.com')
    consoleWarnSpy.mockRestore()
  })

  it('asks to retry later and warns with the error code only when requests from this client are throttled', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    })

    await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.tooManyAttempts,
    })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Sign-up throttled', { code: 'over_request_rate_limit', status: 429 })
    consoleWarnSpy.mockRestore()
  })

  it('explains that Supabase refused a weak password', async () => {
    authSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Password is known to be weak', 422, 'weak_password'),
    })

    await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.weakPassword,
    })
  })

  it('reports a generic error and logs only the code and status when Supabase fails unexpectedly', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Unexpected failure', 500, 'unexpected_failure'),
    })

    await expect(signUpWithPassword(validSignUpInput)).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.failure,
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Sign-up failed', { code: 'unexpected_failure', status: 500 })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toMatch(/ada@example\.com|correct horse/)
    consoleErrorSpy.mockRestore()
  })
})

describe('resendSignUpConfirmation', () => {
  it('resends the sign-up email to the trimmed address with the confirmation link', async () => {
    authResend.mockResolvedValue({ data: {}, error: null })

    await expect(resendSignUpConfirmation(' ada@example.com ')).resolves.toEqual({ ok: true, data: null })
    expect(authResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ada@example.com',
      options: { emailRedirectTo: `${APP_ORIGIN}/auth/confirm` },
    })
  })

  it('rejects an invalid email without calling Supabase', async () => {
    await expect(resendSignUpConfirmation('not-an-email')).resolves.toEqual({
      ok: false,
      errorMessage: 'Adresse e-mail invalide',
    })
    expect(authResend).not.toHaveBeenCalled()
  })

  it('rejects a non-string payload without calling Supabase', async () => {
    await expect(resendSignUpConfirmation(42 as unknown as string)).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authResend).not.toHaveBeenCalled()
  })

  it.each(['user_already_exists', 'email_exists'])('answers like a normal resend when Supabase reports %s', async (code) => {
    authResend.mockResolvedValue({ data: {}, error: new AuthApiError('Already registered', 422, code) })

    await expect(resendSignUpConfirmation('ada@example.com')).resolves.toEqual({ ok: true, data: null })
  })

  it('answers like a normal resend when the email sending to this address is throttled', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authResend.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    })

    await expect(resendSignUpConfirmation('ada@example.com')).resolves.toEqual({ ok: true, data: null })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Sign-up confirmation resend email send throttled', {
      code: 'over_email_send_rate_limit',
      status: 429,
    })
    consoleWarnSpy.mockRestore()
  })

  it('asks to retry later when requests from this client are throttled', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authResend.mockResolvedValue({
      data: {},
      error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    })

    await expect(resendSignUpConfirmation('ada@example.com')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.tooManyAttempts,
    })
    consoleWarnSpy.mockRestore()
  })

  it('reports a generic error and logs only the code and status when Supabase fails unexpectedly', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authResend.mockResolvedValue({ data: {}, error: new AuthApiError('Unexpected failure', 500, 'unexpected_failure') })

    await expect(resendSignUpConfirmation('ada@example.com')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.failure,
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Sign-up confirmation resend failed', {
      code: 'unexpected_failure',
      status: 500,
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('ada@example.com')
    consoleErrorSpy.mockRestore()
  })
})

describe('requestPasswordReset', () => {
  it('sends the reset email to the trimmed address with the confirmation link', async () => {
    authResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    await expect(requestPasswordReset(' ada@example.com ')).resolves.toEqual({ ok: true, data: null })
    expect(authResetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: `${APP_ORIGIN}/auth/confirm`,
    })
  })

  it('rejects an invalid email without calling Supabase', async () => {
    await expect(requestPasswordReset('not-an-email')).resolves.toEqual({
      ok: false,
      errorMessage: 'Adresse e-mail invalide',
    })
    expect(authResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rejects a non-string payload without calling Supabase', async () => {
    await expect(requestPasswordReset(undefined as unknown as string)).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('answers that the link is on its way when the email sending to this address is throttled', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    })

    await expect(requestPasswordReset('ada@example.com')).resolves.toEqual({ ok: true, data: null })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Password reset request email send throttled', {
      code: 'over_email_send_rate_limit',
      status: 429,
    })
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain('ada@example.com')
    consoleWarnSpy.mockRestore()
  })

  it('asks to retry later when requests from this client are throttled', async () => {
    const consoleWarnSpy = spyOnConsoleWarn()
    authResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    })

    await expect(requestPasswordReset('ada@example.com')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.tooManyAttempts,
    })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Password reset request throttled', {
      code: 'over_request_rate_limit',
      status: 429,
    })
    consoleWarnSpy.mockRestore()
  })

  it('still answers that the link is on its way when Supabase fails for another reason, and logs only code and status', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new AuthApiError('Unexpected failure', 500, 'unexpected_failure'),
    })

    await expect(requestPasswordReset('ada@example.com')).resolves.toEqual({ ok: true, data: null })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Password reset request failed', {
      code: 'unexpected_failure',
      status: 500,
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('ada@example.com')
    consoleErrorSpy.mockRestore()
  })
})

describe('updatePassword', () => {
  it('updates the password of the signed-in user', async () => {
    authUpdateUser.mockResolvedValue({ data: { user: {} }, error: null })

    await expect(updatePassword('new password 1', 'new password 1')).resolves.toEqual({ ok: true, data: null })
    expect(authUpdateUser).toHaveBeenCalledWith({ password: 'new password 1' })
  })

  it('rejects a confirmation that does not match without calling Supabase', async () => {
    await expect(updatePassword('new password 1', 'new password 2')).resolves.toEqual({
      ok: false,
      errorMessage: 'Les deux mots de passe ne correspondent pas.',
    })
    expect(authUpdateUser).not.toHaveBeenCalled()
  })

  it('rejects a non-string payload without calling Supabase', async () => {
    await expect(updatePassword(null as unknown as string, 'new password 1')).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authUpdateUser).not.toHaveBeenCalled()
  })

  it('asks for a different password when it matches the current one', async () => {
    authUpdateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('New password should be different', 422, 'same_password'),
    })

    await expect(updatePassword('new password 1', 'new password 1')).resolves.toEqual({
      ok: false,
      errorMessage: "Choisis un mot de passe différent de l'actuel.",
    })
  })

  it('explains that Supabase refused a weak password', async () => {
    authUpdateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('Password is known to be weak', 422, 'weak_password'),
    })

    await expect(updatePassword('new password 1', 'new password 1')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.weakPassword,
    })
  })

  it('reports the update failure and logs only the code and status when Supabase fails unexpectedly', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authUpdateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('Auth session missing', 400, 'session_not_found'),
    })

    await expect(updatePassword('new password 1', 'new password 1')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.passwordUpdateFailure,
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Password update failed', { code: 'session_not_found', status: 400 })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('new password 1')
    consoleErrorSpy.mockRestore()
  })
})

describe('startOAuthSignIn', () => {
  it('returns the provider URL from Supabase without redirecting, with the callback route as return address', async () => {
    authSignInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?state=abc' },
      error: null,
    })

    await expect(startOAuthSignIn('google')).resolves.toEqual({
      ok: true,
      data: { url: 'https://accounts.google.com/o/oauth2/auth?state=abc' },
    })
    expect(authSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${APP_ORIGIN}/auth/callback` },
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rejects an unknown provider without calling Supabase', async () => {
    await expect(startOAuthSignIn('github' as unknown as 'google')).resolves.toEqual({
      ok: false,
      errorMessage: 'Une erreur est survenue, réessaie.',
    })
    expect(authSignInWithOAuth).not.toHaveBeenCalled()
  })

  it('reports the OAuth failure and logs only the code and status when Supabase fails', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authSignInWithOAuth.mockResolvedValue({
      data: { provider: 'linkedin_oidc', url: null },
      error: new AuthApiError('Provider is not enabled', 400, 'validation_failed'),
    })

    await expect(startOAuthSignIn('linkedin_oidc')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.oauthFailure,
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('OAuth sign-in start failed', { code: 'validation_failed', status: 400 })
    expect(redirect).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('reports the OAuth failure when Supabase returns no provider URL', async () => {
    const consoleErrorSpy = spyOnConsoleError()
    authSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: null }, error: null })

    await expect(startOAuthSignIn('google')).resolves.toEqual({
      ok: false,
      errorMessage: SIGN_UP_MESSAGES.oauthFailure,
    })
    expect(redirect).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
