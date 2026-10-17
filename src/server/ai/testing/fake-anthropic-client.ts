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

export const fakeTextBlock = (
  text: string,
  citations: Anthropic.Beta.BetaTextCitation[] | null = null,
): Anthropic.Beta.BetaTextBlock => ({ type: 'text', text, citations })

export const fakeWebSearchCitation = (title: string | null, url: string): Anthropic.Beta.BetaTextCitation => ({
  type: 'web_search_result_location',
  cited_text: 'cited text',
  encrypted_index: 'encrypted-index',
  title,
  url,
})

export const fakeWebSearchToolUseBlock = (toolUseId: string): Anthropic.Beta.BetaServerToolUseBlock => ({
  type: 'server_tool_use',
  id: toolUseId,
  name: 'web_search',
  input: { query: 'chiffre affaires' },
})

export const fakeWebSearchToolResultBlock = (
  toolUseId: string,
  content: Anthropic.Beta.BetaWebSearchToolResultBlockContent,
): Anthropic.Beta.BetaWebSearchToolResultBlock => ({ type: 'web_search_tool_result', tool_use_id: toolUseId, content })

export const fakeWebSearchResult = (title: string, url: string): Anthropic.Beta.BetaWebSearchResultBlock => ({
  type: 'web_search_result',
  title,
  url,
  encrypted_content: 'encrypted-content',
  page_age: null,
})

export const createFakeBetaMessage = (
  content: Anthropic.Beta.BetaContentBlock[],
  stopReason: Anthropic.Beta.BetaStopReason = 'end_turn',
): Anthropic.Beta.BetaMessage =>
  ({
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    stop_reason: stopReason,
    content,
  }) as unknown as Anthropic.Beta.BetaMessage

export const createFakeAnthropicClientStreaming = (...finalMessages: Anthropic.Beta.BetaMessage[]): Anthropic => {
  const stream = jest.fn()
  finalMessages.forEach((finalMessage) =>
    stream.mockReturnValueOnce({ finalMessage: jest.fn().mockResolvedValue(finalMessage) }),
  )
  return { beta: { messages: { stream } } } as unknown as Anthropic
}

export const captureRejection = (pendingPromise: Promise<unknown>): Promise<unknown> =>
  pendingPromise.then(
    () => {
      throw new Error('Expected the promise to reject')
    },
    (rejectionReason: unknown) => rejectionReason,
  )
