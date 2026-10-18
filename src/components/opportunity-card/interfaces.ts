import type { OpportunityListItem, OpportunityTab } from '@/domain/opportunities'

export type OpportunityCardProps = {
  opportunity: OpportunityListItem
  tab: OpportunityTab
  isNew: boolean
  isPending: boolean
  now: Date
  onApply: (opportunity: OpportunityListItem) => void
  onDismiss: (opportunity: OpportunityListItem) => void
  onRestore: (opportunity: OpportunityListItem) => void
}
