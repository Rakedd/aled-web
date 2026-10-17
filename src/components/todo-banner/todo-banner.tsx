'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SNOOZE_DURATIONS_IN_DAYS, isSnoozableAlertKind } from '@/domain/alert-snoozes'
import { useController } from './controller'
import { formatTodoAlertMessage, getTodoAlertKey } from './format-todo-alert'
import type { TodoBannerProps } from './interfaces'

export const TodoBanner = ({
  initialAlerts,
  snoozeAlert,
  changeJobApplicationStatus,
  jobApplicationSummaries,
  interviews,
  now,
}: TodoBannerProps) => {
  const { alerts, errorMessage, snooze, closeAsNoNews } = useController({
    initialAlerts,
    snoozeAlert,
    changeJobApplicationStatus,
  })

  return (
    <section aria-labelledby="todo-banner-title" className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <h2 id="todo-banner-title" className="text-lg font-semibold">
        À faire
      </h2>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien d&apos;urgent aujourd&apos;hui.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => {
            const summary = jobApplicationSummaries.find(({ id }) => id === alert.jobApplicationId)
            return (
              <li key={getTodoAlertKey(alert)} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Link
                  href={`/candidatures/${alert.jobApplicationId}`}
                  className="min-w-0 flex-1 text-sm hover:underline focus-visible:underline"
                >
                  {formatTodoAlertMessage(alert, summary, interviews, now)}
                </Link>
                {isSnoozableAlertKind(alert.kind) && (
                  <div className="flex flex-wrap gap-2">
                    {SNOOZE_DURATIONS_IN_DAYS.map((days) => (
                      <Button key={days} type="button" size="sm" variant="outline" onClick={() => void snooze(alert, days)}>
                        Reporter {days} j
                      </Button>
                    ))}
                    {alert.kind === 'no_news_suggestion' && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => void closeAsNoNews(alert)}>
                        Clore
                      </Button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
