/** @jest-environment node */
import { CALL_LOG_MESSAGES } from '@/domain/call-log'
import { recordCall } from '@/server/calls/record-call'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POST } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/authenticate-bearer-request', () => ({ authenticateBearerRequest: jest.fn() }))
jest.mock('@/server/calls/record-call', () => ({ recordCall: jest.fn() }))

const authenticateBearerRequestMock = jest.mocked(authenticateBearerRequest)
const recordCallMock = jest.mocked(recordCall)
const fakeSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const OCCURRED_AT = new Date().toISOString()

const requestRecord = (body: string) =>
  POST(new Request('http://localhost:3000/api/mobile/calls', { method: 'POST', body }))

const buildValidBody = () =>
  JSON.stringify({
    contact: { new: { fullName: 'Marie Dupont', phone: null, email: null, linkedinUrl: null, intermediaryName: null, referredBy: null, notes: null } },
    contactDetails: { phone: null, email: null, linkedinUrl: null },
    userEditedContactFields: [],
    exchange: { summary: 'Appel avec Marie', occurredAt: OCCURRED_AT },
    jobApplication: null,
  })

describe('POST /api/mobile/calls', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    authenticateBearerRequestMock.mockResolvedValue({ supabase: fakeSupabase, userId: 'user-1' })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('answers 401 without recording anything when the token is missing or invalid', async () => {
    authenticateBearerRequestMock.mockResolvedValue(null)
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(401)
    expect((await response.json()).error.kind).toBe('unauthorized')
    expect(recordCallMock).not.toHaveBeenCalled()
  })

  it('answers 400 with the validation message', async () => {
    const response = await requestRecord(JSON.stringify({ contact: {} }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatchObject({
      kind: 'invalid_request',
      message: CALL_LOG_MESSAGES.malformedRequest,
    })
    expect((await requestRecord('pas du json')).status).toBe(400)
    expect(recordCallMock).not.toHaveBeenCalled()
  })

  it('answers 413 without recording anything for an oversized body', async () => {
    const response = await requestRecord(JSON.stringify({ contact: {}, padding: 'a'.repeat(70_000) }))
    expect(response.status).toBe(413)
    expect((await response.json()).error).toMatchObject({
      kind: 'invalid_request',
      message: CALL_LOG_MESSAGES.requestTooLarge,
    })
    expect(recordCallMock).not.toHaveBeenCalled()
  })

  it('answers the contact id and the job application id of the recorded call', async () => {
    recordCallMock.mockResolvedValue({ ok: true, data: { contactId: 'contact-1', jobApplicationId: 'job-1' } })
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ contactId: 'contact-1', jobApplicationId: 'job-1' })
    expect(recordCallMock.mock.calls[0][0]).toBe(fakeSupabase)
    expect(recordCallMock.mock.calls[0][1]).toBe('user-1')
  })

  it('answers 422 with the created contact id when the recording is refused after creating the contact', async () => {
    recordCallMock.mockResolvedValue({
      ok: false,
      error: { kind: 'rejected', message: 'Refusé', createdContactId: 'contact-1', createdJobApplicationId: null },
    })
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(422)
    expect((await response.json()).error).toMatchObject({ kind: 'rejected', createdContactId: 'contact-1' })
  })

  it('answers 500 with the created ids when the recording fails', async () => {
    recordCallMock.mockResolvedValue({
      ok: false,
      error: { kind: 'save_failed', message: 'Échec', createdContactId: 'contact-1', createdJobApplicationId: 'job-1' },
    })
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatchObject({
      kind: 'save_failed',
      createdContactId: 'contact-1',
      createdJobApplicationId: 'job-1',
    })
  })

  it('answers 500 with the save failure message when the recording throws', async () => {
    recordCallMock.mockRejectedValue(new Error('boom'))
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatchObject({ kind: 'save_failed', message: CALL_LOG_MESSAGES.saveFailed })
    expect(console.error).toHaveBeenCalledWith('Call record route failed', { step: 'recording' })
  })

  it('answers 500 without leaking anything when the authentication throws', async () => {
    authenticateBearerRequestMock.mockRejectedValue(new Error('jwks down'))
    const response = await requestRecord(buildValidBody())
    expect(response.status).toBe(500)
    expect(console.error).toHaveBeenCalledWith('Call record route failed', { step: 'authentication' })
    expect(recordCallMock).not.toHaveBeenCalled()
  })
})
