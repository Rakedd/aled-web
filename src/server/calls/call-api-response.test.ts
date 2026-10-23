/** @jest-environment node */
import { CALL_LOG_MESSAGES, toCallApiError, type ServerCallApiErrorKind } from '@/domain/call-log'
import {
  CALL_API_ERROR_STATUSES,
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  invalidJsonRequestBodyResponse,
  readJsonRequestBody,
} from './call-api-response'

jest.mock('server-only', () => ({}))

describe('call api response', () => {
  it('answers each error kind with its http status', async () => {
    const expectedStatuses: Record<ServerCallApiErrorKind, number> = {
      unauthorized: 401,
      invalid_request: 400,
      not_found: 404,
      rejected: 422,
      save_failed: 500,
      missing_api_key: 422,
      invalid_api_key: 422,
      input_too_long: 413,
      rate_limited: 429,
      timeout: 504,
      refused: 502,
      unknown: 502,
    }
    expect(CALL_API_ERROR_STATUSES).toEqual(expectedStatuses)
    const response = callApiErrorResponse(toCallApiError('rate_limited', 'Trop de demandes'))
    expect(response.status).toBe(429)
  })

  it('wraps the error and never lets a response be cached', async () => {
    const error = toCallApiError('not_found', 'Introuvable')
    const errorResponse = callApiErrorResponse(error, 418)
    expect(errorResponse.status).toBe(418)
    expect(await errorResponse.json()).toEqual({ error })
    expect(errorResponse.headers.get('Cache-Control')).toBe('private, no-store')

    const successResponse = callApiSuccessResponse({ value: 1 })
    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toEqual({ value: 1 })
    expect(successResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(UNAUTHORIZED_CALL_API_ERROR).toEqual(toCallApiError('unauthorized', CALL_LOG_MESSAGES.unauthorized))
  })

  it('reports a body that is not JSON as malformed', async () => {
    const invalidRequest = new Request('http://localhost/x', { method: 'POST', body: 'pas du json' })
    expect(await readJsonRequestBody(invalidRequest)).toEqual({ ok: false, failure: 'malformed' })
    const validRequest = new Request('http://localhost/x', { method: 'POST', body: '{"a":1}' })
    expect(await readJsonRequestBody(validRequest)).toEqual({ ok: true, body: { a: 1 } })
  })

  it('refuses a body over 64 KB, declared or read', async () => {
    const declaredRequest = new Request('http://localhost/x', {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': String(64 * 1024 + 1) },
    })
    expect(await readJsonRequestBody(declaredRequest)).toEqual({ ok: false, failure: 'too_large' })
    const oversizedBody = JSON.stringify({ text: 'a'.repeat(64 * 1024) })
    const readRequest = new Request('http://localhost/x', { method: 'POST', body: oversizedBody })
    expect(await readJsonRequestBody(readRequest)).toEqual({ ok: false, failure: 'too_large' })
  })

  it('answers 413 for a body that is too large and 400 for a malformed one', async () => {
    const tooLargeResponse = invalidJsonRequestBodyResponse('too_large')
    expect(tooLargeResponse.status).toBe(413)
    expect(await tooLargeResponse.json()).toEqual({
      error: toCallApiError('invalid_request', CALL_LOG_MESSAGES.requestTooLarge),
    })
    expect(invalidJsonRequestBodyResponse('malformed').status).toBe(400)
  })

  it('answers a malformed body with the call wording by default and with the given wording otherwise', async () => {
    expect((await invalidJsonRequestBodyResponse('malformed').json()).error.message).toBe(CALL_LOG_MESSAGES.malformedRequest)
    const customResponse = invalidJsonRequestBodyResponse('malformed', 'Demande de relance invalide.')
    expect(customResponse.status).toBe(400)
    expect(await customResponse.json()).toEqual({
      error: toCallApiError('invalid_request', 'Demande de relance invalide.'),
    })
  })
})
