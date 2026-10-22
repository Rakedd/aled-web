/**
 * @jest-environment node
 */
import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { ProfileSettings } from '@/domain/profile-settings'
import { computeTodoAlerts, type AlertSnooze, type TodoAlert } from '@/domain/todo-alerts'
import type { CvLibraryItem } from '@/domain/cv-library'
import { listCvs } from '@/server/actions/cv-actions'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'
import { listAlertSnoozes, listJobApplications } from '@/server/actions/job-application-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'
import { loadTodoReminders } from './load-todo-reminders'

jest.mock('server-only', () => ({}))
jest.mock('@/server/actions/cv-actions', () => ({ listCvs: jest.fn() }))
jest.mock('@/server/actions/interview-actions', () => ({ listUpcomingInterviews: jest.fn() }))
jest.mock('@/server/actions/job-application-actions', () => ({
  listJobApplications: jest.fn(),
  listAlertSnoozes: jest.fn(),
}))
jest.mock('@/server/actions/settings-actions', () => ({ getProfileSettings: jest.fn() }))
jest.mock('@/domain/todo-alerts', () => ({ computeTodoAlerts: jest.fn() }))

const NOW = new Date('2026-10-19T10:00:00.000Z')
const LOOKAHEAD_DAYS = 7

const jobApplicationWithEndClient = { id: 'application-1', endClientId: 'end-client-1' } as JobApplicationListItem
const jobApplicationWithoutEndClient = { id: 'application-2', endClientId: null } as JobApplicationListItem
const profileSettings = { followUpDelayDays: 5 } as ProfileSettings
const alertSnoozes = [{ jobApplicationId: 'application-1' }] as AlertSnooze[]
const upcomingInterview = {
  id: 'interview-1',
  jobApplicationId: 'application-1',
  startsAt: new Date('2026-10-21T09:00:00.000Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
  jobApplicationTitle: 'Dev React',
  location: 'Paris',
} as InterviewWithJobApplication
const cvReviewedAt = new Date('2026-06-01T10:00:00.000Z')
const cvUploadedAt = new Date('2026-08-01T10:00:00.000Z')
const libraryCvs = [
  { id: 'cv-1', label: 'CV DevOps', reviewedAt: cvReviewedAt, currentVersion: { id: 'version-1', uploadedAt: cvUploadedAt, fileName: 'cv.pdf' } },
  { id: 'cv-2', label: 'CV vide', reviewedAt: cvReviewedAt, currentVersion: null },
] as CvLibraryItem[]
const computedAlerts = [{ kind: 'follow_up_due', jobApplicationId: 'application-1' }] as TodoAlert[]

const failure = (errorMessage: string): ActionResult<never> => ({ ok: false, errorMessage })

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(listJobApplications).mockResolvedValue({
    ok: true,
    data: [jobApplicationWithEndClient, jobApplicationWithoutEndClient],
  })
  jest.mocked(getProfileSettings).mockResolvedValue({ ok: true, data: profileSettings })
  jest.mocked(listAlertSnoozes).mockResolvedValue({ ok: true, data: alertSnoozes })
  jest.mocked(listUpcomingInterviews).mockResolvedValue({ ok: true, data: [upcomingInterview] })
  jest.mocked(listCvs).mockResolvedValue({ ok: true, data: libraryCvs })
  jest.mocked(computeTodoAlerts).mockReturnValue(computedAlerts)
})

describe('loadTodoReminders', () => {
  it('returns the first failure in load order when several loads fail', async () => {
    jest.mocked(getProfileSettings).mockResolvedValue(failure('profile failed'))
    jest.mocked(listAlertSnoozes).mockResolvedValue(failure('snoozes failed'))
    jest.mocked(listUpcomingInterviews).mockResolvedValue(failure('interviews failed'))

    expect(await loadTodoReminders(NOW, LOOKAHEAD_DAYS)).toEqual(failure('profile failed'))

    jest.mocked(listJobApplications).mockResolvedValue(failure('applications failed'))

    expect(await loadTodoReminders(NOW, LOOKAHEAD_DAYS)).toEqual(failure('applications failed'))

    jest.mocked(listJobApplications).mockResolvedValue({ ok: true, data: [] })
    jest.mocked(getProfileSettings).mockResolvedValue({ ok: true, data: profileSettings })

    expect(await loadTodoReminders(NOW, LOOKAHEAD_DAYS)).toEqual(failure('snoozes failed'))

    jest.mocked(listAlertSnoozes).mockResolvedValue({ ok: true, data: [] })

    expect(await loadTodoReminders(NOW, LOOKAHEAD_DAYS)).toEqual(failure('interviews failed'))
    expect(computeTodoAlerts).not.toHaveBeenCalled()
  })

  it('feeds the alert computation with end client flags and projected interviews', async () => {
    await loadTodoReminders(NOW, LOOKAHEAD_DAYS)

    expect(computeTodoAlerts).toHaveBeenCalledWith({
      jobApplications: [
        { ...jobApplicationWithEndClient, hasEndClient: true },
        { ...jobApplicationWithoutEndClient, hasEndClient: false },
      ],
      interviews: [
        {
          id: 'interview-1',
          jobApplicationId: 'application-1',
          startsAt: upcomingInterview.startsAt,
          kind: 'client',
        },
      ],
      snoozes: alertSnoozes,
      cvs: expect.any(Array),
      now: NOW,
      followUpDelayDays: 5,
    })
  })

  it('feeds the alert computation with the cv review dates', async () => {
    await loadTodoReminders(NOW, LOOKAHEAD_DAYS)

    expect(computeTodoAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        cvs: [
          { id: 'cv-1', label: 'CV DevOps', reviewedAt: cvReviewedAt, currentVersionUploadedAt: cvUploadedAt },
          { id: 'cv-2', label: 'CV vide', reviewedAt: cvReviewedAt, currentVersionUploadedAt: null },
        ],
      }),
    )
  })

  it('still computes job application alerts when the cv library fails to load', async () => {
    jest.mocked(listCvs).mockResolvedValue(failure('cvs failed'))

    const result = await loadTodoReminders(NOW, LOOKAHEAD_DAYS)

    expect(result.ok).toBe(true)
    expect(computeTodoAlerts).toHaveBeenCalledWith(expect.objectContaining({ cvs: [] }))
  })

  it('returns every loaded collection together with the computed alerts', async () => {
    const result = await loadTodoReminders(NOW, LOOKAHEAD_DAYS)

    expect(result).toEqual({
      ok: true,
      data: {
        jobApplications: [jobApplicationWithEndClient, jobApplicationWithoutEndClient],
        profileSettings,
        upcomingInterviews: [upcomingInterview],
        alertInterviews: [
          {
            id: 'interview-1',
            jobApplicationId: 'application-1',
            startsAt: upcomingInterview.startsAt,
            kind: 'client',
          },
        ],
        alerts: computedAlerts,
      },
    })
  })
})
