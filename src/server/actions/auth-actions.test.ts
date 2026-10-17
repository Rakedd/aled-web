import { AuthApiError } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { requestMagicLink, signOut } from './auth-actions'

jest.mock('server-only', () => ({}))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const signInWithOtp = jest.fn()
const authSignOut = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createServerSupabaseClient).mockResolvedValue(
    { auth: { signInWithOtp, signOut: authSignOut } } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  )
})

describe('requestMagicLink', () => {
  it('rejects an invalid email without calling Supabase', async () => {
    await expect(requestMagicLink('not-an-email')).resolves.toEqual({ ok: false, errorMessage: 'Adresse e-mail invalide' })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('asks Supabase for a magic link without creating any account', async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null })

    await expect(requestMagicLink(' freelance@example.com ')).resolves.toEqual({ ok: true, data: null })
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'freelance@example.com', options: { shouldCreateUser: false } })
  })

  it('reports success for an email that was never invited, so accounts cannot be enumerated', async () => {
    signInWithOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled'),
    })

    await expect(requestMagicLink('stranger@example.com')).resolves.toEqual({ ok: true, data: null })
  })

  it('reports a generic error when Supabase fails for another reason', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    signInWithOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    })

    await expect(requestMagicLink('freelance@example.com')).resolves.toEqual({
      ok: false,
      errorMessage: "Impossible d'envoyer le lien de connexion pour le moment. Réessaie dans quelques minutes.",
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
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
