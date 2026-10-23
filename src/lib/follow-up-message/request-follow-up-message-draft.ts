import { type CallApiErrorKind, type CallApiResult, toCallApiError } from '@/domain/call-log'
import {
  FOLLOW_UP_MESSAGES,
  type FollowUpMessageDraft,
  type FollowUpMessageRequest,
  parseFollowUpMessageDraft,
} from '@/domain/follow-up-message'
import { isRecord } from '@/domain/input-validation'

const FOLLOW_UP_MESSAGE_ROUTE = '/api/follow-up-messages'

const ROUTE_ERROR_KINDS: readonly CallApiErrorKind[] = [
  'missing_api_key',
  'invalid_api_key',
  'rate_limited',
  'refused',
  'timeout',
  'input_too_long',
  'unknown',
  'unauthorized',
  'invalid_request',
  'not_found',
]

const isRouteErrorKind = (candidate: unknown): candidate is CallApiErrorKind =>
  (ROUTE_ERROR_KINDS as readonly unknown[]).includes(candidate)

const failWith = (kind: CallApiErrorKind): CallApiResult<FollowUpMessageDraft> => ({
  ok: false,
  error: toCallApiError(kind, FOLLOW_UP_MESSAGES.draftFailed),
})

export const parseFollowUpMessageDraftResponse = (
  isSuccessfulResponse: boolean,
  responseBody: unknown,
): CallApiResult<FollowUpMessageDraft> => {
  if (isSuccessfulResponse) {
    const followUpMessageDraft = parseFollowUpMessageDraft(responseBody)
    return followUpMessageDraft === null ? failWith('unexpected_response') : { ok: true, data: followUpMessageDraft }
  }
  const routeError = isRecord(responseBody) && isRecord(responseBody.error) ? responseBody.error : null
  if (routeError === null || !isRouteErrorKind(routeError.kind) || typeof routeError.message !== 'string') {
    return failWith('unexpected_response')
  }
  return { ok: false, error: toCallApiError(routeError.kind, routeError.message) }
}

export const requestFollowUpMessageDraft = async (
  followUpMessageRequest: FollowUpMessageRequest,
): Promise<CallApiResult<FollowUpMessageDraft>> => {
  let draftResponse: Response
  try {
    draftResponse = await fetch(FOLLOW_UP_MESSAGE_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(followUpMessageRequest),
    })
  } catch {
    return failWith('network')
  }
  try {
    return parseFollowUpMessageDraftResponse(draftResponse.ok, await draftResponse.json())
  } catch {
    return failWith('unexpected_response')
  }
}
