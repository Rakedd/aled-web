import type { Metadata } from 'next'
import { HomeDashboard } from '@/components/home-dashboard'
import { ProfessionalStatusCard } from '@/components/professional-status-card'
import { PasswordUpdatedBanner } from '@/components/password-updated-banner'
import { countActiveJobApplications } from '@/domain/job-application-status'
import { PASSWORD_UPDATED_SEARCH_PARAMETER, PASSWORD_UPDATED_SEARCH_VALUE } from '@/domain/routes'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { confirmCvStillGood } from '@/server/actions/cv-actions'
import { addActivityLogEntry, changeJobApplicationStatus, snoozeAlert } from '@/server/actions/job-application-actions'
import { applyToOpportunity, countOpportunitiesToProcess, listHighlightedOpportunities } from '@/server/actions/opportunity-actions'
import { saveProfessionalStatus } from '@/server/actions/settings-actions'
import { loadTodoReminders } from '@/server/todo-reminders/load-todo-reminders'

export const metadata: Metadata = { title: 'Accueil · Aled' }

export const maxDuration = 60

const UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS = 90

const PAGE_LOAD_FAILURE_MESSAGE = 'Impossible de charger ton accueil.'

const HOME_TITLE_ELEMENT_ID = 'home-dashboard-title'

const HomePage = async ({ searchParams }: PageProps<'/'>) => {
  const searchParameters = await searchParams
  const passwordUpdatedBanner = (
    <PasswordUpdatedBanner
      isPasswordUpdated={searchParameters[PASSWORD_UPDATED_SEARCH_PARAMETER] === PASSWORD_UPDATED_SEARCH_VALUE}
    />
  )
  const now = new Date()
  const [todoRemindersResult, highlightedOpportunitiesResult, opportunitiesToProcessCountResult] = await Promise.all([
    loadTodoReminders(now, UPCOMING_INTERVIEWS_LOOKAHEAD_DAYS),
    listHighlightedOpportunities(),
    countOpportunitiesToProcess(),
  ])

  if (!todoRemindersResult.ok) {
    return (
      <>
        {passwordUpdatedBanner}
        <div className="flex min-w-0 flex-col gap-6">
          <h1 className={PAGE_TITLE_CLASS_NAME}>Bonjour</h1>
          <p role="alert" className="text-sm text-destructive">
            {todoRemindersResult.errorMessage || PAGE_LOAD_FAILURE_MESSAGE}
          </p>
        </div>
      </>
    )
  }

  const { jobApplications, profileSettings, upcomingInterviews, alertInterviews, alerts } = todoRemindersResult.data

  return (
    <>
      {passwordUpdatedBanner}
      <div className="flex min-w-0 flex-col gap-5">
        {profileSettings.professionalStatus === null && (
          <ProfessionalStatusCard
            saveProfessionalStatus={saveProfessionalStatus}
            answeredFocusTargetId={HOME_TITLE_ELEMENT_ID}
          />
        )}
        <HomeDashboard
          firstName={profileSettings.firstName}
          titleElementId={HOME_TITLE_ELEMENT_ID}
          now={now}
          initialAlerts={alerts}
          jobApplicationSummaries={jobApplications.map(({ id, status, contactName, intermediaryName }) => ({
            id,
            status,
            contactName,
            intermediaryName,
          }))}
          alertInterviews={alertInterviews}
          upcomingInterviews={upcomingInterviews}
          highlightedOpportunities={highlightedOpportunitiesResult.ok ? highlightedOpportunitiesResult.data.opportunities : []}
          highlightedOpportunitiesErrorMessage={highlightedOpportunitiesResult.ok ? null : highlightedOpportunitiesResult.errorMessage}
          activeJobApplicationCount={countActiveJobApplications(jobApplications)}
          opportunitiesToProcessCount={opportunitiesToProcessCountResult.ok ? opportunitiesToProcessCountResult.data : 0}
          recentOpportunityCount={highlightedOpportunitiesResult.ok ? highlightedOpportunitiesResult.data.recentOpportunityCount : 0}
          snoozeAlert={snoozeAlert}
          confirmCvStillGood={confirmCvStillGood}
          changeJobApplicationStatus={changeJobApplicationStatus}
          hasAnthropicApiKey={profileSettings.anthropicApiKeyLastFour !== null}
          addActivityLogEntry={addActivityLogEntry}
          applyToOpportunity={applyToOpportunity}
        />
      </div>
    </>
  )
}

export default HomePage
