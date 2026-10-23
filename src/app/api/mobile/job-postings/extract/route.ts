import { NextResponse } from 'next/server'
import { toCallApiError } from '@/domain/call-log'
import {
  MOBILE_JOB_APPLICATION_MESSAGES,
  validateJobPostingExtractionRequest,
} from '@/domain/mobile-job-application-request'
import {
  PASTED_TEXT_REQUEST_BODY_MAXIMUM_LENGTH,
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  invalidJsonRequestBodyResponse,
  readJsonRequestBody,
} from '@/server/calls/call-api-response'
import { extractJobPostingForMobileUser } from '@/server/mobile-job-applications/extract-job-posting-for-mobile-user'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'

export const maxDuration = 60

const INTERNAL_ERROR_STATUS = 500

type ExtractionRouteStep = 'authentication' | 'extraction'

const failedExtractionResponse = (step: ExtractionRouteStep, routeError: unknown): NextResponse => {
  console.error('Mobile job posting extraction route failed', {
    step,
    errorName: routeError instanceof Error ? routeError.constructor.name : typeof routeError,
    errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
  })
  return callApiErrorResponse(
    toCallApiError('unknown', MOBILE_JOB_APPLICATION_MESSAGES.extractionFailed),
    INTERNAL_ERROR_STATUS,
  )
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let authentication: Awaited<ReturnType<typeof authenticateBearerRequest>>
  try {
    authentication = await authenticateBearerRequest(request)
  } catch (authenticationError) {
    return failedExtractionResponse('authentication', authenticationError)
  }
  if (authentication === null) return callApiErrorResponse(UNAUTHORIZED_CALL_API_ERROR)

  const jsonBody = await readJsonRequestBody(request, PASTED_TEXT_REQUEST_BODY_MAXIMUM_LENGTH)
  if (!jsonBody.ok) {
    return invalidJsonRequestBodyResponse(jsonBody.failure, MOBILE_JOB_APPLICATION_MESSAGES.invalidPostingRequest)
  }
  const validation = validateJobPostingExtractionRequest(jsonBody.body)
  if (!validation.ok) return callApiErrorResponse(toCallApiError(validation.rejection, validation.errorMessage))

  try {
    const outcome = await extractJobPostingForMobileUser(
      authentication.supabase,
      authentication.userId,
      validation.data.rawText,
    )
    return outcome.ok ? callApiSuccessResponse(outcome.data) : callApiErrorResponse(outcome.error)
  } catch (extractionError) {
    return failedExtractionResponse('extraction', extractionError)
  }
}
