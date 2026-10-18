import type { Metadata } from 'next'
import { HomeDashboard } from '@/components/home-dashboard'
import { addParisCalendarDays } from '@/domain/paris-time'
import { computeTodoAlerts, type AlertInterview } from '@/domain/todo-alerts'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'
import {
  changeJobApplicationStatus,
  listAlertSnoozes,
  listJobApplications,
  snoozeAlert,
} from '@/server/actions/job-application-actions'
import { applyToOpportunity, listHighlightedOpportunities } from '@/server/actions/opportunity-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Accueil · Freeclutch' }

export const maxDuration = 60

const UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS = 90

const HomePage = async () => {
  const now = new Date()
  const [
    jobApplicationsResult,
    profileSettingsResult,
    alertSnoozesResult,
    upcomingInterviewsResult,
    highlightedOpportunitiesResult,
  ] = await Promise.all([
    listJobApplications(),
    getProfileSettings(),
    listAlertSnoozes(),
    listUpcomingInterviews(now, addParisCalendarDays(now, UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS)),
    listHighlightedOpportunities(),
  ])

  if (!jobApplicationsResult.ok || !profileSettingsResult.ok || !alertSnoozesResult.ok || !upcomingInterviewsResult.ok) {
    const failedResult = [jobApplicationsResult, profileSettingsResult, alertSnoozesResult, upcomingInterviewsResult].find(
      (result) => !result.ok,
    )
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="text-2xl font-semibold">Bonjour</h1>
        <p role="alert" className="text-sm text-destructive">
          {failedResult && !failedResult.ok ? failedResult.errorMessage : 'Impossible de charger ton accueil.'}
        </p>
      </div>
    )
  }

  const alertInterviews: AlertInterview[] = upcomingInterviewsResult.data.map(
    ({ id, jobApplicationId, startsAt, kind }) => ({ id, jobApplicationId, startsAt, kind }),
  )
  const jobApplications = jobApplicationsResult.data
  const initialAlerts = computeTodoAlerts({
    jobApplications: jobApplications.map((jobApplication) => ({
      ...jobApplication,
      hasEndClient: jobApplication.endClientId !== null,
    })),
    interviews: alertInterviews,
    snoozes: alertSnoozesResult.data,
    now,
    followUpDelayDays: profileSettingsResult.data.followUpDelayDays,
  })

  return (
    <HomeDashboard
      firstName={profileSettingsResult.data.firstName}
      now={now}
      initialAlerts={initialAlerts}
      jobApplicationSummaries={jobApplications.map(({ id, status, contactName, intermediaryName }) => ({
        id,
        status,
        contactName,
        intermediaryName,
      }))}
      alertInterviews={alertInterviews}
      upcomingInterviews={upcomingInterviewsResult.data}
      highlightedOpportunities={highlightedOpportunitiesResult.ok ? highlightedOpportunitiesResult.data : []}
      highlightedOpportunitiesErrorMessage={highlightedOpportunitiesResult.ok ? null : highlightedOpportunitiesResult.errorMessage}
      snoozeAlert={snoozeAlert}
      changeJobApplicationStatus={changeJobApplicationStatus}
      applyToOpportunity={applyToOpportunity}
    />
  )
}

export default HomePage
