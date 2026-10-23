/**
 * @jest-environment node
 */
import { FOLLOW_UP_AI_ERROR_MESSAGES, FOLLOW_UP_MESSAGES, type FollowUpMessageRequest } from '@/domain/follow-up-message'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE, type JobApplicationOverview } from '@/domain/job-application'
import type { ProfileSettings } from '@/domain/profile-settings'
import { AiError } from '@/server/ai/ai-error'
import { listActivityLogEntriesForJobApplication } from '@/server/repositories/activity-log-repository'
import { findContactDetails } from '@/server/repositories/entities-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { findEncryptedAnthropicApiKey, findProfileSettings } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { draftFollowUpMessage, type FollowUpMessageDependencies } from './draft-follow-up-message'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/job-applications-repository', () => ({ findJobApplicationOverview: jest.fn() }))
jest.mock('@/server/repositories/entities-repository', () => ({ findContactDetails: jest.fn() }))
jest.mock('@/server/repositories/activity-log-repository', () => ({ listActivityLogEntriesForJobApplication: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({
  findEncryptedAnthropicApiKey: jest.fn(),
  findProfileSettings: jest.fn(),
}))

const supabase = {} as FreeclutchSupabaseClient
const USER_ID = 'user-1'
const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const CONTACT_ID = 'contact-1'
const REQUEST: FollowUpMessageRequest = { jobApplicationId: JOB_APPLICATION_ID, formality: 'tu' }
const APPLIED_ON = new Date('2026-10-01T10:00:00.000Z')
const LAST_ACTIVITY_AT = new Date('2026-10-12T15:00:00.000Z')

const buildJobApplication = (overrides: Partial<JobApplicationOverview> = {}): JobApplicationOverview =>
  ({
    id: JOB_APPLICATION_ID,
    title: 'Développeur React',
    status: 'cv_submitted',
    contactId: CONTACT_ID,
    contactName: 'Marie Durand',
    intermediaryName: 'Malt',
    endClientName: 'Doctolib',
    appliedOn: APPLIED_ON,
    lastActivityAt: LAST_ACTIVITY_AT,
    notes: 'Note privée à ne jamais envoyer',
    ...overrides,
  }) as JobApplicationOverview

const buildDependencies = (): jest.Mocked<FollowUpMessageDependencies> => ({
  decryptApiKey: jest.fn().mockReturnValue('plain-key'),
  generateFollowUpMessage: jest.fn().mockResolvedValue({ subject: 'Suivi', message: 'Bonjour Marie.' }),
})

describe('draftFollowUpMessage', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(findJobApplicationOverview).mockResolvedValue({ ok: true, data: buildJobApplication() })
    jest.mocked(findContactDetails).mockResolvedValue({
      ok: true,
      data: {
        id: CONTACT_ID,
        fullName: 'Marie Durand',
        phone: null,
        email: 'marie@malt.fr',
        linkedinUrl: 'https://www.linkedin.com/in/marie',
      },
    })
    jest.mocked(listActivityLogEntriesForJobApplication).mockResolvedValue({
      ok: true,
      data: [
        { id: 'entry-1', jobApplicationId: JOB_APPLICATION_ID, occurredAt: LAST_ACTIVITY_AT, kind: 'call', summary: 'CV transmis' },
      ],
    })
    jest.mocked(findProfileSettings).mockResolvedValue({ firstName: 'Rayan' } as ProfileSettings)
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue('encrypted-key')
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => consoleErrorSpy.mockRestore())

  it('drafts the message with the context of the job application and returns the contact channels', async () => {
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({
      ok: true,
      data: {
        subject: 'Suivi',
        message: 'Bonjour Marie.',
        contactEmail: 'marie@malt.fr',
        contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
      },
    })
    expect(findJobApplicationOverview).toHaveBeenCalledWith(supabase, USER_ID, JOB_APPLICATION_ID)
    expect(findContactDetails).toHaveBeenCalledWith(supabase, USER_ID, CONTACT_ID)
    expect(dependencies.decryptApiKey).toHaveBeenCalledWith('encrypted-key')
    expect(dependencies.generateFollowUpMessage).toHaveBeenCalledWith('plain-key', {
      formality: 'tu',
      missionTitle: 'Développeur React',
      statusLabel: 'CV positionné',
      endClientName: 'Doctolib',
      intermediaryName: 'Malt',
      contactName: 'Marie Durand',
      appliedOn: APPLIED_ON,
      lastActivityAt: LAST_ACTIVITY_AT,
      recentActivities: [{ occurredAt: LAST_ACTIVITY_AT, kind: 'call', summary: 'CV transmis' }],
      userFirstName: 'Rayan',
    })
    expect(JSON.stringify(dependencies.generateFollowUpMessage.mock.calls[0][1])).not.toContain('Note privée')
  })

  it('answers not found without drafting when the job application is not visible to the user', async () => {
    jest.mocked(findJobApplicationOverview).mockResolvedValue({ ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE })
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'not_found', message: JOB_APPLICATION_NOT_FOUND_MESSAGE }),
    })
    expect(dependencies.generateFollowUpMessage).not.toHaveBeenCalled()
  })

  it('refuses a closed job application as an invalid request', async () => {
    jest.mocked(findJobApplicationOverview).mockResolvedValue({ ok: true, data: buildJobApplication({ status: 'ko_cv' }) })
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'invalid_request', message: FOLLOW_UP_MESSAGES.closedJobApplication }),
    })
    expect(dependencies.generateFollowUpMessage).not.toHaveBeenCalled()
  })

  it('answers missing api key without drafting when the user has no Claude key', async () => {
    jest.mocked(findEncryptedAnthropicApiKey).mockResolvedValue(null)
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'missing_api_key', message: FOLLOW_UP_AI_ERROR_MESSAGES.missing_api_key }),
    })
    expect(dependencies.decryptApiKey).not.toHaveBeenCalled()
    expect(dependencies.generateFollowUpMessage).not.toHaveBeenCalled()
    expect(findContactDetails).not.toHaveBeenCalled()
    expect(listActivityLogEntriesForJobApplication).not.toHaveBeenCalled()
    expect(findProfileSettings).not.toHaveBeenCalled()
  })

  it('drafts without contact channels when the job application has no contact', async () => {
    jest.mocked(findJobApplicationOverview).mockResolvedValue({
      ok: true,
      data: buildJobApplication({ contactId: null, contactName: null }),
    })
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({ ok: true, data: expect.objectContaining({ contactEmail: null, contactLinkedinUrl: null }) })
    expect(findContactDetails).not.toHaveBeenCalled()
  })

  it('drafts without contact channels and without journal when they cannot be read', async () => {
    jest.mocked(findContactDetails).mockResolvedValue({ ok: false, errorMessage: 'Contact introuvable' })
    jest.mocked(listActivityLogEntriesForJobApplication).mockResolvedValue({ ok: false, errorMessage: 'introuvable' })
    const dependencies = buildDependencies()

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({ ok: true, data: expect.objectContaining({ contactEmail: null, contactLinkedinUrl: null }) })
    expect(dependencies.generateFollowUpMessage.mock.calls[0][1].recentActivities).toEqual([])
  })

  it('drops a contact profile link that is not an http link', async () => {
    jest.mocked(findContactDetails).mockResolvedValue({
      ok: true,
      data: { id: CONTACT_ID, fullName: 'Marie', phone: null, email: null, linkedinUrl: 'javascript:alert(1)' },
    })

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, buildDependencies())

    expect(outcome).toEqual({ ok: true, data: expect.objectContaining({ contactLinkedinUrl: null }) })
  })

  it.each([
    ['refused', new AiError('refused')],
    ['timeout', new AiError('timeout')],
    ['unknown', new Error('boom')],
  ] as const)('translates a %s generation failure into its follow up message', async (expectedKind, generationError) => {
    const dependencies = buildDependencies()
    dependencies.generateFollowUpMessage.mockRejectedValue(generationError)

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: expectedKind, message: FOLLOW_UP_AI_ERROR_MESSAGES[expectedKind] }),
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Follow up message drafting failed', expect.objectContaining({ aiErrorKind: expectedKind }))
  })

  it('translates a key that cannot be decrypted into an unknown failure', async () => {
    const dependencies = buildDependencies()
    dependencies.decryptApiKey.mockImplementation(() => {
      throw new Error('bad secret')
    })

    const outcome = await draftFollowUpMessage(supabase, USER_ID, REQUEST, dependencies)

    expect(outcome).toEqual({ ok: false, error: expect.objectContaining({ kind: 'unknown' }) })
    expect(dependencies.generateFollowUpMessage).not.toHaveBeenCalled()
  })
})
