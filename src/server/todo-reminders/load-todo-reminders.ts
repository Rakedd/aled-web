import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { JobApplicationListItem } from '@/domain/job-application'
import { addParisCalendarDays } from '@/domain/paris-time'
import type { ProfileSettings } from '@/domain/profile-settings'
import { computeTodoAlerts, type AlertCv, type AlertInterview, type TodoAlert } from '@/domain/todo-alerts'
import { listCvs } from '@/server/actions/cv-actions'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'
import { listAlertSnoozes, listJobApplications } from '@/server/actions/job-application-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'

export type TodoReminders = {
  jobApplications: JobApplicationListItem[]
  profileSettings: ProfileSettings
  upcomingInterviews: InterviewWithJobApplication[]
  alertInterviews: AlertInterview[]
  alerts: TodoAlert[]
}

export const loadTodoReminders = async (
  now: Date,
  interviewsLookaheadDays: number,
): Promise<ActionResult<TodoReminders>> => {
  const [jobApplicationsResult, profileSettingsResult, alertSnoozesResult, upcomingInterviewsResult, cvsResult] =
    await Promise.all([
      listJobApplications(),
      getProfileSettings(),
      listAlertSnoozes(),
      listUpcomingInterviews(now, addParisCalendarDays(now, interviewsLookaheadDays)),
      listCvs(),
    ])
  if (!jobApplicationsResult.ok) return jobApplicationsResult
  if (!profileSettingsResult.ok) return profileSettingsResult
  if (!alertSnoozesResult.ok) return alertSnoozesResult
  if (!upcomingInterviewsResult.ok) return upcomingInterviewsResult

  const alertInterviews = upcomingInterviewsResult.data.map(
    ({ id, jobApplicationId, startsAt, kind }): AlertInterview => ({ id, jobApplicationId, startsAt, kind }),
  )
  const alerts = computeTodoAlerts({
    jobApplications: jobApplicationsResult.data.map((jobApplication) => ({
      ...jobApplication,
      hasEndClient: jobApplication.endClientId !== null,
    })),
    interviews: alertInterviews,
    snoozes: alertSnoozesResult.data,
    cvs: cvsResult.ok
      ? cvsResult.data.map(({ id, label, reviewedAt, currentVersion }): AlertCv => ({
          id,
          label,
          reviewedAt,
          currentVersionUploadedAt: currentVersion?.uploadedAt ?? null,
        }))
      : [],
    now,
    followUpDelayDays: profileSettingsResult.data.followUpDelayDays,
  })
  return {
    ok: true,
    data: {
      jobApplications: jobApplicationsResult.data,
      profileSettings: profileSettingsResult.data,
      upcomingInterviews: upcomingInterviewsResult.data,
      alertInterviews,
      alerts,
    },
  }
}
