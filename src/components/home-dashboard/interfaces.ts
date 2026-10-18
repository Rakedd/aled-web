import type { ChangeJobApplicationStatus, SnoozeAlert, TodoBannerJobApplicationSummary } from '@/components/todo-banner/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { OpportunityListItem } from '@/domain/opportunities'
import type { AlertInterview, TodoAlert } from '@/domain/todo-alerts'

export type ApplyToOpportunity = (opportunityId: string) => Promise<ActionResult<{ jobApplicationId: string }>>

export type HomeDashboardControllerParameters = {
  highlightedOpportunities: OpportunityListItem[]
  applyToOpportunity: ApplyToOpportunity
  onDataChanged: () => void
}

export type HomeDashboardProps = Omit<HomeDashboardControllerParameters, 'onDataChanged'> & {
  firstName: string
  now: Date
  initialAlerts: TodoAlert[]
  jobApplicationSummaries: TodoBannerJobApplicationSummary[]
  alertInterviews: AlertInterview[]
  upcomingInterviews: InterviewWithJobApplication[]
  highlightedOpportunitiesErrorMessage: string | null
  snoozeAlert: SnoozeAlert
  changeJobApplicationStatus: ChangeJobApplicationStatus
}
