import type { ActionResult } from '@/domain/action-result'
import type { CvOption, SentCv, TailoredCvUploadOutcome } from '@/domain/cv-library'

export type AttachLibraryCvToJobApplication = (jobApplicationId: string, cvId: string) => Promise<ActionResult<null>>

export type UploadTailoredCvForJobApplication = (
  jobApplicationId: string,
  formData: FormData,
) => Promise<ActionResult<TailoredCvUploadOutcome>>

export type DetachSentCvFromJobApplication = (jobApplicationId: string) => Promise<ActionResult<null>>

export type SentCvSource = 'library' | 'tailored'

export type SentCvEditFormProps = {
  jobApplicationId: string
  jobApplicationTitle: string
  sentCv: SentCv | null
  cvOptions: CvOption[]
  attachLibraryCvToJobApplication: AttachLibraryCvToJobApplication
  uploadTailoredCvForJobApplication: UploadTailoredCvForJobApplication
  detachSentCvFromJobApplication: DetachSentCvFromJobApplication
  onDataChanged: () => void
  onClose: () => void
}
