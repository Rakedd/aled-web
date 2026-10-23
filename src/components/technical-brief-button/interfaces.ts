import type { BriefLanguage } from '@/domain/interview-preparation'
import type { GenerateTechnicalBrief, GetTechnicalBriefView } from '@/components/technical-brief-section/interfaces'

export type TechnicalBriefButtonControllerParameters = {
  jobApplicationId: string
  language: BriefLanguage
  hasAnthropicApiKey: boolean
  getTechnicalBriefView: GetTechnicalBriefView
  generateTechnicalBrief: GenerateTechnicalBrief
}

export type TechnicalBriefButtonProps = TechnicalBriefButtonControllerParameters
