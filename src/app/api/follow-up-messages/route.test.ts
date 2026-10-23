/** @jest-environment node */
import { CALL_LOG_MESSAGES, toCallApiError } from '@/domain/call-log'
import { FOLLOW_UP_AI_ERROR_MESSAGES, FOLLOW_UP_MESSAGES, type FollowUpMessageDraft } from '@/domain/follow-up-message'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import {
  createFollowUpMessageDependencies,
  draftFollowUpMessage,
  type FollowUpMessageDependencies,
} from '@/server/follow-ups/draft-follow-up-message'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { POST, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/authenticate-bearer-request', () => ({ authenticateBearerRequest: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ findAuthenticatedUser: jest.fn() }))
jest.mock('@/server/follow-ups/draft-follow-up-message', () => ({
  createFollowUpMessageDependencies: jest.fn(),
  draftFollowUpMessage: jest.fn(),
}))

const authenticateBearerRequestMock = jest.mocked(authenticateBearerRequest)
const createServerSupabaseClientMock = jest.mocked(createServerSupabaseClient)
const findAuthenticatedUserMock = jest.mocked(findAuthenticatedUser)
const draftFollowUpMessageMock = jest.mocked(draftFollowUpMessage)

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const bearerSupabase = { from: jest.fn(), kind: 'bearer' } as unknown as FreeclutchSupabaseClient
const cookieSupabase = { from: jest.fn(), kind: 'cookie' } as unknown as FreeclutchSupabaseClient
const fakeDependencies = { decryptApiKey: jest.fn() } as unknown as FollowUpMessageDependencies
const draft: FollowUpMessageDraft = {
  subject: 'Suivi',
  message: 'Bonjour Marie.',
  contactEmail: 'marie@malt.fr',
  contactLinkedinUrl: null,
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const requestDraft = (body: string, headers: Record<string, string> = JSON_HEADERS) =>
  POST(new Request('http://localhost:3000/api/follow-up-messages', { method: 'POST', body, headers }))

const VALID_BODY = JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' })
const BEARER_HEADERS = { Authorization: 'Bearer token-1' }

describe('POST /api/follow-up-messages', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    authenticateBearerRequestMock.mockResolvedValue({ supabase: bearerSupabase, userId: 'mobile-user' })
    createServerSupabaseClientMock.mockResolvedValue(cookieSupabase)
    findAuthenticatedUserMock.mockResolvedValue({ id: 'web-user', email: 'web@test.local' })
    jest.mocked(createFollowUpMessageDependencies).mockReturnValue(fakeDependencies)
    draftFollowUpMessageMock.mockResolvedValue({ ok: true, data: draft })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('lets the draft run for up to one minute', () => {
    expect(maxDuration).toBe(60)
  })

  it('drafts for the bearer user without reading the cookie session', async () => {
    const response = await requestDraft(VALID_BODY, BEARER_HEADERS)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual(draft)
    expect(draftFollowUpMessageMock).toHaveBeenCalledWith(
      bearerSupabase,
      'mobile-user',
      { jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' },
      fakeDependencies,
    )
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('drafts for the cookie session user when no authorization header is sent', async () => {
    const response = await requestDraft(VALID_BODY)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(draftFollowUpMessageMock).toHaveBeenCalledWith(
      cookieSupabase,
      'web-user',
      { jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' },
      fakeDependencies,
    )
    expect(authenticateBearerRequestMock).not.toHaveBeenCalled()
  })

  it('answers 401 without falling back to the cookie session when the bearer token is invalid', async () => {
    authenticateBearerRequestMock.mockResolvedValue(null)

    const response = await requestDraft(VALID_BODY, BEARER_HEADERS)

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).error).toMatchObject({ kind: 'unauthorized', message: CALL_LOG_MESSAGES.unauthorized })
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it('answers 401 when there is neither a bearer token nor a cookie session', async () => {
    findAuthenticatedUserMock.mockResolvedValue(null)

    const response = await requestDraft(VALID_BODY)

    expect(response.status).toBe(401)
    expect((await response.json()).error.kind).toBe('unauthorized')
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a non JSON body', 'pas du json', FOLLOW_UP_MESSAGES.invalidRequest],
    ['a body that is not an object', '["vous"]', FOLLOW_UP_MESSAGES.invalidRequest],
    ['a malformed identifier', JSON.stringify({ jobApplicationId: 'nope', formality: 'vous' }), JOB_APPLICATION_NOT_FOUND_MESSAGE],
    ['an unknown formality', JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, formality: 'toi' }), FOLLOW_UP_MESSAGES.invalidRequest],
  ])('answers 400 without drafting for %s', async (_caseName, body, expectedMessage) => {
    const response = await requestDraft(body)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).error).toMatchObject({ kind: 'invalid_request', message: expectedMessage })
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it('answers 413 without drafting for an oversized body', async () => {
    const response = await requestDraft(JSON.stringify({ padding: 'a'.repeat(70_000) }))

    expect(response.status).toBe(413)
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it.each([
    ['not_found', JOB_APPLICATION_NOT_FOUND_MESSAGE, 404],
    ['invalid_request', FOLLOW_UP_MESSAGES.closedJobApplication, 400],
    ['missing_api_key', FOLLOW_UP_AI_ERROR_MESSAGES.missing_api_key, 422],
    ['rate_limited', FOLLOW_UP_AI_ERROR_MESSAGES.rate_limited, 429],
  ] as const)('answers the %s draft error with its status', async (kind, message, expectedStatus) => {
    draftFollowUpMessageMock.mockResolvedValue({ ok: false, error: toCallApiError(kind, message) })

    const response = await requestDraft(VALID_BODY)

    expect(response.status).toBe(expectedStatus)
    expect((await response.json()).error).toMatchObject({ kind, message })
  })

  it('answers 500 with the draft failure message when the drafting throws', async () => {
    draftFollowUpMessageMock.mockRejectedValue(new Error('database down'))

    const response = await requestDraft(VALID_BODY)

    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatchObject({ kind: 'unknown', message: FOLLOW_UP_MESSAGES.draftFailed })
    expect(console.error).toHaveBeenCalledWith('Follow up message route failed', {
      step: 'drafting',
      errorName: 'Error',
      errorMessage: 'database down',
    })
  })

  it('answers 500 without leaking anything when the authentication throws', async () => {
    findAuthenticatedUserMock.mockRejectedValue(new Error('auth down'))

    const response = await requestDraft(VALID_BODY)

    expect(response.status).toBe(500)
    expect((await response.json()).error.message).toBe(FOLLOW_UP_MESSAGES.draftFailed)
    expect(console.error).toHaveBeenCalledWith('Follow up message route failed', {
      step: 'authentication',
      errorName: 'Error',
      errorMessage: 'auth down',
    })
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it('answers 403 without reading the session for a cross site cookie request', async () => {
    const response = await requestDraft(VALID_BODY, { ...JSON_HEADERS, 'Sec-Fetch-Site': 'cross-site' })

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).error).toMatchObject({ kind: 'invalid_request', message: FOLLOW_UP_MESSAGES.invalidRequest })
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it('accepts a same origin cookie request', async () => {
    const response = await requestDraft(VALID_BODY, { ...JSON_HEADERS, 'Sec-Fetch-Site': 'same-origin' })

    expect(response.status).toBe(200)
  })

  it('answers 415 without reading the session for a cookie request that is not JSON', async () => {
    const response = await requestDraft(VALID_BODY, { 'Content-Type': 'text/plain' })

    expect(response.status).toBe(415)
    expect((await response.json()).error).toMatchObject({ kind: 'invalid_request', message: FOLLOW_UP_MESSAGES.invalidRequest })
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
    expect(draftFollowUpMessageMock).not.toHaveBeenCalled()
  })

  it('keeps the bearer path free of the cookie request checks', async () => {
    const response = await requestDraft(VALID_BODY, { ...BEARER_HEADERS, 'Content-Type': 'text/plain', 'Sec-Fetch-Site': 'none' })

    expect(response.status).toBe(200)
    expect(draftFollowUpMessageMock).toHaveBeenCalledWith(bearerSupabase, 'mobile-user', expect.anything(), fakeDependencies)
  })
})
