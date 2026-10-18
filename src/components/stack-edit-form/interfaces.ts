import type { JobApplicationOverview, UpdateJobApplication } from '@/domain/job-application'
import type { StackItem } from '@/domain/types'

export type StackEditFormValues = {
  stack: StackItem[]
}

export type StackEditFormControllerParameters = {
  jobApplication: JobApplicationOverview
  updateJobApplication: UpdateJobApplication
  onDataChanged: () => void
  onClose: () => void
}

export type StackEditFormProps = StackEditFormControllerParameters
