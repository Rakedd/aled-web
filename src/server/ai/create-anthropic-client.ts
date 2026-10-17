import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const createAnthropicClient = (apiKey: string): Anthropic => new Anthropic({ apiKey, authToken: null })
