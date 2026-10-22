/**
 * @jest-environment node
 */
import { CALL_LOG_MESSAGES, type RecordCallInput } from '@/domain/call-log'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { applyContactDetails } from '@/server/repositories/entities-repository'
import { recordContactExchange } from '@/server/repositories/exchanges-repository'
import { findCvRow, setSentCvVersion } from '@/server/repositories/cvs-repository'
import { insertContact } from '@/server/repositories/contacts-repository'
import { findJobApplicationOverview, insertJobApplication } from '@/server/repositories/job-applications-repository'
import type { JobApplicationInput, JobApplicationOverview } from '@/domain/job-application'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { recordCall } from './record-call'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/entities-repository', () => ({ applyContactDetails: jest.fn() }))
jest.mock('@/server/repositories/contacts-repository', () => ({ insertContact: jest.fn() }))
jest.mock('@/server/repositories/job-applications-repository', () => ({
  insertJobApplication: jest.fn(),
  findJobApplicationOverview: jest.fn(),
}))
jest.mock('@/server/repositories/exchanges-repository', () => ({ recordContactExchange: jest.fn() }))
jest.mock('@/server/repositories/cvs-repository', () => ({ findCvRow: jest.fn(), setSentCvVersion: jest.fn() }))

const supabase = {} as FreeclutchSupabaseClient
const userId = 'user-1'
const emptyContactDetails = { phone: null, email: null, linkedinUrl: null }
const jobApplicationInput = { title: 'Mission React', contactName: null } as JobApplicationInput

const buildInput = (overrides: Partial<RecordCallInput> = {}): RecordCallInput => ({
  contact: {
    kind: 'new',
    profile: {
      fullName: 'Jean-Marc Dupont',
      phone: null,
      email: null,
      linkedinUrl: null,
      intermediaryName: null,
      referredBy: null,
      notes: null,
    },
  },
  contactDetails: emptyContactDetails,
  userEditedContactFields: [],
  exchange: { summary: 'Appel', occurredAt: new Date('2026-10-22T09:30:00.000Z') },
  jobApplication: { input: jobApplicationInput, sentCvId: null },
  existingJobApplicationId: null,
  ...overrides,
})

describe('recordCall', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(insertContact).mockResolvedValue({ ok: true, data: { id: 'contact-1' } })
    jest.mocked(insertJobApplication).mockResolvedValue({ ok: true, data: { id: 'job-1' } })
    jest.mocked(recordContactExchange).mockResolvedValue({ ok: true, data: null })
  })

  it('returns the created contact id when creating the job application throws', async () => {
    jest.mocked(insertJobApplication).mockRejectedValue(new Error('database down'))

    const outcome = await recordCall(supabase, userId, buildInput())

    expect(outcome).toEqual({
      ok: false,
      error: {
        kind: 'save_failed',
        message: CALL_LOG_MESSAGES.saveFailed,
        createdContactId: 'contact-1',
        createdJobApplicationId: null,
      },
    })
    expect(recordContactExchange).not.toHaveBeenCalled()
  })

  it('returns the created contact and job application ids when recording the exchange throws', async () => {
    jest.mocked(recordContactExchange).mockRejectedValue(new Error('database down'))

    const outcome = await recordCall(supabase, userId, buildInput())

    expect(outcome).toEqual({
      ok: false,
      error: {
        kind: 'save_failed',
        message: CALL_LOG_MESSAGES.saveFailed,
        createdContactId: 'contact-1',
        createdJobApplicationId: 'job-1',
      },
    })
  })

  it('keeps the call recorded when attaching the cv throws', async () => {
    jest.mocked(findCvRow).mockResolvedValue({ ok: true, data: { label: 'CV', currentVersionId: 'version-1' } })
    jest.mocked(setSentCvVersion).mockRejectedValue(new Error('database down'))

    const outcome = await recordCall(
      supabase,
      userId,
      buildInput({ jobApplication: { input: jobApplicationInput, sentCvId: 'cv-1' } }),
    )

    expect(outcome).toEqual({ ok: true, data: { contactId: 'contact-1', jobApplicationId: 'job-1' } })
    expect(console.error).toHaveBeenCalledWith('Sent cv attachment failed after a call', { errorMessage: 'database down' })
  })

  it('creates no job application when an existing one is given', async () => {
    jest.mocked(findJobApplicationOverview).mockResolvedValue({
      ok: true,
      data: { contactId: 'contact-9' } as JobApplicationOverview,
    })
    jest.mocked(applyContactDetails).mockResolvedValue({
      ok: true,
      data: { id: 'contact-9', fullName: 'Jean-Marc Dupont', ...emptyContactDetails },
    })

    const outcome = await recordCall(
      supabase,
      userId,
      buildInput({
        contact: { kind: 'existing', contactId: 'contact-9' },
        existingJobApplicationId: 'job-9',
      }),
    )

    expect(insertJobApplication).not.toHaveBeenCalled()
    expect(recordContactExchange).toHaveBeenCalledWith(
      supabase,
      userId,
      'contact-9',
      expect.objectContaining({ jobApplicationId: 'job-9' }),
    )
    expect(outcome).toEqual({ ok: true, data: { contactId: 'contact-9', jobApplicationId: 'job-9' } })
  })

  it('answers not_found for an unknown or foreign contact', async () => {
    jest.mocked(applyContactDetails).mockResolvedValue({ ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact })

    const outcome = await recordCall(supabase, userId, buildInput({ contact: { kind: 'existing', contactId: 'contact-9' } }))

    expect(outcome).toEqual({
      ok: false,
      error: { kind: 'not_found', message: ENTITY_NOT_FOUND_MESSAGES.contact, createdContactId: null, createdJobApplicationId: null },
    })
    expect(recordContactExchange).not.toHaveBeenCalled()
  })
})
