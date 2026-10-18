import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import type { UpdateEndClientNotes } from '@/components/interview-preparation-modal/interfaces'

export type GetInterviewPreparation = (
  jobApplicationId: string,
  language: BriefLanguage,
) => Promise<ActionResult<InterviewPreparation>>

export type GenerateInterviewPreparation = (
  jobApplicationId: string,
  language: BriefLanguage,
  regenerate: boolean,
) => Promise<ActionResult<InterviewPreparation>>

export type InterviewPreparationButtonControllerParameters = {
  jobApplicationId: string
  initialPreparation: InterviewPreparation
  getInterviewPreparation: GetInterviewPreparation
  generateInterviewPreparation: GenerateInterviewPreparation
  hasAnthropicApiKey: boolean
  onDataChanged: () => void
}

export type InterviewPreparationButtonProps = Omit<InterviewPreparationButtonControllerParameters, 'onDataChanged'> & {
  updateEndClientNotes: UpdateEndClientNotes
}
