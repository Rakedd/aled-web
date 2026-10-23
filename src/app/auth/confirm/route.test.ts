/** @jest-environment node */
import { AuthApiError } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { GET } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const authVerifyOtp = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createServerSupabaseClient).mockResolvedValue(
    { auth: { verifyOtp: authVerifyOtp } } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  )
})

const requestConfirmation = (searchParameters: Record<string, string>) =>
  GET(new NextRequest(new URL(`/auth/confirm?${new URLSearchParams(searchParameters)}`, 'http://localhost:3000')))

describe('GET /auth/confirm', () => {
  it('opens the new password page after a verified recovery link', async () => {
    authVerifyOtp.mockResolvedValue({ data: {}, error: null })

    const response = await requestConfirmation({ token_hash: 'recovery-hash', type: 'recovery' })

    expect(authVerifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'recovery-hash' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/mot-de-passe/nouveau')
  })

  it.each(['signup', 'email', 'invite'])('opens the home page after a verified %s link', async (otpType) => {
    authVerifyOtp.mockResolvedValue({ data: {}, error: null })

    const response = await requestConfirmation({ token_hash: 'confirmation-hash', type: otpType })

    expect(authVerifyOtp).toHaveBeenCalledWith({ type: otpType, token_hash: 'confirmation-hash' })
    expect(response.headers.get('location')).toBe('http://localhost:3000/')
  })

  it.each([
    ['recovery', { next: 'https://evil.example' }, 'http://localhost:3000/mot-de-passe/nouveau'],
    ['signup', { redirect: 'https://evil.example/phish' }, 'http://localhost:3000/'],
    ['email', { next: '//evil.example', redirect_to: 'https://evil.example' }, 'http://localhost:3000/'],
  ])('ignores the return address on a verified %s link and stays on the app', async (otpType, returnAddress, location) => {
    authVerifyOtp.mockResolvedValue({ data: {}, error: null })

    const response = await requestConfirmation({ token_hash: 'hash', type: otpType, ...returnAddress })

    expect(response.headers.get('location')).toBe(location)
  })

  it('ignores the return address on an invalid link and stays on the app login page', async () => {
    const response = await requestConfirmation({ type: 'magiclink', next: 'https://evil.example' })

    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=invalid-link')
  })

  it('sends an unknown link type to the invalid link error without verifying it', async () => {
    const response = await requestConfirmation({ token_hash: 'hash', type: 'magiclink' })

    expect(authVerifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=invalid-link')
  })

  it('sends a link without token to the invalid link error', async () => {
    const response = await requestConfirmation({ type: 'signup' })

    expect(authVerifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=invalid-link')
  })

  it('sends an expired link to the invalid link error and warns with the code and status only', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    authVerifyOtp.mockResolvedValue({ data: {}, error: new AuthApiError('Token has expired', 403, 'otp_expired') })

    const response = await requestConfirmation({ token_hash: 'secret-hash', type: 'recovery' })

    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=invalid-link')
    expect(consoleWarnSpy).toHaveBeenCalledWith('Magic link verification failed', { code: 'otp_expired', status: 403 })
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain('secret-hash')
    consoleWarnSpy.mockRestore()
  })
})
