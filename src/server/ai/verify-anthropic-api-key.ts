import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS } from './claude-models'
import { createAnthropicClient } from './create-anthropic-client'

const VERIFICATION_TIMEOUT_IN_MILLISECONDS = 15_000

const isRejectedApiKeyError = (error: unknown): boolean =>
  error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError

export const verifyAnthropicApiKey = async (apiKey: string): Promise<boolean> => {
  const anthropicClient = createAnthropicClient(apiKey)
  try {
    await anthropicClient.models.retrieve(CLAUDE_MODELS.extraction, undefined, {
      timeout: VERIFICATION_TIMEOUT_IN_MILLISECONDS,
    })
    return true
  } catch (error) {
    if (isRejectedApiKeyError(error)) return false
    throw error
  }
}
