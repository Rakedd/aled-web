import type { ChangeJobApplicationStatus, ConfirmCvStillGood, SnoozeAlert, TodoBannerJobApplicationSummary } from '@/components/todo-banner/interfaces'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { ApplyToOpportunity, OpportunityListItem } from '@/domain/opportunities'
import type { AlertInterview, TodoAlert } from '@/domain/todo-alerts'

export type AppliedOpportunity = { opportunity: OpportunityListItem; position: number }

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
  activeJobApplicationCount: number
  opportunitiesToProcessCount: number
  recentOpportunityCount: number
  snoozeAlert: SnoozeAlert
  confirmCvStillGood: ConfirmCvStillGood
  changeJobApplicationStatus: ChangeJobApplicationStatus
}
