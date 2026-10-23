/** @jest-environment node */
import { CALL_LOG_MESSAGES, toCallApiError } from '@/domain/call-log'
import { JOB_APPLICATION_VALIDATION_MESSAGES } from '@/domain/job-application'
import { MAX_PASTED_TEXT_LENGTH } from '@/domain/job-posting-extraction'
import {
  MOBILE_JOB_APPLICATION_MESSAGES,
  MOBILE_JOB_APPLICATION_SOURCE,
} from '@/domain/mobile-job-application-request'
import { createJobApplicationForMobileUser } from '@/server/mobile-job-applications/create-job-application-for-mobile-user'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POST } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/authenticate-bearer-request', () => ({ authenticateBearerRequest: jest.fn() }))
jest.mock('@/server/mobile-job-applications/create-job-application-for-mobile-user', () => ({
  createJobApplicationForMobileUser: jest.fn(),
}))

const authenticateBearerRequestMock = jest.mocked(authenticateBearerRequest)
const createJobApplicationForMobileUserMock = jest.mocked(createJobApplicationForMobileUser)
const fakeSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const buildValidBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Développeur React',
    endClientName: null,
    intermediaryName: 'Talentis',
    contactName: null,
    postedDailyRate: 600,
    location: 'Paris',
    remotePolicy: null,
    postingUrl: 'https://www.linkedin.com/jobs/view/4012345678/',
    postingRawText: 'Mission React',
    desiredStart: 'ASAP',
    duration: '6 mois',
    contactEmail: 'pas un e-mail',
    contactPhone: '06 12 34 56 78',
    stack: [],
    ...overrides,
  })

const requestCreation = (body: string) =>
  POST(
    new Request('http://localhost:3000/api/mobile/job-applications', {
      method: 'POST',
      body,
      headers: { 'content-length': String(Buffer.byteLength(body)) },
    }),
  )

describe('POST /api/mobile/job-applications', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    authenticateBearerRequestMock.mockResolvedValue({ supabase: fakeSupabase, userId: 'user-1' })
    createJobApplicationForMobileUserMock.mockResolvedValue({ ok: true, data: { jobApplicationId: JOB_APPLICATION_ID } })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('answers 401 without creating anything when the token is missing or invalid', async () => {
    authenticateBearerRequestMock.mockResolvedValue(null)
    const response = await requestCreation(buildValidBody())
    expect(response.status).toBe(401)
    expect((await response.json()).error.kind).toBe('unauthorized')
    expect(createJobApplicationForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 400 for a non JSON body', async () => {
    const response = await requestCreation('pas du json')
    expect(response.status).toBe(400)
    expect((await response.json()).error).toEqual(
      toCallApiError('invalid_request', MOBILE_JOB_APPLICATION_MESSAGES.invalidJobApplicationRequest),
    )
    expect(createJobApplicationForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 400 with the validation wording for a missing title or a posting url that is not http', async () => {
    const missingTitleResponse = await requestCreation(buildValidBody({ title: '  ' }))
    expect(missingTitleResponse.status).toBe(400)
    expect((await missingTitleResponse.json()).error).toEqual(
      toCallApiError('invalid_request', JOB_APPLICATION_VALIDATION_MESSAGES.missingTitle),
    )
    const invalidUrlResponse = await requestCreation(buildValidBody({ postingUrl: 'javascript:alert(1)' }))
    expect(invalidUrlResponse.status).toBe(400)
    expect((await invalidUrlResponse.json()).error.message).toBe(JOB_APPLICATION_VALIDATION_MESSAGES.invalidPostingUrl)
    expect(createJobApplicationForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 413 for a body far larger than any posting', async () => {
    const response = await requestCreation(buildValidBody({ postingRawText: 'a'.repeat(300 * 1024) }))
    expect(response.status).toBe(413)
    expect((await response.json()).error).toEqual(toCallApiError('invalid_request', CALL_LOG_MESSAGES.requestTooLarge))
    expect(createJobApplicationForMobileUserMock).not.toHaveBeenCalled()
  })

  it('accepts a 50 000 character posting full of accents', async () => {
    const response = await requestCreation(buildValidBody({ postingRawText: 'é'.repeat(MAX_PASTED_TEXT_LENGTH) }))
    expect(response.status).toBe(200)
  })

  it('creates the job application with the share defaults and answers its id', async () => {
    const response = await requestCreation(buildValidBody({ status: 'won' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ jobApplicationId: JOB_APPLICATION_ID })
    const [receivedSupabase, receivedUserId, receivedInput] = createJobApplicationForMobileUserMock.mock.calls[0]
    expect(receivedSupabase).toBe(fakeSupabase)
    expect(receivedUserId).toBe('user-1')
    expect(receivedInput).toMatchObject({
      title: 'Développeur React',
      status: 'applied',
      source: MOBILE_JOB_APPLICATION_SOURCE,
      intermediaryName: 'Talentis',
      postingUrl: 'https://www.linkedin.com/jobs/view/4012345678/',
      desiredStart: 'ASAP',
      duration: '6 mois',
      contactEmail: null,
      contactPhone: '06 12 34 56 78',
    })
    expect(receivedInput.appliedOn).toBeInstanceOf(Date)
  })

  it('answers 422 with the repository wording when the creation is rejected', async () => {
    const rejection = toCallApiError('rejected', 'Groupe invalide')
    createJobApplicationForMobileUserMock.mockResolvedValue({ ok: false, error: rejection })
    const response = await requestCreation(buildValidBody())
    expect(response.status).toBe(422)
    expect((await response.json()).error).toEqual(rejection)
  })

  it('answers 500 with the creation failure wording when the creation throws', async () => {
    createJobApplicationForMobileUserMock.mockRejectedValue(new Error('database down'))
    const response = await requestCreation(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error).toEqual(
      toCallApiError('save_failed', MOBILE_JOB_APPLICATION_MESSAGES.creationFailed),
    )
    expect(console.error).toHaveBeenCalledWith(
      'Mobile job application route failed',
      { step: 'creation', errorName: 'Error', errorMessage: 'database down' },
    )
  })

  it('answers 500 without leaking anything when the authentication throws', async () => {
    authenticateBearerRequestMock.mockRejectedValue(new Error('jwks down'))
    const response = await requestCreation(buildValidBody())
    expect(response.status).toBe(500)
    expect((await response.json()).error.message).toBe(MOBILE_JOB_APPLICATION_MESSAGES.creationFailed)
    expect(createJobApplicationForMobileUserMock).not.toHaveBeenCalled()
  })
})
