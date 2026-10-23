/** @jest-environment node */
import { toCallApiError } from '@/domain/call-log'
import { FOLLOW_UP_AI_ERROR_MESSAGES, FOLLOW_UP_MESSAGES, type FollowUpMessageDraft } from '@/domain/follow-up-message'
import { parseFollowUpMessageDraftResponse, requestFollowUpMessageDraft } from './request-follow-up-message-draft'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const draft: FollowUpMessageDraft = {
  subject: 'Suivi',
  message: 'Bonjour Marie.',
  contactEmail: 'marie@malt.fr',
  contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
}

const mockFetchResponse = (body: unknown, status = 200) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe('parseFollowUpMessageDraftResponse', () => {
  it('accepts a draft from a successful answer', () => {
    expect(parseFollowUpMessageDraftResponse(true, draft)).toEqual({ ok: true, data: draft })
  })

  it('answers an unexpected response when a successful answer is not a draft', () => {
    expect(parseFollowUpMessageDraftResponse(true, { subject: 'Suivi' })).toEqual({
      ok: false,
      error: toCallApiError('unexpected_response', FOLLOW_UP_MESSAGES.draftFailed),
    })
  })

  it('keeps the kind and the message of a call api error', () => {
    expect(
      parseFollowUpMessageDraftResponse(false, {
        error: toCallApiError('missing_api_key', FOLLOW_UP_AI_ERROR_MESSAGES.missing_api_key),
      }),
    ).toEqual({ ok: false, error: toCallApiError('missing_api_key', FOLLOW_UP_AI_ERROR_MESSAGES.missing_api_key) })
  })

  it.each([
    ['an unknown error kind', { error: { kind: 'teapot', message: 'Je suis une théière' } }],
    ['an error without message', { error: { kind: 'timeout' } }],
    ['a body without error', { message: 'Oups' }],
    ['a body that is not an object', 'Gateway Timeout'],
  ])('answers an unexpected response for %s', (_caseName, responseBody) => {
    expect(parseFollowUpMessageDraftResponse(false, responseBody)).toEqual({
      ok: false,
      error: toCallApiError('unexpected_response', FOLLOW_UP_MESSAGES.draftFailed),
    })
  })
})

describe('requestFollowUpMessageDraft', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('posts the job application and the formality to the route and answers the draft', async () => {
    const fetchMock = mockFetchResponse(draft)

    const draftResult = await requestFollowUpMessageDraft({ jobApplicationId: JOB_APPLICATION_ID, formality: 'tu' })

    expect(fetchMock).toHaveBeenCalledWith('/api/follow-up-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, formality: 'tu' }),
    })
    expect(draftResult).toEqual({ ok: true, data: draft })
  })

  it('answers the error of a rejected request', async () => {
    mockFetchResponse({ error: toCallApiError('rate_limited', FOLLOW_UP_AI_ERROR_MESSAGES.rate_limited) }, 429)

    expect(await requestFollowUpMessageDraft({ jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' })).toEqual({
      ok: false,
      error: toCallApiError('rate_limited', FOLLOW_UP_AI_ERROR_MESSAGES.rate_limited),
    })
  })

  it('answers a network error when the request cannot be sent', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await requestFollowUpMessageDraft({ jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' })).toEqual({
      ok: false,
      error: toCallApiError('network', FOLLOW_UP_MESSAGES.draftFailed),
    })
  })

  it('answers an unexpected response when the answer is not JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 504 }))

    expect(await requestFollowUpMessageDraft({ jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' })).toEqual({
      ok: false,
      error: toCallApiError('unexpected_response', FOLLOW_UP_MESSAGES.draftFailed),
    })
  })
})
