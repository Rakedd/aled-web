/** @jest-environment node */
import { CALL_LOG_MESSAGES, toCallApiError, type ServerCallApiErrorKind } from '@/domain/call-log'
import {
  CALL_API_ERROR_STATUSES,
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
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

  it('returns null for a body that is not JSON', async () => {
    const invalidRequest = new Request('http://localhost/x', { method: 'POST', body: 'pas du json' })
    expect(await readJsonRequestBody(invalidRequest)).toBeNull()
    const validRequest = new Request('http://localhost/x', { method: 'POST', body: '{"a":1}' })
    expect(await readJsonRequestBody(validRequest)).toEqual({ body: { a: 1 } })
  })
})
