import type { IntermediaryListItem } from '@/domain/contacts'
import type { UpdateIntermediaryKind } from '@/components/header-edit-form/interfaces'

export type IntermediaryHeaderControllerParameters = {
  intermediaryId: string
  updateIntermediaryKind: UpdateIntermediaryKind
  onDataChanged: () => void
}

export type IntermediaryHeaderProps = {
  intermediary: IntermediaryListItem
  updateIntermediaryKind: UpdateIntermediaryKind
}
