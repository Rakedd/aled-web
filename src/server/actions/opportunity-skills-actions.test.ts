/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import { rejectWith } from '@/domain/input-validation'
import { AiError } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractCvSkills } from '@/server/ai/extract-cv-skills'
import { findCvRow, findCvVersionForTechnicalBrief } from '@/server/repositories/cvs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { extractSkillsFromCv } from './opportunity-skills-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/repositories/cvs-repository', () => ({
  findCvRow: jest.fn(),
  findCvVersionForTechnicalBrief: jest.fn(),
}))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))
jest.mock('@/server/ai/extract-cv-skills', () => ({ extractCvSkills: jest.fn() }))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const fakeAnthropicClient = { messages: { create: jest.fn() } } as unknown as Anthropic
const CV_ID = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const VERSION_ID = '7a1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e40'

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-user-key')
  jest.mocked(createAnthropicClient).mockReturnValue(fakeAnthropicClient)
  jest.mocked(findCvRow).mockResolvedValue({ ok: true, data: { label: 'CV React', currentVersionId: VERSION_ID } })
  jest.mocked(findCvVersionForTechnicalBrief).mockResolvedValue({
    ok: true,
    data: { versionId: VERSION_ID, label: 'CV React', uploadedAt: new Date('2026-10-01T09:00:00Z'), pdfBase64: 'JVBERi0=' },
  })
  jest.mocked(extractCvSkills).mockResolvedValue(['React', 'TypeScript'])
})

afterEach(() => {
  jest.mocked(console.error).mockRestore()
})

describe('extractSkillsFromCv', () => {
  it('extracts the skills of the current version of my CV with my own Claude key', async () => {
    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({ ok: true, data: ['React', 'TypeScript'] })

    expect(getDecryptedAnthropicApiKeyForUser).toHaveBeenCalledWith('user-1')
    expect(findCvRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', CV_ID)
    expect(findCvVersionForTechnicalBrief).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', VERSION_ID)
    expect(createAnthropicClient).toHaveBeenCalledWith('sk-ant-user-key')
    expect(extractCvSkills).toHaveBeenCalledWith(fakeAnthropicClient, 'JVBERi0=')
  })

  it('rejects an id that is not a uuid without touching the database', async () => {
    await expect(extractSkillsFromCv('42')).resolves.toEqual({ ok: false, errorMessage: 'CV introuvable' })

    expect(createServerSupabaseClient).not.toHaveBeenCalled()
    expect(findCvRow).not.toHaveBeenCalled()
  })

  it('asks for a Claude key before downloading anything when I have none', async () => {
    jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue(null)

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({
      ok: false,
      errorMessage: 'Ajoute ta clé Claude dans tes préférences pour extraire tes compétences.',
    })
    expect(findCvRow).not.toHaveBeenCalled()
    expect(extractCvSkills).not.toHaveBeenCalled()
  })

  it('answers « CV introuvable » for a CV that is not mine', async () => {
    jest.mocked(findCvRow).mockResolvedValue(rejectWith('CV introuvable'))

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({ ok: false, errorMessage: 'CV introuvable' })
    expect(extractCvSkills).not.toHaveBeenCalled()
  })

  it('refuses a CV without current version', async () => {
    jest.mocked(findCvRow).mockResolvedValue({ ok: true, data: { label: 'CV vide', currentVersionId: null } })

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({ ok: false, errorMessage: 'Version de CV introuvable' })
    expect(findCvVersionForTechnicalBrief).not.toHaveBeenCalled()
  })

  it('passes on the failure to find the stored PDF', async () => {
    jest.mocked(findCvVersionForTechnicalBrief).mockResolvedValue(rejectWith('Version de CV introuvable'))

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({ ok: false, errorMessage: 'Version de CV introuvable' })
    expect(extractCvSkills).not.toHaveBeenCalled()
  })

  it.each([
    [new AiError('refused'), "Claude n'a pas pu lire ce CV. Ajoute tes compétences à la main."],
    [new Error('boom'), "L'extraction a échoué. Ajoute tes compétences à la main."],
    [
      new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()),
      'Ta clé Claude est invalide ou sans crédit, remplace-la dans tes préférences.',
    ],
  ])('answers with a message specific to the skills extraction when Claude fails (%p)', async (aiFailure, expectedMessage) => {
    jest.mocked(extractCvSkills).mockRejectedValue(aiFailure)

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({ ok: false, errorMessage: expectedMessage })
    expect(console.error).toHaveBeenCalledWith(
      'CV skills extraction failed',
      expect.objectContaining({ aiErrorKind: expect.any(String) }),
    )
  })

  it('answers with a generic failure when the database fails', async () => {
    jest.mocked(findCvRow).mockRejectedValue(new Error('connection lost'))

    await expect(extractSkillsFromCv(CV_ID)).resolves.toEqual({
      ok: false,
      errorMessage: "Impossible d'extraire tes compétences pour le moment. Réessaie dans quelques minutes.",
    })
  })
})
