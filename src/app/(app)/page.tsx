import type { Metadata } from 'next'
import Link from 'next/link'
import { JobApplicationsTable } from '@/components/job-applications-table'
import { TodoBanner } from '@/components/todo-banner'
import { buttonVariants } from '@/components/ui/button'
import { computeTodoAlerts, type AlertInterview } from '@/domain/todo-alerts'
import {
  changeJobApplicationStatus,
  listAlertSnoozes,
  listJobApplications,
  snoozeAlert,
} from '@/server/actions/job-application-actions'
import { getProfileSettings } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Mes candidatures · Freeclutch' }

const PAGE_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes candidatures.'

const JobApplicationsPage = async () => {
  const [jobApplicationsResult, profileSettingsResult, alertSnoozesResult] = await Promise.all([
    listJobApplications(),
    getProfileSettings(),
    listAlertSnoozes(),
  ])

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Mes candidatures</h1>
      <Link href="/candidatures/new" className={buttonVariants()}>
        Nouvelle candidature
      </Link>
    </div>
  )

  if (!jobApplicationsResult.ok || !profileSettingsResult.ok || !alertSnoozesResult.ok) {
    const failedResult = [jobApplicationsResult, profileSettingsResult, alertSnoozesResult].find(
      (result) => !result.ok,
    )
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-destructive">
          {failedResult && !failedResult.ok ? failedResult.errorMessage : PAGE_LOAD_FAILURE_MESSAGE}
        </p>
      </div>
    )
  }

  const now = new Date()
  const interviews: AlertInterview[] = []
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
