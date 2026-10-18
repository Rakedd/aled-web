import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview } from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'

export type ChangeJobApplicationStatus = (
  jobApplicationId: string,
  newStatus: JobApplicationStatus,
) => Promise<ActionResult<null>>

export type JobApplicationHeaderStatus = Pick<JobApplicationOverview, 'id' | 'status'>

export type JobApplicationHeaderControllerParameters = {
  jobApplication: JobApplicationHeaderStatus
  changeJobApplicationStatus: ChangeJobApplicationStatus
  onDataChanged: () => void
}

export type JobApplicationHeaderProps = Omit<JobApplicationHeaderControllerParameters, 'onDataChanged'>
