import type { OpportunityListItem, OpportunityTab } from '@/domain/opportunities'

type OpportunityCardBaseProps = {
  opportunity: OpportunityListItem
  tab: OpportunityTab
  isNew: boolean
  isPending: boolean
  now: Date
  onApply: (opportunity: OpportunityListItem) => void
}

type FullOpportunityCardProps = OpportunityCardBaseProps & {
  isCompact?: false
  onDismiss: (opportunity: OpportunityListItem) => void
  onRestore: (opportunity: OpportunityListItem) => void
}

type CompactOpportunityCardProps = OpportunityCardBaseProps & {
  isCompact: true
  onDismiss?: never
  onRestore?: never
}

export type OpportunityCardProps = FullOpportunityCardProps | CompactOpportunityCardProps
