import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview } from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'

export type ChangeJobApplicationStatus = (
  jobApplicationId: string,
  newStatus: JobApplicationStatus,
) => Promise<ActionResult<null>>

export type JobApplicationHeaderSummary = Pick<
  JobApplicationOverview,
  | 'id'
  | 'title'
  | 'status'
  | 'intermediaryName'
  | 'contactName'
  | 'endClientLabel'
  | 'source'
  | 'appliedOn'
  | 'lastActivityAt'
>

export type JobApplicationHeaderControllerParameters = {
  jobApplication: JobApplicationHeaderSummary
  changeJobApplicationStatus: ChangeJobApplicationStatus
  now: Date
  onDataChanged: () => void
}

export type JobApplicationHeaderProps = Omit<JobApplicationHeaderControllerParameters, 'onDataChanged'>
