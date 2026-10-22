import Link from 'next/link'
import { useId } from 'react'
import { PILL_BASE_CLASS_NAME, PILL_TONE_CLASS_NAMES } from '@/components/pill'
import { PillToggle } from '@/components/pill-toggle'
import { TODO_ALERT_KIND_TONES, formatTodoAlertKindCount } from '@/components/todo-banner/format-todo-alert'
import { Button } from '@/components/ui/button'
import { CV_LIBRARY_ROUTE } from '@/domain/routes'
import { cn } from '@/lib/utils'
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
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl bg-card px-6 py-3 sm:rounded-full"
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
          <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:flex-1 sm:basis-auto">
            {kindCounts.map(({ kind, count }) =>
              kind === 'cv_outdated' ? (
                <Link
                  key={kind}
                  href={CV_LIBRARY_ROUTE}
                  data-tone={TODO_ALERT_KIND_TONES[kind]}
                  className={cn(
                    PILL_BASE_CLASS_NAME,
                    PILL_TONE_CLASS_NAMES[TODO_ALERT_KIND_TONES[kind]],
                    'outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40',
                  )}
                >
                  {formatTodoAlertKindCount(kind, count)}
                </Link>
              ) : (
                <PillToggle
                  key={kind}
                  tone={TODO_ALERT_KIND_TONES[kind]}
                  isPressed={selectedAlertKind === kind}
                  onPressedChange={() => onToggleAlertKind(kind)}
                >
                  {formatTodoAlertKindCount(kind, count)}
                </PillToggle>
              ),
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" aria-expanded={isExpanded} aria-controls={detailsId} onClick={onToggleExpanded}>
            {isExpanded ? 'Tout replier' : 'Tout déplier'}
          </Button>
        </>
      )}
    </section>
  )
}
