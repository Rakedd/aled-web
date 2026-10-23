import { NextResponse } from 'next/server'
import { toCallApiError } from '@/domain/call-log'
import { FOLLOW_UP_MESSAGES, validateFollowUpMessageRequest } from '@/domain/follow-up-message'
import {
  UNAUTHORIZED_CALL_API_ERROR,
  callApiErrorResponse,
  callApiSuccessResponse,
  invalidJsonRequestBodyResponse,
  readJsonRequestBody,
} from '@/server/calls/call-api-response'
import {
  createFollowUpMessageDependencies,
  draftFollowUpMessage,
} from '@/server/follow-ups/draft-follow-up-message'
import {
  type CookieRequestRejection,
  findCookieRequestRejection,
} from '@/server/security/find-cookie-request-rejection'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

export const maxDuration = 60

const INTERNAL_ERROR_STATUS = 500
const BAD_REQUEST_STATUS = 400

const COOKIE_REQUEST_REJECTION_STATUSES: Record<CookieRequestRejection, number> = {
  cross_site: 403,
  not_json: 415,
}

type FollowUpRouteStep = 'authentication' | 'drafting'

type RequestAuthentication = { supabase: FreeclutchSupabaseClient; userId: string }

const failedFollowUpResponse = (step: FollowUpRouteStep, routeError: unknown): NextResponse => {
  console.error('Follow up message route failed', {
    step,
    errorName: routeError instanceof Error ? routeError.constructor.name : typeof routeError,
    errorMessage: routeError instanceof Error ? routeError.message : null,
  })
  return callApiErrorResponse(toCallApiError('unknown', FOLLOW_UP_MESSAGES.draftFailed), INTERNAL_ERROR_STATUS)
}

const invalidFollowUpRequestResponse = (status: number): NextResponse =>
  callApiErrorResponse(toCallApiError('invalid_request', FOLLOW_UP_MESSAGES.invalidRequest), status)

const authenticateCookieSession = async (): Promise<RequestAuthentication | null> => {
  const supabase = await createServerSupabaseClient()
  const authenticatedUser = await findAuthenticatedUser(supabase)
  return authenticatedUser === null ? null : { supabase, userId: authenticatedUser.id }
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const isBearerRequest = request.headers.has('authorization')
  const cookieRequestRejection = isBearerRequest ? null : findCookieRequestRejection(request)
  if (cookieRequestRejection !== null) {
    return invalidFollowUpRequestResponse(COOKIE_REQUEST_REJECTION_STATUSES[cookieRequestRejection])
  }

  let authentication: RequestAuthentication | null
  try {
    authentication = isBearerRequest ? await authenticateBearerRequest(request) : await authenticateCookieSession()
  } catch (authenticationError) {
    return failedFollowUpResponse('authentication', authenticationError)
  }
  if (authentication === null) return callApiErrorResponse(UNAUTHORIZED_CALL_API_ERROR)

  const jsonBody = await readJsonRequestBody(request)
  if (!jsonBody.ok) return invalidJsonRequestBodyResponse(jsonBody.failure, FOLLOW_UP_MESSAGES.invalidRequest)
  const validation = validateFollowUpMessageRequest(jsonBody.body)
  if (!validation.ok) {
    return callApiErrorResponse(toCallApiError('invalid_request', validation.errorMessage), BAD_REQUEST_STATUS)
  }

  try {
    const outcome = await draftFollowUpMessage(
      authentication.supabase,
      authentication.userId,
      validation.data,
      createFollowUpMessageDependencies(),
    )
    return outcome.ok ? callApiSuccessResponse(outcome.data) : callApiErrorResponse(outcome.error)
  } catch (draftingError) {
    return failedFollowUpResponse('drafting', draftingError)
  }
}
