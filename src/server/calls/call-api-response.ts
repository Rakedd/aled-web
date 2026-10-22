import 'server-only'
import { NextResponse } from 'next/server'
import {
  CALL_LOG_MESSAGES,
  toCallApiError,
  type CallApiError,
  type ServerCallApiErrorKind,
} from '@/domain/call-log'

export const CALL_API_ERROR_STATUSES: Record<ServerCallApiErrorKind, number> = {
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

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }
const MAXIMUM_REQUEST_BODY_LENGTH = 64 * 1024
const PAYLOAD_TOO_LARGE_STATUS = 413
const SUCCESS_STATUS = 200

type JsonRequestBodyFailure = 'malformed' | 'too_large'
type JsonRequestBodyReading = { ok: true; body: unknown } | { ok: false; failure: JsonRequestBodyFailure }
const UNEXPECTED_ERROR_STATUS = 502

export const UNAUTHORIZED_CALL_API_ERROR = toCallApiError('unauthorized', CALL_LOG_MESSAGES.unauthorized)

export const callApiErrorResponse = (error: CallApiError, status?: number): NextResponse => {
  const statusFromKind = CALL_API_ERROR_STATUSES[error.kind as ServerCallApiErrorKind] ?? UNEXPECTED_ERROR_STATUS
  return NextResponse.json({ error }, { status: status ?? statusFromKind, headers: NO_STORE_HEADERS })
}

export const callApiSuccessResponse = <Data>(data: Data): NextResponse =>
  NextResponse.json(data, { status: SUCCESS_STATUS, headers: NO_STORE_HEADERS })

export const readJsonRequestBody = async (request: Request): Promise<JsonRequestBodyReading> => {
  const declaredLength = Number(request.headers.get('content-length'))
  if (declaredLength > MAXIMUM_REQUEST_BODY_LENGTH) return { ok: false, failure: 'too_large' }
  try {
    const bodyText = await request.text()
    if (bodyText.length > MAXIMUM_REQUEST_BODY_LENGTH) return { ok: false, failure: 'too_large' }
    return { ok: true, body: JSON.parse(bodyText) }
  } catch {
    return { ok: false, failure: 'malformed' }
  }
}

export const invalidJsonRequestBodyResponse = (failure: JsonRequestBodyFailure): NextResponse =>
  failure === 'too_large'
    ? callApiErrorResponse(toCallApiError('invalid_request', CALL_LOG_MESSAGES.requestTooLarge), PAYLOAD_TOO_LARGE_STATUS)
    : callApiErrorResponse(toCallApiError('invalid_request', CALL_LOG_MESSAGES.malformedRequest))
