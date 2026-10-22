import { NextResponse } from 'next/server'
import { CALL_LOG_MESSAGES, toCallApiError, validateCallDraftRequest } from '@/domain/call-log'
import {
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  readJsonRequestBody,
} from '@/server/calls/call-api-response'
import { prepareCallDraft } from '@/server/calls/prepare-call-draft'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'

export const maxDuration = 60

const INTERNAL_ERROR_STATUS = 500
const BAD_REQUEST_STATUS = 400

type DraftRouteStep = 'authentication' | 'preparation'

const failedDraftResponse = (step: DraftRouteStep): NextResponse => {
  console.error('Call draft route failed', { step })
  return callApiErrorResponse(toCallApiError('unknown', CALL_LOG_MESSAGES.draftFailed), INTERNAL_ERROR_STATUS)
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let authentication: Awaited<ReturnType<typeof authenticateBearerRequest>>
  try {
    authentication = await authenticateBearerRequest(request)
  } catch {
    return failedDraftResponse('authentication')
  }
  if (authentication === null) return callApiErrorResponse(UNAUTHORIZED_CALL_API_ERROR)

  const jsonBody = await readJsonRequestBody(request)
  if (jsonBody === null) {
    return callApiErrorResponse(toCallApiError('invalid_request', CALL_LOG_MESSAGES.malformedRequest), BAD_REQUEST_STATUS)
  }
  const validation = validateCallDraftRequest(jsonBody.body, new Date())
  if (!validation.ok) {
    return callApiErrorResponse(toCallApiError('invalid_request', validation.errorMessage), BAD_REQUEST_STATUS)
  }

  try {
    const outcome = await prepareCallDraft(authentication.supabase, authentication.userId, validation.data)
    return outcome.ok ? callApiSuccessResponse(outcome.data) : callApiErrorResponse(outcome.error)
  } catch {
    return failedDraftResponse('preparation')
  }
}
