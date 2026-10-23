import type { ReactNode } from 'react'
import type { FollowUpMessageButtonProps } from '@/components/follow-up-message-button/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import type { SnoozeDurationInDays } from '@/domain/alert-snoozes'
import type { AlertInterview, TodoAlert } from '@/domain/todo-alerts'
import type { AlertKind } from '@/domain/types'

export type SnoozeAlert = (
  jobApplicationId: string,
  alertKind: AlertKind,
  days: SnoozeDurationInDays,
) => Promise<ActionResult<null>>

export type ConfirmCvStillGood = (cvId: string) => Promise<ActionResult<null>>

export type ChangeJobApplicationStatus = (
  jobApplicationId: string,
  newStatus: JobApplicationStatus,
) => Promise<ActionResult<null>>

export type TodoBannerJobApplicationSummary = Pick<
  JobApplicationListItem,
  'id' | 'status' | 'contactName' | 'intermediaryName'
>

export type TodoBannerControllerParameters = {
  initialAlerts: TodoAlert[]
  snoozeAlert: SnoozeAlert
  confirmCvStillGood: ConfirmCvStillGood
  changeJobApplicationStatus: ChangeJobApplicationStatus
  onDataChanged: () => void
}

export type TodoBannerProps = Omit<TodoBannerControllerParameters, 'onDataChanged'> &
  Pick<FollowUpMessageButtonProps, 'hasAnthropicApiKey' | 'addActivityLogEntry'> & {
  title: string
  jobApplicationSummaries: TodoBannerJobApplicationSummary[]
  interviews: AlertInterview[]
  now: Date
  children?: ReactNode
}
