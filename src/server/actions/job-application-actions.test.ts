/**
 * @jest-environment node
 */
import type { JobApplicationInput } from '@/domain/job-application'
import {
  listActivityLogEntriesForJobApplication,
  recordActivityLogEntry,
} from '@/server/repositories/activity-log-repository'
import { listActiveAlertSnoozes, snoozeJobApplicationAlert } from '@/server/repositories/alert-snoozes-repository'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import {
  changeJobApplicationStatusRow,
  deleteJobApplicationRow,
  findJobApplicationOverview,
  insertJobApplication,
  listJobApplicationItems,
  updateJobApplicationRow,
} from '@/server/repositories/job-applications-repository'
import { findJobSpecStoragePath, removeJobSpecFile } from '@/server/repositories/job-specs-repository'
import { deleteAppliedOpportunityDecisionsOfJobApplication } from '@/server/repositories/opportunity-decisions-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import {
  addActivityLogEntry,
  changeJobApplicationStatus,
  createJobApplication,
  deleteJobApplication,
  getJobApplication,
  listActivityLogEntries,
  listAlertSnoozes,
  listJobApplications,
  snoozeAlert,
  updateJobApplication,
} from './job-application-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/job-applications-repository', () => ({
  listJobApplicationItems: jest.fn(),
  findJobApplicationOverview: jest.fn(),
  insertJobApplication: jest.fn(),
  updateJobApplicationRow: jest.fn(),
  changeJobApplicationStatusRow: jest.fn(),
  deleteJobApplicationRow: jest.fn(),
}))
jest.mock('@/server/repositories/job-application-ownership', () => ({ isJobApplicationOwnedByUser: jest.fn() }))
jest.mock('@/server/repositories/job-specs-repository', () => ({
  findJobSpecStoragePath: jest.fn(),
  removeJobSpecFile: jest.fn(),
}))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({
  deleteAppliedOpportunityDecisionsOfJobApplication: jest.fn(),
}))
jest.mock('@/server/repositories/activity-log-repository', () => ({
  recordActivityLogEntry: jest.fn(),
  listActivityLogEntriesForJobApplication: jest.fn(),
}))
jest.mock('@/server/repositories/alert-snoozes-repository', () => ({
  snoozeJobApplicationAlert: jest.fn(),
  listActiveAlertSnoozes: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const jobApplicationId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const succeeded = { ok: true, data: null } as const

const validJobApplicationInput: JobApplicationInput = {
  title: 'Développeur React',
  source: null,
  postingUrl: null,
  postingRawText: null,
  status: 'applied',
  postedDailyRate: null,
  requestedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  appliedOn: new Date('2026-10-16T22:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [],
  intermediaryName: 'Agence X',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  contactLinkedinUrl: null,
  userEditedContactFields: [],
  endClientName: null,
  endClientParentName: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
})

describe('listJobApplications', () => {
  it('lists the job applications of the authenticated user', async () => {
    jest.mocked(listJobApplicationItems).mockResolvedValue([])
    await expect(listJobApplications()).resolves.toEqual({ ok: true, data: [] })
    expect(listJobApplicationItems).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('returns a generic message when the job applications cannot be loaded', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(listJobApplicationItems).mockRejectedValue(new Error('Repository failure'))
    await expect(listJobApplications()).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de charger les candidatures pour le moment. Réessaie dans quelques minutes.',
    })
    consoleErrorSpy.mockRestore()
  })
})

describe('getJobApplication', () => {
  it('rejects a malformed id without querying the database', async () => {
    await expect(getJobApplication('42')).resolves.toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
    expect(findJobApplicationOverview).not.toHaveBeenCalled()
  })

  it('reads the job application of the authenticated user', async () => {
    jest.mocked(findJobApplicationOverview).mockResolvedValue({ ok: false, errorMessage: 'Candidature introuvable' })
    await getJobApplication(jobApplicationId)
    expect(findJobApplicationOverview).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId)
  })
})

describe('createJobApplication', () => {
  it('creates the job application from the known fields only', async () => {
    jest.mocked(insertJobApplication).mockResolvedValue({ ok: true, data: { id: jobApplicationId } })
    const forgedInput = { ...validJobApplicationInput, user_id: 'user-2', id: 'forged' }

    await expect(createJobApplication(forgedInput)).resolves.toEqual({ ok: true, data: { id: jobApplicationId } })
    expect(insertJobApplication).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', validJobApplicationInput)
  })

  it('rejects an invalid input without touching the database', async () => {
    await expect(createJobApplication({ ...validJobApplicationInput, title: ' ' })).resolves.toEqual({
      ok: false,
      errorMessage: 'Le titre est obligatoire',
    })
    expect(insertJobApplication).not.toHaveBeenCalled()
  })
})

describe('updateJobApplication', () => {
  it('updates only the provided known fields', async () => {
    jest.mocked(updateJobApplicationRow).mockResolvedValue(succeeded)
    const forgedInput = { notes: ' À rappeler ', user_id: 'user-2' }

    await expect(updateJobApplication(jobApplicationId, forgedInput)).resolves.toEqual(succeeded)
    expect(updateJobApplicationRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId, {
      notes: 'À rappeler',
    })
  })

  it('rejects an invalid field', async () => {
    await expect(updateJobApplication(jobApplicationId, { postedDailyRate: -1 })).resolves.toEqual({
      ok: false,
      errorMessage: 'TJM invalide',
    })
    expect(updateJobApplicationRow).not.toHaveBeenCalled()
  })
})

describe('changeJobApplicationStatus', () => {
  it('changes the status of the job application', async () => {
    jest.mocked(changeJobApplicationStatusRow).mockResolvedValue(succeeded)
    await expect(changeJobApplicationStatus(jobApplicationId, 'cv_submitted')).resolves.toEqual(succeeded)
    expect(changeJobApplicationStatusRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId, 'cv_submitted')
  })

  it('rejects an unknown status', async () => {
    const unknownStatus = 'hired' as Parameters<typeof changeJobApplicationStatus>[1]
    await expect(changeJobApplicationStatus(jobApplicationId, unknownStatus)).resolves.toEqual({
      ok: false,
      errorMessage: 'Statut invalide',
    })
    expect(changeJobApplicationStatusRow).not.toHaveBeenCalled()
  })
})

describe('addActivityLogEntry', () => {
  it('records the validated entry', async () => {
    jest.mocked(recordActivityLogEntry).mockResolvedValue(succeeded)
    await expect(addActivityLogEntry(jobApplicationId, { kind: 'call', summary: ' Appel ' })).resolves.toEqual(succeeded)
    expect(recordActivityLogEntry).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId, {
      kind: 'call',
      summary: 'Appel',
    })
  })

  it('records an exchange dated in the past', async () => {
    jest.mocked(recordActivityLogEntry).mockResolvedValue(succeeded)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await expect(addActivityLogEntry(jobApplicationId, { kind: 'call', summary: 'Appel', occurredAt: yesterday })).resolves.toEqual(
      succeeded,
    )
    expect(recordActivityLogEntry).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId, {
      kind: 'call',
      summary: 'Appel',
      occurredAt: yesterday,
    })
  })

  it('refuses an exchange dated in the future', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await expect(addActivityLogEntry(jobApplicationId, { kind: 'call', summary: 'Appel', occurredAt: tomorrow })).resolves.toEqual({
      ok: false,
      errorMessage: "La date de l'échange ne peut pas être dans le futur",
    })
    expect(recordActivityLogEntry).not.toHaveBeenCalled()
  })

  it('rejects an empty summary', async () => {
    await expect(addActivityLogEntry(jobApplicationId, { kind: 'call', summary: '' })).resolves.toEqual({
      ok: false,
      errorMessage: 'Le résumé est obligatoire',
    })
    expect(recordActivityLogEntry).not.toHaveBeenCalled()
  })
})

describe('listActivityLogEntries', () => {
  it('lists the entries of the job application', async () => {
    jest.mocked(listActivityLogEntriesForJobApplication).mockResolvedValue({ ok: true, data: [] })
    await expect(listActivityLogEntries(jobApplicationId)).resolves.toEqual({ ok: true, data: [] })
    expect(listActivityLogEntriesForJobApplication).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId)
  })
})

describe('snoozeAlert', () => {
  it('snoozes the alert from the current time', async () => {
    jest.mocked(snoozeJobApplicationAlert).mockResolvedValue(succeeded)
    await expect(snoozeAlert(jobApplicationId, 'follow_up_due', 3)).resolves.toEqual(succeeded)
    expect(snoozeJobApplicationAlert).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      { jobApplicationId, alertKind: 'follow_up_due', snoozeDays: 3 },
      expect.any(Date),
    )
  })

  it('refuses to snooze an upcoming interview', async () => {
    await expect(snoozeAlert(jobApplicationId, 'upcoming_interview', 3)).resolves.toEqual({
      ok: false,
      errorMessage: 'Un entretien à venir ne peut pas être reporté',
    })
    expect(snoozeJobApplicationAlert).not.toHaveBeenCalled()
  })
})

describe('listAlertSnoozes', () => {
  it('lists the active snoozes of the authenticated user', async () => {
    jest.mocked(listActiveAlertSnoozes).mockResolvedValue([])
    await expect(listAlertSnoozes()).resolves.toEqual({ ok: true, data: [] })
    expect(listActiveAlertSnoozes).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', expect.any(Date))
  })
})

describe('deleteJobApplication', () => {
  const storagePath = `user-1/${jobApplicationId}/fiche.pdf`
  const deletionFailureMessage =
    'Impossible de supprimer la candidature pour le moment. Réessaie dans quelques minutes.'
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(isJobApplicationOwnedByUser).mockResolvedValue(true)
    jest.mocked(findJobSpecStoragePath).mockResolvedValue(storagePath)
    jest.mocked(deleteAppliedOpportunityDecisionsOfJobApplication).mockResolvedValue(undefined)
    jest.mocked(deleteJobApplicationRow).mockResolvedValue(true)
    jest.mocked(removeJobSpecFile).mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('rejects a malformed id without touching the database', async () => {
    await expect(deleteJobApplication('42')).resolves.toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
    expect(isJobApplicationOwnedByUser).not.toHaveBeenCalled()
    expect(deleteJobApplicationRow).not.toHaveBeenCalled()
  })

  it('checks ownership, reads the pdf path, deletes the decisions, the application then the pdf, in that order', async () => {
    const callOrder: string[] = []
    jest.mocked(isJobApplicationOwnedByUser).mockImplementation(async () => {
      callOrder.push('ownership')
      return true
    })
    jest.mocked(findJobSpecStoragePath).mockImplementation(async () => {
      callOrder.push('storagePath')
      return storagePath
    })
    jest.mocked(deleteAppliedOpportunityDecisionsOfJobApplication).mockImplementation(async () => {
      callOrder.push('decisions')
    })
    jest.mocked(deleteJobApplicationRow).mockImplementation(async () => {
      callOrder.push('application')
      return true
    })
    jest.mocked(removeJobSpecFile).mockImplementation(async () => {
      callOrder.push('pdf')
    })

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual(succeeded)

    expect(callOrder).toEqual(['ownership', 'storagePath', 'decisions', 'application', 'pdf'])
    expect(isJobApplicationOwnedByUser).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId)
    expect(findJobSpecStoragePath).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId)
    expect(deleteAppliedOpportunityDecisionsOfJobApplication).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      jobApplicationId,
    )
    expect(deleteJobApplicationRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', jobApplicationId)
    expect(removeJobSpecFile).toHaveBeenCalledWith(fakeSupabaseClient, storagePath)
  })

  it('does not touch the storage when the application has no pdf', async () => {
    jest.mocked(findJobSpecStoragePath).mockResolvedValue(null)

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual(succeeded)

    expect(deleteJobApplicationRow).toHaveBeenCalled()
    expect(removeJobSpecFile).not.toHaveBeenCalled()
  })

  it('answers « Candidature introuvable » and deletes nothing when the application is not owned', async () => {
    jest.mocked(isJobApplicationOwnedByUser).mockResolvedValue(false)

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Candidature introuvable',
    })

    expect(findJobSpecStoragePath).not.toHaveBeenCalled()
    expect(deleteAppliedOpportunityDecisionsOfJobApplication).not.toHaveBeenCalled()
    expect(deleteJobApplicationRow).not.toHaveBeenCalled()
    expect(removeJobSpecFile).not.toHaveBeenCalled()
  })

  it('stops and deletes nothing more when a step before the application deletion fails', async () => {
    jest.mocked(deleteAppliedOpportunityDecisionsOfJobApplication).mockRejectedValue(new Error('Repository failure'))

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({
      ok: false,
      errorMessage: deletionFailureMessage,
    })

    expect(deleteJobApplicationRow).not.toHaveBeenCalled()
    expect(removeJobSpecFile).not.toHaveBeenCalled()
  })

  it('keeps the pdf when the application disappeared before its deletion', async () => {
    jest.mocked(deleteJobApplicationRow).mockResolvedValue(false)

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Candidature introuvable',
    })

    expect(removeJobSpecFile).not.toHaveBeenCalled()
  })

  it('still succeeds and logs without the path when the pdf removal throws', async () => {
    jest.mocked(removeJobSpecFile).mockRejectedValue(new Error(`Network failure on ${storagePath}`))

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual(succeeded)

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(storagePath)
  })
})
