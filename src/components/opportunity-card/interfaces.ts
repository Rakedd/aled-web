import type { OpportunityListItem, OpportunityTab } from '@/domain/opportunities'
import type { OpportunityMatch } from '@/domain/opportunity-match'

export type OpportunitySkillChip = { name: string; isShared: boolean }

export type OpportunitySkillLine = {
  match: OpportunityMatch | null
  visibleSkills: OpportunitySkillChip[]
  hiddenSkillCount: number
}

type OpportunityCardBaseProps = {
  opportunity: OpportunityListItem
  mySkills?: string[]
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
