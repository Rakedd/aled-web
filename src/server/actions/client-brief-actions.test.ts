/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ClientBrief } from '@/domain/client-brief'
import { generateClientBrief } from '@/server/ai/generate-client-brief'
import {
  findEndClientBriefSubject,
  saveEndClientNotes,
  saveGeneratedEndClientBrief,
} from '@/server/repositories/client-brief-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { generateBriefForEndClient, updateEndClientNotes } from './client-brief-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/ai/generate-client-brief', () => ({ generateClientBrief: jest.fn() }))
jest.mock('@/server/repositories/client-brief-repository', () => ({
  findEndClientBrief: jest.fn(),
  findEndClientBriefSubject: jest.fn(),
  saveGeneratedEndClientBrief: jest.fn(),
  saveEndClientNotes: jest.fn(),
}))

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const fakeSupabaseClient = {} as FreeclutchSupabaseClient
const generatedClientBrief: ClientBrief = {
  markdown: '## Enjeux\n\nCroissance',
  sources: [{ title: 'Rapport', url: 'https://example.com/report' }],
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(findEndClientBriefSubject).mockResolvedValue({
    ok: true,
    data: { endClientName: 'BNP Paribas Real Estate', parentGroupName: 'BNP Paribas' },
  })
  jest.mocked(saveGeneratedEndClientBrief).mockResolvedValue({ ok: true, data: null })
  jest.mocked(saveEndClientNotes).mockResolvedValue({ ok: true, data: null })
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-test-key')
  jest.mocked(generateClientBrief).mockResolvedValue(generatedClientBrief)
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('generateBriefForEndClient', () => {
  it('generates the brief for the end client and its group, stores it and returns it with its date', async () => {
    const generationResult = await generateBriefForEndClient(END_CLIENT_ID)

    expect(generateClientBrief).toHaveBeenCalledWith(expect.any(Anthropic), {
      endClientName: 'BNP Paribas Real Estate',
      parentGroupName: 'BNP Paribas',
    })
    expect(generationResult).toEqual({ ok: true, data: { ...generatedClientBrief, generatedAt: expect.any(Date) } })
    expect(saveGeneratedEndClientBrief).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      END_CLIENT_ID,
      generatedClientBrief,
      expect.any(Date),
    )
  })

  it('refuses an end client whose name is empty once angle brackets are removed, without calling Claude', async () => {
    jest.mocked(findEndClientBriefSubject).mockResolvedValue({
      ok: true,
      data: { endClientName: ' <> ', parentGroupName: null },
    })

    const generationResult = await generateBriefForEndClient(END_CLIENT_ID)

    expect(generationResult).toEqual({
      ok: false,
      errorMessage: 'Le nom du client final ne permet pas de générer un brief. Corrige-le dans les infos mission.',
    })
    expect(getDecryptedAnthropicApiKeyForUser).not.toHaveBeenCalled()
    expect(generateClientBrief).not.toHaveBeenCalled()
  })

  it('asks for an api key and stores nothing when the user has none', async () => {
    jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue(null)

    const generationResult = await generateBriefForEndClient(END_CLIENT_ID)

    expect(generationResult).toEqual({
      ok: false,
      errorMessage: 'Ajoute ta clé Claude dans les réglages pour générer le brief.',
    })
    expect(saveGeneratedEndClientBrief).not.toHaveBeenCalled()
  })

  it('returns the matching ai error and keeps the previous brief when Claude fails', async () => {
    jest.mocked(generateClientBrief).mockRejectedValue(
      new Anthropic.APIConnectionTimeoutError({ message: 'Request timed out.' }),
    )

    const generationResult = await generateBriefForEndClient(END_CLIENT_ID)

    expect(generationResult).toEqual({ ok: false, errorMessage: "Claude n'a pas répondu à temps, réessaie." })
    expect(saveGeneratedEndClientBrief).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Client brief generation failed', {
      aiErrorKind: 'timeout',
      httpStatus: null,
      errorName: 'APIConnectionTimeoutError',
    })
  })

  it('refuses a malformed end client id without touching the database', async () => {
    const generationResult = await generateBriefForEndClient('not-a-uuid')

    expect(generationResult).toEqual({ ok: false, errorMessage: 'Client final introuvable' })
    expect(findEndClientBriefSubject).not.toHaveBeenCalled()
  })
})

describe('updateEndClientNotes', () => {
  it('stores trimmed notes, and empty notes as null', async () => {
    await updateEndClientNotes(END_CLIENT_ID, '  Parler de Kafka  ')
    await updateEndClientNotes(END_CLIENT_ID, '   ')

    expect(saveEndClientNotes).toHaveBeenNthCalledWith(1, fakeSupabaseClient, 'user-1', END_CLIENT_ID, 'Parler de Kafka')
    expect(saveEndClientNotes).toHaveBeenNthCalledWith(2, fakeSupabaseClient, 'user-1', END_CLIENT_ID, null)
  })

  it('refuses notes that are not text or too long', async () => {
    expect(await updateEndClientNotes(END_CLIENT_ID, 42 as unknown as string)).toEqual({
      ok: false,
      errorMessage: 'Notes invalides',
    })
    expect(await updateEndClientNotes(END_CLIENT_ID, 'a'.repeat(10_001))).toEqual({
      ok: false,
      errorMessage: 'Notes : 10000 caractères maximum',
    })
    expect(saveEndClientNotes).not.toHaveBeenCalled()
  })
})
