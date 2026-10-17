import 'server-only'
import Anthropic, { type APIError } from '@anthropic-ai/sdk'
import type { AiErrorKind } from '@/domain/ai-errors'

const PAYMENT_REQUIRED_STATUS = 402
const REQUEST_TOO_LARGE_STATUS = 413
const OVERLOADED_STATUS = 529
const CREDIT_BALANCE_TOO_LOW_PATTERN = /credit balance/i

export class AiError extends Error {
  readonly kind: AiErrorKind

  constructor(kind: AiErrorKind) {
    super(`Claude request failed: ${kind}`)
    this.name = 'AiError'
    this.kind = kind
  }
}

const isRejectedApiKeyError = (error: APIError): boolean =>
  error instanceof Anthropic.AuthenticationError ||
  error instanceof Anthropic.PermissionDeniedError ||
  error.status === PAYMENT_REQUIRED_STATUS ||
  error.type === 'billing_error' ||
  (error instanceof Anthropic.BadRequestError && CREDIT_BALANCE_TOO_LOW_PATTERN.test(error.message))

const isSaturatedApiError = (error: APIError): boolean =>
  error instanceof Anthropic.RateLimitError || error.status === OVERLOADED_STATUS || error.type === 'overloaded_error'

const isTimeoutError = (error: APIError): boolean =>
  error instanceof Anthropic.APIConnectionTimeoutError || error.type === 'timeout_error'

export const toAiErrorKind = (error: unknown): AiErrorKind => {
  if (error instanceof AiError) return error.kind
  if (!(error instanceof Anthropic.APIError)) return 'unknown'
  if (isTimeoutError(error)) return 'timeout'
  if (isRejectedApiKeyError(error)) return 'invalid_api_key'
  if (isSaturatedApiError(error)) return 'rate_limited'
  if (error.status === REQUEST_TOO_LARGE_STATUS) return 'input_too_long'
  return 'unknown'
}
