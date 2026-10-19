import type { TodoAlertKindCount } from '@/domain/todo-alerts'
import type { AlertKind } from '@/domain/types'

export type TodoSummaryBarProps = {
  kindCounts: TodoAlertKindCount[]
  selectedAlertKind: AlertKind | null
  onToggleAlertKind: (kind: AlertKind) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  detailsId: string
}
