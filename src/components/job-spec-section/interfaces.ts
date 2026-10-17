import type { ActionResult } from '@/domain/action-result'
import type { JobSpec, JobSpecSaveOutcome } from '@/domain/job-spec'
import type { StackItem } from '@/domain/types'

export type UploadJobSpecPdf = (
  jobApplicationId: string,
  formData: FormData,
) => Promise<ActionResult<JobSpecSaveOutcome>>

export type SaveJobSpecText = (jobApplicationId: string, text: string) => Promise<ActionResult<JobSpecSaveOutcome>>

export type ConfirmJobSpecStack = (jobApplicationId: string, stack: StackItem[]) => Promise<ActionResult<null>>

export type DiscardPendingJobSpecStack = (jobApplicationId: string) => Promise<ActionResult<null>>

export type JobSpecSectionControllerParameters = {
  jobApplicationId: string
  jobSpec: JobSpec | null
  uploadJobSpecPdf: UploadJobSpecPdf
  saveJobSpecText: SaveJobSpecText
  confirmJobSpecStack: ConfirmJobSpecStack
  discardPendingJobSpecStack: DiscardPendingJobSpecStack
  hasAnthropicApiKey: boolean
  onDataChanged: () => void
}

export type JobSpecSectionProps = Omit<JobSpecSectionControllerParameters, 'onDataChanged'>
