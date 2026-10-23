import type { TransientOutcome } from '@/components/technical-brief-button/interfaces'
import type { TechnicalBriefView } from '@/domain/technical-brief'

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
