/** @jest-environment node */
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import { CALL_LOG_MESSAGES, toCallApiError } from '@/domain/call-log'
import { MAX_PASTED_TEXT_LENGTH } from '@/domain/job-posting-extraction'
import { MOBILE_JOB_APPLICATION_MESSAGES } from '@/domain/mobile-job-application-request'
import { emptyExtraction } from '@/server/ai/testing/fake-anthropic-client'
import {
  extractJobPostingForMobileUser,
  MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS,
} from '@/server/mobile-job-applications/extract-job-posting-for-mobile-user'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POST, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/authenticate-bearer-request', () => ({ authenticateBearerRequest: jest.fn() }))
jest.mock('@/server/mobile-job-applications/extract-job-posting-for-mobile-user', () => ({
  ...jest.requireActual('@/server/mobile-job-applications/extract-job-posting-for-mobile-user'),
  extractJobPostingForMobileUser: jest.fn(),
}))

const authenticateBearerRequestMock = jest.mocked(authenticateBearerRequest)
const extractJobPostingForMobileUserMock = jest.mocked(extractJobPostingForMobileUser)
const fakeSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const extraction = { ...emptyExtraction, title: 'Développeur React' }

const requestExtraction = (body: string) =>
  POST(
    new Request('http://localhost:3000/api/mobile/job-postings/extract', {
      method: 'POST',
      body,
      headers: { 'content-length': String(Buffer.byteLength(body)) },
    }),
  )

describe('POST /api/mobile/job-postings/extract', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    authenticateBearerRequestMock.mockResolvedValue({ supabase: fakeSupabase, userId: 'user-1' })
    extractJobPostingForMobileUserMock.mockResolvedValue({ ok: true, data: extraction })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('lets the extraction run for up to one minute', () => {
    expect(maxDuration).toBe(60)
  })

  it('keeps every claude attempt within the route budget, with ten seconds left for the rest', () => {
    const { timeoutInMilliseconds, maxRetries } = MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS
    expect(maxRetries).toBe(0)
    expect(timeoutInMilliseconds * (maxRetries + 1) + 10_000).toBeLessThanOrEqual(maxDuration * 1000)
  })

  it('answers 401 without extracting anything when the token is missing or invalid', async () => {
    authenticateBearerRequestMock.mockResolvedValue(null)
    const response = await requestExtraction(JSON.stringify({ rawText: 'Mission React' }))
    expect(response.status).toBe(401)
    expect((await response.json()).error).toEqual(toCallApiError('unauthorized', CALL_LOG_MESSAGES.unauthorized))
    expect(extractJobPostingForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 400 for a non JSON body, a malformed request and a blank posting', async () => {
    const notJsonResponse = await requestExtraction('pas du json')
    expect(notJsonResponse.status).toBe(400)
    expect((await notJsonResponse.json()).error).toEqual(
      toCallApiError('invalid_request', MOBILE_JOB_APPLICATION_MESSAGES.invalidPostingRequest),
    )
    const malformedResponse = await requestExtraction(JSON.stringify({ text: 'Mission React' }))
    expect(malformedResponse.status).toBe(400)
    expect((await malformedResponse.json()).error.message).toBe(MOBILE_JOB_APPLICATION_MESSAGES.invalidPostingRequest)
    const blankResponse = await requestExtraction(JSON.stringify({ rawText: '   ' }))
    expect(blankResponse.status).toBe(400)
    expect((await blankResponse.json()).error).toEqual(
      toCallApiError('invalid_request', MOBILE_JOB_APPLICATION_MESSAGES.missingPostingText),
    )
    expect(extractJobPostingForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 413 with the extraction wording for a posting over 50 000 characters', async () => {
    const response = await requestExtraction(JSON.stringify({ rawText: 'a'.repeat(MAX_PASTED_TEXT_LENGTH + 1) }))
    expect(response.status).toBe(413)
    expect((await response.json()).error).toEqual(toCallApiError('input_too_long', AI_ERROR_MESSAGES.input_too_long))
    expect(extractJobPostingForMobileUserMock).not.toHaveBeenCalled()
  })

  it('answers 413 for a body far larger than any posting', async () => {
    const response = await requestExtraction(JSON.stringify({ rawText: 'a'.repeat(300 * 1024) }))
    expect(response.status).toBe(413)
    expect((await response.json()).error).toEqual(toCallApiError('invalid_request', CALL_LOG_MESSAGES.requestTooLarge))
    expect(extractJobPostingForMobileUserMock).not.toHaveBeenCalled()
  })

  it('accepts a 50 000 character posting full of accents, even though it weighs more than 64 KiB', async () => {
    const accentedPosting = 'é'.repeat(MAX_PASTED_TEXT_LENGTH)
    const response = await requestExtraction(JSON.stringify({ rawText: accentedPosting }))
    expect(response.status).toBe(200)
    expect(extractJobPostingForMobileUserMock).toHaveBeenCalledWith(fakeSupabase, 'user-1', accentedPosting)
  })

  it('extracts the trimmed posting for the authenticated user and answers the extraction', async () => {
    const response = await requestExtraction(JSON.stringify({ rawText: '  Mission React  ' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual(extraction)
    expect(extractJobPostingForMobileUserMock).toHaveBeenCalledWith(fakeSupabase, 'user-1', 'Mission React')
  })

  it('answers 422 when the user has no Claude key', async () => {
    const missingApiKeyError = toCallApiError('missing_api_key', MOBILE_JOB_APPLICATION_MESSAGES.missingApiKey)
    extractJobPostingForMobileUserMock.mockResolvedValue({ ok: false, error: missingApiKeyError })
    const response = await requestExtraction(JSON.stringify({ rawText: 'Mission React' }))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toEqual(missingApiKeyError)
  })

  it.each([
    ['rate_limited', 429],
    ['timeout', 504],
    ['refused', 502],
    ['unknown', 502],
  ] as const)('answers the %s extraction failure with %i', async (aiErrorKind, expectedStatus) => {
    extractJobPostingForMobileUserMock.mockResolvedValue({
      ok: false,
      error: toCallApiError(aiErrorKind, AI_ERROR_MESSAGES[aiErrorKind]),
    })
    expect((await requestExtraction(JSON.stringify({ rawText: 'Mission React' }))).status).toBe(expectedStatus)
  })

  it('answers 500 with the extraction failure wording when the extraction throws', async () => {
    extractJobPostingForMobileUserMock.mockRejectedValue(new Error('database down'))
    const response = await requestExtraction(JSON.stringify({ rawText: 'Mission React' }))
    expect(response.status).toBe(500)
    expect((await response.json()).error).toEqual(
      toCallApiError('unknown', MOBILE_JOB_APPLICATION_MESSAGES.extractionFailed),
    )
    expect(console.error).toHaveBeenCalledWith(
      'Mobile job posting extraction route failed',
      { step: 'extraction', errorName: 'Error', errorMessage: 'database down' },
    )
  })

  it('answers 500 without leaking anything when the authentication throws', async () => {
    authenticateBearerRequestMock.mockRejectedValue(new Error('jwks down'))
    const response = await requestExtraction(JSON.stringify({ rawText: 'Mission React' }))
    expect(response.status).toBe(500)
    expect((await response.json()).error.message).toBe(MOBILE_JOB_APPLICATION_MESSAGES.extractionFailed)
    expect(console.error).toHaveBeenCalledWith(
      'Mobile job posting extraction route failed',
      expect.objectContaining({ step: 'authentication' }),
    )
    expect(extractJobPostingForMobileUserMock).not.toHaveBeenCalled()
  })
})
