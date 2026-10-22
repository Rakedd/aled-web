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
const SUCCESS_STATUS = 200
const UNEXPECTED_ERROR_STATUS = 502

export const UNAUTHORIZED_CALL_API_ERROR = toCallApiError('unauthorized', CALL_LOG_MESSAGES.unauthorized)

export const callApiErrorResponse = (error: CallApiError, status?: number): NextResponse => {
  const statusFromKind = CALL_API_ERROR_STATUSES[error.kind as ServerCallApiErrorKind] ?? UNEXPECTED_ERROR_STATUS
  return NextResponse.json({ error }, { status: status ?? statusFromKind, headers: NO_STORE_HEADERS })
}

export const callApiSuccessResponse = <Data>(data: Data): NextResponse =>
  NextResponse.json(data, { status: SUCCESS_STATUS, headers: NO_STORE_HEADERS })

export const readJsonRequestBody = async (request: Request): Promise<{ body: unknown } | null> => {
  try {
    return { body: await request.json() }
  } catch {
    return null
  }
}
