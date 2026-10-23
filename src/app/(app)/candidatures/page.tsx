import type { Metadata } from 'next'
import Link from 'next/link'
import { JobApplicationDeletedNotice } from '@/components/job-application-deleted-notice'
import { JobApplicationsTable } from '@/components/job-applications-table'
import { TodoBanner } from '@/components/todo-banner'
import { buttonVariants } from '@/components/ui/button'
import { JOB_APPLICATION_DELETED_SEARCH_PARAMETER, NEW_JOB_APPLICATION_ROUTE } from '@/domain/routes'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { confirmCvStillGood } from '@/server/actions/cv-actions'
import { addActivityLogEntry, changeJobApplicationStatus, snoozeAlert } from '@/server/actions/job-application-actions'
import { loadTodoReminders } from '@/server/todo-reminders/load-todo-reminders'

export const metadata: Metadata = { title: 'Mes candidatures · Aled' }

const PAGE_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes candidatures.'
const UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS = 8

const JobApplicationsPage = async ({ searchParams }: PageProps<'/candidatures'>) => {
  const isJobApplicationDeleted = (await searchParams)[JOB_APPLICATION_DELETED_SEARCH_PARAMETER] === '1'
  const now = new Date()
  const todoRemindersResult = await loadTodoReminders(now, UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS)

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className={PAGE_TITLE_CLASS_NAME}>Mes candidatures</h1>
      <Link href={NEW_JOB_APPLICATION_ROUTE} className={buttonVariants()}>
        + Nouvelle candidature
      </Link>
    </div>
  )

  const deletionNotice = <JobApplicationDeletedNotice isJobApplicationDeleted={isJobApplicationDeleted} />

  if (!todoRemindersResult.ok) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {header}
        {deletionNotice}
        <p role="alert" className="text-sm text-destructive">
          {todoRemindersResult.errorMessage || PAGE_LOAD_FAILURE_MESSAGE}
        </p>
      </div>
    )
  }

  const { jobApplications, profileSettings, alertInterviews, alerts } = todoRemindersResult.data

  const todoDetails = (
    <TodoBanner
      title="Tous les rappels"
      initialAlerts={alerts}
      snoozeAlert={snoozeAlert}
      confirmCvStillGood={confirmCvStillGood}
      changeJobApplicationStatus={changeJobApplicationStatus}
      hasAnthropicApiKey={profileSettings.anthropicApiKeyLastFour !== null}
      addActivityLogEntry={addActivityLogEntry}
      jobApplicationSummaries={jobApplications.map(({ id, status, contactName, intermediaryName }) => ({
        id,
        status,
        contactName,
        intermediaryName,
      }))}
      interviews={alertInterviews}
      now={now}
    />
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {header}
      {deletionNotice}
      <JobApplicationsTable jobApplications={jobApplications} alerts={alerts} todoDetails={todoDetails} now={now} />
    </div>
  )
}

export default JobApplicationsPage
