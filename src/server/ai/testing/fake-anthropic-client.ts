import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { StopReason } from '@anthropic-ai/sdk/resources/messages'
import type { JobPostingExtraction } from '@/domain/job-posting-extraction'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createAnthropicClient } from '../create-anthropic-client'

export const emptyExtraction: JobPostingExtraction = {
  title: null,
  intermediaryName: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  endClientName: null,
  postedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  stack: [],
}

export const createFakeAnthropicClientReturning = (
  structuredOutput: unknown,
  stopReason: StopReason = 'end_turn',
): Anthropic =>
  ({
    messages: {
      create: jest.fn().mockResolvedValue({
        id: 'msg_fake',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        stop_reason: stopReason,
        content: [
          { type: 'thinking', thinking: '', signature: 'fake-signature' },
          { type: 'text', text: JSON.stringify(structuredOutput) },
        ],
      }),
    },
  }) as unknown as Anthropic

export const mockGetDecryptedKey = (decryptedApiKey: string | null): void => {
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue(decryptedApiKey)
}

export const mockAnthropicThrows = (anthropicError: unknown): void => {
  jest
    .mocked(createAnthropicClient)
    .mockReturnValue({ messages: { create: jest.fn().mockRejectedValue(anthropicError) } } as unknown as Anthropic)
}
