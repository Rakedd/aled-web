import { NextResponse } from 'next/server'
import { toCallApiError } from '@/domain/call-log'
import {
  buildJobApplicationInputFromMobileRequest,
  MOBILE_JOB_APPLICATION_MESSAGES,
} from '@/domain/mobile-job-application-request'
import {
  PASTED_TEXT_REQUEST_BODY_MAXIMUM_LENGTH,
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  invalidJsonRequestBodyResponse,
  readJsonRequestBody,
} from '@/server/calls/call-api-response'
import { createJobApplicationForMobileUser } from '@/server/mobile-job-applications/create-job-application-for-mobile-user'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'

const INTERNAL_ERROR_STATUS = 500
const BAD_REQUEST_STATUS = 400

type CreationRouteStep = 'authentication' | 'creation'

const failedCreationResponse = (step: CreationRouteStep, routeError: unknown): NextResponse => {
  console.error('Mobile job application route failed', {
    step,
    errorName: routeError instanceof Error ? routeError.constructor.name : typeof routeError,
    errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
  })
  return callApiErrorResponse(
    toCallApiError('save_failed', MOBILE_JOB_APPLICATION_MESSAGES.creationFailed),
    INTERNAL_ERROR_STATUS,
  )
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let authentication: Awaited<ReturnType<typeof authenticateBearerRequest>>
  try {
    authentication = await authenticateBearerRequest(request)
  } catch (authenticationError) {
    return failedCreationResponse('authentication', authenticationError)
  }
  if (authentication === null) return callApiErrorResponse(UNAUTHORIZED_CALL_API_ERROR)

  const jsonBody = await readJsonRequestBody(request, PASTED_TEXT_REQUEST_BODY_MAXIMUM_LENGTH)
  if (!jsonBody.ok) {
    return invalidJsonRequestBodyResponse(jsonBody.failure, MOBILE_JOB_APPLICATION_MESSAGES.invalidJobApplicationRequest)
  }
  const validation = buildJobApplicationInputFromMobileRequest(jsonBody.body, new Date())
  if (!validation.ok) {
    return callApiErrorResponse(toCallApiError('invalid_request', validation.errorMessage), BAD_REQUEST_STATUS)
  }

  try {
    const outcome = await createJobApplicationForMobileUser(authentication.supabase, authentication.userId, validation.data)
    return outcome.ok ? callApiSuccessResponse(outcome.data) : callApiErrorResponse(outcome.error)
  } catch (creationError) {
    return failedCreationResponse('creation', creationError)
  }
}
