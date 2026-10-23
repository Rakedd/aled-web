/** @jest-environment node */
import { AuthApiError } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { GET } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const ACCEPTANCE_DATE = new Date('2026-10-23T08:30:00.000Z')

const authExchangeCodeForSession = jest.fn()
const profilesUpdate = jest.fn()
const profilesEq = jest.fn()
const profilesIs = jest.fn()
const supabaseFrom = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ now: ACCEPTANCE_DATE })
  profilesUpdate.mockReturnValue({ eq: profilesEq })
  profilesEq.mockReturnValue({ is: profilesIs })
  profilesIs.mockResolvedValue({ error: null, status: 204 })
  supabaseFrom.mockReturnValue({ update: profilesUpdate })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(
    {
      auth: { exchangeCodeForSession: authExchangeCodeForSession },
      from: supabaseFrom,
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  )
})

afterEach(() => {
  jest.useRealTimers()
})

const requestCallback = (searchParameters: Record<string, string>) =>
  GET(new NextRequest(new URL(`/auth/callback?${new URLSearchParams(searchParameters)}`, 'http://localhost:3000')))

const OAUTH_FAILURE_LOCATION = 'http://localhost:3000/login?error=oauth'

describe('GET /auth/callback', () => {
  it('sends a return without code to the OAuth error', async () => {
    const response = await requestCallback({})

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(OAUTH_FAILURE_LOCATION)
    expect(authExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('sends a cancelled consent to the OAuth error without exchanging anything', async () => {
    const response = await requestCallback({
      error: 'access_denied',
      error_description: 'The user denied the request',
      code: 'ignored-code',
    })

    expect(response.headers.get('location')).toBe(OAUTH_FAILURE_LOCATION)
    expect(authExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('sends a failed code exchange to the OAuth error and warns with the code and status only', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    authExchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('invalid flow state', 400, 'flow_state_not_found'),
    })

    const response = await requestCallback({ code: 'secret-code' })

    expect(response.headers.get('location')).toBe(OAUTH_FAILURE_LOCATION)
    expect(consoleWarnSpy).toHaveBeenCalledWith('OAuth code exchange failed', {
      code: 'flow_state_not_found',
      status: 400,
    })
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain('secret-code')
    expect(supabaseFrom).not.toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it('records the terms acceptance only when it is still empty, then opens the home page', async () => {
    authExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' }, session: {} }, error: null })

    const response = await requestCallback({ code: 'valid-code' })

    expect(authExchangeCodeForSession).toHaveBeenCalledWith('valid-code')
    expect(supabaseFrom).toHaveBeenCalledWith('profiles')
    expect(profilesUpdate).toHaveBeenCalledWith({ terms_accepted_at: ACCEPTANCE_DATE.toISOString() })
    expect(profilesEq).toHaveBeenCalledWith('id', 'user-1')
    expect(profilesIs).toHaveBeenCalledWith('terms_accepted_at', null)
    expect(response.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('still opens the home page when recording the terms acceptance fails, and warns with the code and status only', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    authExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-1' }, session: {} }, error: null })
    profilesIs.mockResolvedValue({ error: { code: '42501', message: 'permission denied', details: '' }, status: 403 })

    const response = await requestCallback({ code: 'valid-code' })

    expect(response.headers.get('location')).toBe('http://localhost:3000/')
    expect(consoleWarnSpy).toHaveBeenCalledWith('Terms acceptance recording failed', { code: '42501', status: 403 })
    consoleWarnSpy.mockRestore()
  })
})
