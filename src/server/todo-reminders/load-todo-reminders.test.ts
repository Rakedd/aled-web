/**
 * @jest-environment node
 */
import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { ProfileSettings } from '@/domain/profile-settings'
import { computeTodoAlerts, type AlertSnooze, type TodoAlert } from '@/domain/todo-alerts'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'
import { listAlertSnoozes, listJobApplications } from '@/server/actions/job-application-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'
import { loadTodoReminders } from './load-todo-reminders'

jest.mock('server-only', () => ({}))
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
      now: NOW,
      followUpDelayDays: 5,
    })
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
