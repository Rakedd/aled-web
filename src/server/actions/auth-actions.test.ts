import { AuthApiError } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { signInWithPassword, signOut } from './auth-actions'

jest.mock('server-only', () => ({}))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const authSignInWithPassword = jest.fn()
const authSignOut = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createServerSupabaseClient).mockResolvedValue(
    { auth: { signInWithPassword: authSignInWithPassword, signOut: authSignOut } } as unknown as Awaited<
      ReturnType<typeof createServerSupabaseClient>
    >,
  )
})

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

    await signOut()

    expect(authSignOut).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
