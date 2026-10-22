/**
 * @jest-environment node
 */
import { CALL_LOG_MESSAGES, type CallDraftInput } from '@/domain/call-log'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import type { ContactListItem } from '@/domain/contacts'
import type { CvLibraryItem } from '@/domain/cv-library'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { AiError } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractCallNote } from '@/server/ai/extract-call-note'
import { emptyCallNoteExtraction } from '@/server/ai/testing/fake-anthropic-client'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { listContactListItems } from '@/server/repositories/contacts-repository'
import { listCvLibraryItems } from '@/server/repositories/cvs-repository'
import { findEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { prepareCallDraft } from './prepare-call-draft'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/profile-repository', () => ({ findEncryptedAnthropicApiKey: jest.fn() }))
jest.mock('@/server/repositories/contacts-repository', () => ({ listContactListItems: jest.fn() }))
jest.mock('@/server/repositories/cvs-repository', () => ({ listCvLibraryItems: jest.fn() }))
jest.mock('@/server/crypto/api-key-encryption', () => ({ decryptApiKey: jest.fn(), readApiKeyEncryptionSecret: jest.fn() }))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))
jest.mock('@/server/ai/extract-call-note', () => ({ extractCallNote: jest.fn() }))

const supabase = {} as FreeclutchSupabaseClient
const userId = 'user-1'
const callInput: CallDraftInput = {
  text: 'Appel avec Jean-Marc',
  phone: null,
  contactId: null,
  occurredAt: new Date('2026-10-22T09:30:00.000Z'),
}

const jeanMarc: ContactListItem = {
  id: 'contact-1',
  fullName: 'Jean-Marc Dupont',
  intermediaryId: null,
  intermediaryName: 'Hays',
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
}

const devopsCv: CvLibraryItem = {
  id: 'cv-1',
  label: 'CV DevOps',
  reviewedAt: new Date('2026-01-01'),
  currentVersion: { id: 'version-1', uploadedAt: new Date('2026-01-01'), fileName: 'cv.pdf' },
  sentCount: 0,
  previousSentVersions: [],
}

describe('prepareCallDraft', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue('encrypted-key')
    jest.mocked(listContactListItems).mockResolvedValue([jeanMarc])
    jest.mocked(listCvLibraryItems).mockResolvedValue([devopsCv])
    jest.mocked(readApiKeyEncryptionSecret).mockReturnValue('base64-secret')
    jest.mocked(decryptApiKey).mockReturnValue('plain-key')
    jest.mocked(extractCallNote).mockResolvedValue({
      ...emptyCallNoteExtraction,
      contactName: 'Jean-Marc Dupont',
      summary: 'Résumé',
      missionProposed: true,
      missionTitle: 'Développeur React',
      cvLabel: 'mon CV DevOps',
    })
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => consoleErrorSpy.mockRestore())

  it('answers missing_api_key without calling claude', async () => {
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue(null)
    const outcome = await prepareCallDraft(supabase, userId, callInput)
    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'missing_api_key', message: CALL_LOG_MESSAGES.missingApiKey }),
    })
    expect(extractCallNote).not.toHaveBeenCalled()
  })

  it('answers not_found for a preselected contact outside the user contacts, without calling claude', async () => {
    const outcome = await prepareCallDraft(supabase, userId, { ...callInput, contactId: 'foreign-contact' })
    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'not_found', message: ENTITY_NOT_FOUND_MESSAGES.contact }),
    })
    expect(extractCallNote).not.toHaveBeenCalled()
  })

  it('words an AI failure for the call screen and logs it', async () => {
    jest.mocked(extractCallNote).mockRejectedValueOnce(new AiError('unknown'))
    const unknownOutcome = await prepareCallDraft(supabase, userId, callInput)
    expect(unknownOutcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'unknown', message: CALL_LOG_MESSAGES.aiFailed }),
    })
    jest.mocked(extractCallNote).mockRejectedValueOnce(new AiError('rate_limited'))
    const rateLimitedOutcome = await prepareCallDraft(supabase, userId, callInput)
    expect(rateLimitedOutcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'rate_limited', message: AI_ERROR_MESSAGES.rate_limited }),
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Call note extraction failed',
      expect.objectContaining({ aiErrorKind: 'unknown' }),
    )
  })

  it('builds the draft with the decrypted key, the contacts and the cv options', async () => {
    const outcome = await prepareCallDraft(supabase, userId, callInput)
    expect(decryptApiKey).toHaveBeenCalledWith('encrypted-key', 'base64-secret')
    expect(createAnthropicClient).toHaveBeenCalledWith('plain-key')
    expect(extractCallNote).toHaveBeenCalledWith(undefined, 'Appel avec Jean-Marc')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.data.contact.suggestedContactId).toBe('contact-1')
    expect(outcome.data.jobApplication).toMatchObject({ title: 'Développeur React', cvId: 'cv-1' })
  })

  it('still prepares the draft when the cv library fails to load', async () => {
    jest.mocked(listCvLibraryItems).mockRejectedValue(new Error('cv table down'))
    const outcome = await prepareCallDraft(supabase, userId, callInput)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Call draft cv loading failed', { errorMessage: 'cv table down' })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.data.jobApplication?.cvId).toBeNull()
  })
})
