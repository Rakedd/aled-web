import type { ExtractSkillsFromCv } from '@/components/cv-skills-extractor/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { CvOption } from '@/domain/cv-library'
import type { OpportunityFilters } from '@/domain/opportunity-filters'

export type SaveOpportunityFilters = (filters: OpportunityFilters) => Promise<ActionResult<OpportunityFilters>>

export type KeywordListField =
  'includeKeywords' | 'alwaysExcludeKeywords' | 'rescuableExcludeKeywords' | 'rescueKeywords'

export type RateFloorField = 'rateFloorFullRemote' | 'rateFloorHybrid' | 'rateFloorOnsite'

export type RateFloorTexts = Record<RateFloorField, string>

export type RateFloorErrors = Partial<Record<RateFloorField, string>>

export type OpportunityFiltersFormControllerParameters = {
  initialFilters: OpportunityFilters
  saveOpportunityFilters: SaveOpportunityFilters
  onDataChanged: () => void
}

export type OpportunityFiltersFormProps = Omit<OpportunityFiltersFormControllerParameters, 'onDataChanged'> & {
  knownRegions: string[]
  cvOptions: CvOption[]
  cvLibraryErrorMessage: string | null
  hasAnthropicApiKey: boolean
  extractSkillsFromCv: ExtractSkillsFromCv
}
