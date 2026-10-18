import type { Metadata } from 'next'
import Link from 'next/link'
import { JobApplicationDeletedNotice } from '@/components/job-application-deleted-notice'
import { JobApplicationsTable } from '@/components/job-applications-table'
import { TodoBanner } from '@/components/todo-banner'
import { buttonVariants } from '@/components/ui/button'
import { addParisCalendarDays } from '@/domain/paris-time'
import { JOB_APPLICATION_DELETED_SEARCH_PARAMETER } from '@/domain/routes'
import { computeTodoAlerts, type AlertInterview } from '@/domain/todo-alerts'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'
import {
  changeJobApplicationStatus,
  listAlertSnoozes,
  listJobApplications,
  snoozeAlert,
} from '@/server/actions/job-application-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Mes candidatures · Freeclutch' }

const PAGE_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes candidatures.'
const UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS = 8

const JobApplicationsPage = async ({ searchParams }: PageProps<'/candidatures'>) => {
  const isJobApplicationDeleted = (await searchParams)[JOB_APPLICATION_DELETED_SEARCH_PARAMETER] === '1'
  const now = new Date()
  const [jobApplicationsResult, profileSettingsResult, alertSnoozesResult, upcomingInterviewsResult] =
    await Promise.all([
      listJobApplications(),
      getProfileSettings(),
      listAlertSnoozes(),
      listUpcomingInterviews(now, addParisCalendarDays(now, UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS)),
    ])

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Mes candidatures</h1>
      <Link href="/candidatures/new" className={buttonVariants()}>
        Nouvelle candidature
      </Link>
    </div>
  )

  const deletionNotice = <JobApplicationDeletedNotice isJobApplicationDeleted={isJobApplicationDeleted} />

  if (
    !jobApplicationsResult.ok ||
    !profileSettingsResult.ok ||
    !alertSnoozesResult.ok ||
    !upcomingInterviewsResult.ok
  ) {
    const failedResult = [
      jobApplicationsResult,
      profileSettingsResult,
      alertSnoozesResult,
      upcomingInterviewsResult,
    ].find((result) => !result.ok)
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {header}
        {deletionNotice}
        <p role="alert" className="text-sm text-destructive">
          {failedResult && !failedResult.ok ? failedResult.errorMessage : PAGE_LOAD_FAILURE_MESSAGE}
        </p>
      </div>
    )
  }

  const interviews: AlertInterview[] = upcomingInterviewsResult.data.map(({ id, jobApplicationId, startsAt, kind }) => ({
    id,
    jobApplicationId,
    startsAt,
    kind,
  }))
  const jobApplications = jobApplicationsResult.data
  const initialAlerts = computeTodoAlerts({
    jobApplications: jobApplications.map((jobApplication) => ({
      ...jobApplication,
      hasEndClient: jobApplication.endClientId !== null,
    })),
    interviews,
    snoozes: alertSnoozesResult.data,
    now,
    followUpDelayDays: profileSettingsResult.data.followUpDelayDays,
  })

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {header}
      {deletionNotice}
      <TodoBanner
        initialAlerts={initialAlerts}
        snoozeAlert={snoozeAlert}
        changeJobApplicationStatus={changeJobApplicationStatus}
        jobApplicationSummaries={jobApplications.map(({ id, status, contactName, intermediaryName }) => ({
          id,
          status,
          contactName,
          intermediaryName,
        }))}
        interviews={interviews}
        now={now}
      />
      <JobApplicationsTable jobApplications={jobApplications} now={now} />
    </div>
  )
}

export default JobApplicationsPage
