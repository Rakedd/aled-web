import type { ActionResult } from '@/domain/action-result'
import type {
  ApplyToOpportunity,
  OpportunityListing,
  OpportunityListingCursor,
  OpportunityTab,
} from '@/domain/opportunities'

export type ListOpportunities = (
  tab: OpportunityTab,
  cursor: OpportunityListingCursor | null,
) => Promise<ActionResult<OpportunityListing>>
export type DecideOnOpportunity = (opportunityId: string) => Promise<ActionResult<null>>
export type MarkOpportunitiesViewed = () => Promise<ActionResult<null>>

export type OpportunitiesBoardControllerParameters = {
  initialTab: OpportunityTab
  initialListing: OpportunityListing
  listOpportunities: ListOpportunities
  applyToOpportunity: ApplyToOpportunity
  dismissOpportunity: DecideOnOpportunity
  restoreOpportunity: DecideOnOpportunity
  markOpportunitiesViewed: MarkOpportunitiesViewed
  onDataChanged: () => void
  onTabChanged: (tab: OpportunityTab) => void
}

export type OpportunitiesBoardProps = Omit<OpportunitiesBoardControllerParameters, 'onDataChanged' | 'onTabChanged'> & {
  hasActiveFilters: boolean
  now: Date
}
