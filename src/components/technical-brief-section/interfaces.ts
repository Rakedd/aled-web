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

export type TechnicalBriefSectionProps = {
  jobApplicationId: string
  hasAnthropicApiKey: boolean
  view: TechnicalBriefView | null
  isLoading: boolean
  isGenerating: boolean
  errorMessage: string | null
  transientOutcome: TransientOutcome | null
  generate: () => Promise<void>
}
