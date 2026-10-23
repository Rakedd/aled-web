/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import { toCallApiError } from '@/domain/call-log'
import { MOBILE_JOB_APPLICATION_MESSAGES } from '@/domain/mobile-job-application-request'
import { AiError } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobPosting } from '@/server/ai/extract-job-posting'
import { emptyExtraction } from '@/server/ai/testing/fake-anthropic-client'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { findEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import {
  extractJobPostingForMobileUser,
  MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS,
} from './extract-job-posting-for-mobile-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/profile-repository', () => ({ findEncryptedAnthropicApiKey: jest.fn() }))
jest.mock('@/server/crypto/api-key-encryption', () => ({ decryptApiKey: jest.fn(), readApiKeyEncryptionSecret: jest.fn() }))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))
jest.mock('@/server/ai/extract-job-posting', () => ({ extractJobPosting: jest.fn() }))

const supabase = {} as FreeclutchSupabaseClient
const userId = 'user-1'
const fakeAnthropicClient = {} as Anthropic
const extraction = { ...emptyExtraction, title: 'Développeur React' }

describe('extractJobPostingForMobileUser', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue('encrypted-key')
    jest.mocked(readApiKeyEncryptionSecret).mockReturnValue('base64-secret')
    jest.mocked(decryptApiKey).mockReturnValue('plain-key')
    jest.mocked(createAnthropicClient).mockReturnValue(fakeAnthropicClient)
    jest.mocked(extractJobPosting).mockResolvedValue(extraction)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => consoleErrorSpy.mockRestore())

  it('answers missing_api_key without calling claude when the user has no key', async () => {
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue(null)
    expect(await extractJobPostingForMobileUser(supabase, userId, 'Mission React')).toEqual({
      ok: false,
      error: toCallApiError('missing_api_key', MOBILE_JOB_APPLICATION_MESSAGES.missingApiKey),
    })
    expect(findEncryptedAnthropicApiKey).toHaveBeenCalledWith(supabase, userId)
    expect(extractJobPosting).not.toHaveBeenCalled()
  })

  it('extracts the posting with the decrypted key of the user', async () => {
    expect(await extractJobPostingForMobileUser(supabase, userId, 'Mission React')).toEqual({
      ok: true,
      data: extraction,
    })
    expect(decryptApiKey).toHaveBeenCalledWith('encrypted-key', 'base64-secret')
    expect(createAnthropicClient).toHaveBeenCalledWith('plain-key')
    expect(extractJobPosting).toHaveBeenCalledWith(
      fakeAnthropicClient,
      'Mission React',
      MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS,
    )
  })

  it('points to the web app preferences when claude refuses the key', async () => {
    jest
      .mocked(extractJobPosting)
      .mockRejectedValue(new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()))
    expect(await extractJobPostingForMobileUser(supabase, userId, 'Mission React')).toEqual({
      ok: false,
      error: toCallApiError('invalid_api_key', MOBILE_JOB_APPLICATION_MESSAGES.invalidApiKey),
    })
  })

  it.each(['rate_limited', 'timeout', 'refused', 'input_too_long', 'unknown'] as const)(
    'answers the %s claude failure with the extraction wording and logs it without the posting',
    async (aiErrorKind) => {
      jest.mocked(extractJobPosting).mockRejectedValue(new AiError(aiErrorKind))
      expect(await extractJobPostingForMobileUser(supabase, userId, 'Mission confidentielle')).toEqual({
        ok: false,
        error: toCallApiError(aiErrorKind, AI_ERROR_MESSAGES[aiErrorKind]),
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Mobile job posting extraction failed',
        expect.objectContaining({ aiErrorKind }),
      )
      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('Mission confidentielle')
    },
  )

  it('answers unknown when the key cannot be decrypted', async () => {
    jest.mocked(decryptApiKey).mockImplementation(() => {
      throw new Error('bad tag')
    })
    expect(await extractJobPostingForMobileUser(supabase, userId, 'Mission React')).toEqual({
      ok: false,
      error: toCallApiError('unknown', AI_ERROR_MESSAGES.unknown),
    })
    expect(extractJobPosting).not.toHaveBeenCalled()
  })

  it('lets a failing key lookup reach the route', async () => {
    jest.mocked(findEncryptedAnthropicApiKey).mockRejectedValue(new Error('database down'))
    await expect(extractJobPostingForMobileUser(supabase, userId, 'Mission React')).rejects.toThrow('database down')
  })
})
