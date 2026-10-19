import { useId } from 'react'
import { PillToggle } from '@/components/pill-toggle'
import { TODO_ALERT_KIND_TONES, formatTodoAlertKindCount } from '@/components/todo-banner/format-todo-alert'
import { Button } from '@/components/ui/button'
import type { TodoSummaryBarProps } from './interfaces'

export const TodoSummaryBar = ({
  kindCounts,
  selectedAlertKind,
  onToggleAlertKind,
  isExpanded,
  onToggleExpanded,
  detailsId,
}: TodoSummaryBarProps) => {
  const titleId = useId()
  const totalAlertCount = kindCounts.reduce((total, { count }) => total + count, 0)

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-card px-6 py-3"
    >
      {kindCounts.length === 0 ? (
        <>
          <h2 id={titleId} className="font-heading text-base font-extrabold">
            À faire
          </h2>
          <p className="text-sm text-ink-secondary">Rien à faire pour l&apos;instant</p>
        </>
      ) : (
        <>
          <h2 id={titleId} className="font-heading text-base font-extrabold">
            À faire · {totalAlertCount}
          </h2>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {kindCounts.map(({ kind, count }) => (
              <PillToggle
                key={kind}
                tone={TODO_ALERT_KIND_TONES[kind]}
                isPressed={selectedAlertKind === kind}
                onPressedChange={() => onToggleAlertKind(kind)}
              >
                {formatTodoAlertKindCount(kind, count)}
              </PillToggle>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" aria-expanded={isExpanded} aria-controls={detailsId} onClick={onToggleExpanded}>
            {isExpanded ? 'Tout replier' : 'Tout déplier'}
          </Button>
        </>
      )}
    </section>
  )
}
