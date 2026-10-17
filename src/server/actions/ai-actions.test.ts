/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import {
  createFakeAnthropicClientReturning,
  emptyExtraction,
  mockAnthropicThrows,
  mockGetDecryptedKey,
} from '@/server/ai/testing/fake-anthropic-client'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { extractJobPostingForCurrentUser } from './ai-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('extractJobPostingForCurrentUser', () => {
  it('rejects text over 50 000 characters with input_too_long, without calling Claude', async () => {
    mockGetDecryptedKey('sk-ant-x')
    const result = await extractJobPostingForCurrentUser('a'.repeat(50_001))
    expect(result).toEqual({ ok: false, errorMessage: AI_ERROR_MESSAGES.input_too_long })
    expect(createAnthropicClient).not.toHaveBeenCalled()
  })

  it('rejects a blank text without calling Claude', async () => {
    mockGetDecryptedKey('sk-ant-x')
    const result = await extractJobPostingForCurrentUser('   ')
    expect(result).toEqual({ ok: false, errorMessage: AI_ERROR_MESSAGES.unknown })
    expect(createAnthropicClient).not.toHaveBeenCalled()
  })

  it('returns the missing key message when the user has no key', async () => {
    mockGetDecryptedKey(null)
    expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({
      ok: false,
      errorMessage: AI_ERROR_MESSAGES.missing_api_key,
    })
    expect(getDecryptedAnthropicApiKeyForUser).toHaveBeenCalledWith('user-1')
    expect(createAnthropicClient).not.toHaveBeenCalled()
  })

  it('returns the invalid key message when the stored key was revoked', async () => {
    mockGetDecryptedKey('sk-ant-revoked')
    mockAnthropicThrows(new Anthropic.AuthenticationError(401, {}, 'invalid', new Headers()))
    expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({
      ok: false,
      errorMessage: AI_ERROR_MESSAGES.invalid_api_key,
    })
  })

  it('returns the refused message when claude refuses the text', async () => {
    mockGetDecryptedKey('sk-ant-valid')
    jest.mocked(createAnthropicClient).mockReturnValue(createFakeAnthropicClientReturning('', 'refusal'))
    expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({
      ok: false,
      errorMessage: AI_ERROR_MESSAGES.refused,
    })
  })

  it('returns the unknown message when the key cannot be read', async () => {
    jest.mocked(getDecryptedAnthropicApiKeyForUser).mockRejectedValue(new Error('decryption failed'))
    expect(await extractJobPostingForCurrentUser('Mission React')).toEqual({
      ok: false,
      errorMessage: AI_ERROR_MESSAGES.unknown,
    })
  })

  it('logs the error kind and status without the key or the pasted text', async () => {
    mockGetDecryptedKey('sk-ant-secret-key')
    mockAnthropicThrows(new Anthropic.RateLimitError(429, {}, 'rate', new Headers()))
    await extractJobPostingForCurrentUser('Mission confidentielle')
    const loggedOutput = JSON.stringify(consoleErrorSpy.mock.calls)
    expect(loggedOutput).toContain('rate_limited')
    expect(loggedOutput).toContain('429')
    expect(loggedOutput).not.toContain('sk-ant-secret-key')
    expect(loggedOutput).not.toContain('Mission confidentielle')
  })

  it('extracts the posting with a client built from the decrypted key of the current user', async () => {
    mockGetDecryptedKey('sk-ant-valid')
    jest
      .mocked(createAnthropicClient)
      .mockReturnValue(createFakeAnthropicClientReturning({ ...emptyExtraction, title: 'Développeur React' }))
    expect(await extractJobPostingForCurrentUser('  Mission React  ')).toEqual({
      ok: true,
      data: { ...emptyExtraction, title: 'Développeur React' },
    })
    expect(createAnthropicClient).toHaveBeenCalledWith('sk-ant-valid')
  })
})
