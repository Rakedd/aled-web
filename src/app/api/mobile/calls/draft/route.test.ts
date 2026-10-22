/** @jest-environment node */
import { CALL_LOG_MESSAGES, toCallApiError, type CallDraft } from '@/domain/call-log'
import { prepareCallDraft } from '@/server/calls/prepare-call-draft'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POST, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/authenticate-bearer-request', () => ({ authenticateBearerRequest: jest.fn() }))
jest.mock('@/server/calls/prepare-call-draft', () => ({ prepareCallDraft: jest.fn() }))

const authenticateBearerRequestMock = jest.mocked(authenticateBearerRequest)
const prepareCallDraftMock = jest.mocked(prepareCallDraft)
const fakeSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const OCCURRED_AT = new Date().toISOString()

const requestDraft = (body: string) =>
  POST(new Request('http://localhost:3000/api/mobile/calls/draft', { method: 'POST', body }))

const buildValidBody = () => JSON.stringify({ text: 'Appel avec Marie', phone: null, contactId: null, occurredAt: OCCURRED_AT })

describe('POST /api/mobile/calls/draft', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    authenticateBearerRequestMock.mockResolvedValue({ supabase: fakeSupabase, userId: 'user-1' })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('lets the draft run for up to one minute', () => {
    expect(maxDuration).toBe(60)
  })

  it('answers 401 without preparing anything when the token is missing or invalid', async () => {
    authenticateBearerRequestMock.mockResolvedValue(null)
    const response = await requestDraft(buildValidBody())
    expect(response.status).toBe(401)
    expect((await response.json()).error.kind).toBe('unauthorized')
    expect(prepareCallDraftMock).not.toHaveBeenCalled()
  })

  it('answers 400 for a non JSON body and for an invalid request', async () => {
    const notJsonResponse = await requestDraft('pas du json')
    expect(notJsonResponse.status).toBe(400)
    expect((await notJsonResponse.json()).error).toMatchObject({
      kind: 'invalid_request',
      message: CALL_LOG_MESSAGES.malformedRequest,
    })
    const invalidResponse = await requestDraft(JSON.stringify({ text: '   ', occurredAt: OCCURRED_AT }))
    expect(invalidResponse.status).toBe(400)
    expect((await invalidResponse.json()).error.kind).toBe('invalid_request')
    expect(prepareCallDraftMock).not.toHaveBeenCalled()
  })

  it('answers 413 without preparing anything for an oversized body', async () => {
    const response = await requestDraft(JSON.stringify({ text: 'a'.repeat(70_000), occurredAt: OCCURRED_AT }))
    expect(response.status).toBe(413)
    expect((await response.json()).error).toMatchObject({
      kind: 'invalid_request',
      message: CALL_LOG_MESSAGES.requestTooLarge,
    })
    expect(prepareCallDraftMock).not.toHaveBeenCalled()
  })

  it('passes the validated request to the draft preparation and answers the draft', async () => {
    const draft = { contactCandidates: [] } as unknown as CallDraft
    prepareCallDraftMock.mockResolvedValue({ ok: true, data: draft })
    const response = await requestDraft(buildValidBody())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(draft)
    const receivedInput = prepareCallDraftMock.mock.calls[0][2]
    expect(prepareCallDraftMock.mock.calls[0][0]).toBe(fakeSupabase)
    expect(prepareCallDraftMock.mock.calls[0][1]).toBe('user-1')
    expect(receivedInput.occurredAt).toBeInstanceOf(Date)
    expect(receivedInput.text).toBe('Appel avec Marie')
  })

  it('answers the preparation error with its status', async () => {
    prepareCallDraftMock.mockResolvedValueOnce({
      ok: false,
      error: toCallApiError('missing_api_key', CALL_LOG_MESSAGES.missingApiKey),
    })
    expect((await requestDraft(buildValidBody())).status).toBe(422)
    prepareCallDraftMock.mockResolvedValueOnce({ ok: false, error: toCallApiError('rate_limited', 'Trop') })
    expect((await requestDraft(buildValidBody())).status).toBe(429)
  })

  it('answers 500 with the draft failure message when the preparation throws', async () => {
    prepareCallDraftMock.mockRejectedValue(new Error('boom'))
    const response = await requestDraft(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatchObject({ kind: 'unknown', message: CALL_LOG_MESSAGES.draftFailed })
  })

  it('answers 500 without leaking anything when the authentication throws', async () => {
    authenticateBearerRequestMock.mockRejectedValue(new Error('jwks down'))
    const response = await requestDraft(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error.message).toBe(CALL_LOG_MESSAGES.draftFailed)
    expect(console.error).toHaveBeenCalledWith('Call draft route failed', { step: 'authentication' })
    expect(prepareCallDraftMock).not.toHaveBeenCalled()
  })
})
