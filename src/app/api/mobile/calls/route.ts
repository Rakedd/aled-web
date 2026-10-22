import { NextResponse } from 'next/server'
import { CALL_LOG_MESSAGES, toCallApiError, validateRecordCallRequest } from '@/domain/call-log'
import {
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  invalidJsonRequestBodyResponse,
  readJsonRequestBody,
} from '@/server/calls/call-api-response'
import { recordCall } from '@/server/calls/record-call'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'

const INTERNAL_ERROR_STATUS = 500
const BAD_REQUEST_STATUS = 400

type RecordRouteStep = 'authentication' | 'recording'

const failedRecordResponse = (step: RecordRouteStep): NextResponse => {
  console.error('Call record route failed', { step })
  return callApiErrorResponse(toCallApiError('save_failed', CALL_LOG_MESSAGES.saveFailed), INTERNAL_ERROR_STATUS)
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let authentication: Awaited<ReturnType<typeof authenticateBearerRequest>>
  try {
    authentication = await authenticateBearerRequest(request)
  } catch {
    return failedRecordResponse('authentication')
  }
  if (authentication === null) return callApiErrorResponse(UNAUTHORIZED_CALL_API_ERROR)

  const jsonBody = await readJsonRequestBody(request)
  if (!jsonBody.ok) return invalidJsonRequestBodyResponse(jsonBody.failure)
  const validation = validateRecordCallRequest(jsonBody.body, new Date())
  if (!validation.ok) {
    return callApiErrorResponse(toCallApiError('invalid_request', validation.errorMessage), BAD_REQUEST_STATUS)
  }

  try {
    const outcome = await recordCall(authentication.supabase, authentication.userId, validation.data)
    return outcome.ok ? callApiSuccessResponse(outcome.data) : callApiErrorResponse(outcome.error)
  } catch {
    return failedRecordResponse('recording')
  }
}
