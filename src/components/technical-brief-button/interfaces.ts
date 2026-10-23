import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { TechnicalBriefGenerationOutcome, TechnicalBriefView } from '@/domain/technical-brief'

export type GetTechnicalBriefView = (
  jobApplicationId: string,
  language: BriefLanguage,
) => Promise<ActionResult<TechnicalBriefView>>

export type GenerateTechnicalBrief = (
  jobApplicationId: string,
  language: BriefLanguage,
) => Promise<ActionResult<TechnicalBriefGenerationOutcome>>

export type TransientOutcome = 'cv_missing_information' | 'cv_unreadable'

export type TechnicalBriefButtonControllerParameters = {
  jobApplicationId: string
  language: BriefLanguage
  hasAnthropicApiKey: boolean
  getTechnicalBriefView: GetTechnicalBriefView
  generateTechnicalBrief: GenerateTechnicalBrief
}

export type TechnicalBriefButtonProps = TechnicalBriefButtonControllerParameters
