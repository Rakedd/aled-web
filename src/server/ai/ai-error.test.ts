/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import { AiError, toAiErrorKind } from './ai-error'

jest.mock('server-only', () => ({}))

describe('toAiErrorKind', () => {
  it('maps an authentication error to invalid_api_key', () => {
    expect(toAiErrorKind(new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()))).toBe(
      'invalid_api_key',
    )
  })

  it('maps a permission error to invalid_api_key', () => {
    expect(toAiErrorKind(new Anthropic.PermissionDeniedError(403, {}, 'forbidden', new Headers()))).toBe(
      'invalid_api_key',
    )
  })

  it('maps a billing error to invalid_api_key', () => {
    expect(
      toAiErrorKind(new Anthropic.APIError(402, {}, 'payment required', new Headers(), 'billing_error')),
    ).toBe('invalid_api_key')
  })

  it('maps a credit balance rejection to invalid_api_key', () => {
    const creditBalanceResponseBody = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing.',
      },
    }
    expect(
      toAiErrorKind(
        new Anthropic.BadRequestError(400, creditBalanceResponseBody, undefined, new Headers(), 'invalid_request_error'),
      ),
    ).toBe('invalid_api_key')
  })

  it('maps another bad request to unknown', () => {
    expect(
      toAiErrorKind(new Anthropic.BadRequestError(400, {}, 'max_tokens: too large', new Headers(), 'invalid_request_error')),
    ).toBe('unknown')
  })

  it('maps a rate limit error to rate_limited', () => {
    expect(toAiErrorKind(new Anthropic.RateLimitError(429, {}, 'rate', new Headers()))).toBe('rate_limited')
  })

  it('maps an overloaded api to rate_limited', () => {
    expect(
      toAiErrorKind(new Anthropic.InternalServerError(529, {}, 'overloaded', new Headers(), 'overloaded_error')),
    ).toBe('rate_limited')
  })

  it('maps a connection timeout to timeout', () => {
    expect(toAiErrorKind(new Anthropic.APIConnectionTimeoutError())).toBe('timeout')
  })

  it('maps a request too large error to input_too_long', () => {
    expect(toAiErrorKind(new Anthropic.APIError(413, {}, 'request too large', new Headers()))).toBe('input_too_long')
  })

  it('maps an internal server error to unknown', () => {
    expect(toAiErrorKind(new Anthropic.InternalServerError(500, {}, 'api error', new Headers(), 'api_error'))).toBe(
      'unknown',
    )
  })

  it('maps a connection error to unknown', () => {
    expect(toAiErrorKind(new Anthropic.APIConnectionError({ message: 'socket hang up' }))).toBe('unknown')
  })

  it('keeps the kind carried by an AiError', () => {
    expect(toAiErrorKind(new AiError('refused'))).toBe('refused')
  })

  it('maps anything else to unknown', () => {
    expect(toAiErrorKind(new Error('boom'))).toBe('unknown')
    expect(toAiErrorKind('boom')).toBe('unknown')
  })
})
