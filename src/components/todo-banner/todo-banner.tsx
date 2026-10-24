'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef } from 'react'
import { FollowUpMessageButton } from '@/components/follow-up-message-button'
import { Pill } from '@/components/pill'
import { Button, buttonVariants } from '@/components/ui/button'
import { SNOOZE_DURATIONS_IN_DAYS, isSnoozableAlertKind } from '@/domain/alert-snoozes'
import { isJobApplicationTodoAlert, type TodoAlertKind } from '@/domain/todo-alerts'
import { cn } from '@/lib/utils'
import { CV_LIBRARY_ROUTE, jobApplicationRoute } from '@/domain/routes'
import { useController } from './controller'
import {
  TODO_ALERT_CARD_TAG_TONES,
  TODO_ALERT_KIND_TAG_LABELS,
  formatTodoAlertMessage,
  getTodoAlertKey,
} from './format-todo-alert'
import type { TodoBannerProps } from './interfaces'

const TODO_ALERT_CARD_CLASS_NAMES: Record<TodoAlertKind, string> = {
  follow_up_due: 'bg-peach-tint',
  job_spec_missing: 'bg-lilac-tint',
  end_client_unknown: 'bg-lilac-tint',
  no_news_suggestion: 'bg-clay-tint',
  upcoming_interview: 'bg-forest-soft',
  cv_outdated: 'bg-peach-tint',
}

export const TodoBanner = ({
  title,
  initialAlerts,
  snoozeAlert,
  confirmCvStillGood,
  changeJobApplicationStatus,
  hasAnthropicApiKey,
  addActivityLogEntry,
  jobApplicationSummaries,
  interviews,
  now,
  children,
}: TodoBannerProps) => {
  const router = useRouter()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const {
    alerts,
    errorMessage,
    isAlertPending,
    snooze,
    confirmStillGood,
    closeAsNoNews,
    markFollowUpSent,
    followUpSentAnnouncement,
  } = useController({
    initialAlerts,
    snoozeAlert,
    confirmCvStillGood,
    changeJobApplicationStatus,
    onDataChanged: router.refresh,
  })

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6">
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-heading text-xl font-extrabold outline-none">
        {title}
      </h2>
      <p role="status" className="sr-only">
        {followUpSentAnnouncement}
      </p>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {alerts.length === 0 ? (
        <p className="text-sm text-ink-secondary">Rien d&apos;urgent aujourd&apos;hui.</p>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {alerts.map((alert) => {
            if (!isJobApplicationTodoAlert(alert)) {
              return (
                <li
                  key={getTodoAlertKey(alert)}
                  className={cn('flex min-w-0 flex-[1_1_14rem] flex-col gap-3 rounded-xl p-3.5', TODO_ALERT_CARD_CLASS_NAMES[alert.kind])}
                >
                  <Link
                    href={CV_LIBRARY_ROUTE}
                    className="flex flex-col items-start gap-1.5 text-sm hover:underline focus-visible:underline"
                  >
                    <Pill tone={TODO_ALERT_CARD_TAG_TONES[alert.kind]}>{TODO_ALERT_KIND_TAG_LABELS[alert.kind]}</Pill>
                    {formatTodoAlertMessage(alert, undefined, interviews, now)}
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Link href={CV_LIBRARY_ROUTE} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      Mettre à jour
                    </Link>
                    <Button type="button" size="sm" variant="secondary" disabled={isAlertPending(alert)} onClick={() => void confirmStillGood(alert)}>
                      Il est encore bon
                    </Button>
                  </div>
                </li>
              )
            }
            const summary = jobApplicationSummaries.find(({ id }) => id === alert.jobApplicationId)
            return (
              <li
                key={getTodoAlertKey(alert)}
                className={cn('flex min-w-0 flex-[1_1_14rem] flex-col gap-3 rounded-xl p-3.5', TODO_ALERT_CARD_CLASS_NAMES[alert.kind])}
              >
                <Link
                  href={jobApplicationRoute(alert.jobApplicationId)}
                  className="flex flex-col items-start gap-1.5 text-sm hover:underline focus-visible:underline"
                >
                  <Pill tone={TODO_ALERT_CARD_TAG_TONES[alert.kind]}>{TODO_ALERT_KIND_TAG_LABELS[alert.kind]}</Pill>
                  {formatTodoAlertMessage(alert, summary, interviews, now)}
                </Link>
                {isSnoozableAlertKind(alert.kind) && (
                  <div className="flex flex-wrap gap-2">
                    {alert.kind === 'follow_up_due' && (
                      <FollowUpMessageButton
                        jobApplicationId={alert.jobApplicationId}
                        hasAnthropicApiKey={hasAnthropicApiKey}
                        addActivityLogEntry={addActivityLogEntry}
                        label={{ variant: 'compact', jobApplicationTitle: alert.jobApplicationTitle }}
                        onFollowUpSent={() => markFollowUpSent(alert)}
                        finalFocusRef={titleRef}
                      />
                    )}
                    {SNOOZE_DURATIONS_IN_DAYS.map((days) => (
                      <Button key={days} type="button" size="sm" variant="outline" disabled={isAlertPending(alert)} onClick={() => void snooze(alert, days)}>
                        Reporter {days} j
                      </Button>
                    ))}
                    {alert.kind === 'no_news_suggestion' && (
                      <Button type="button" size="sm" variant="secondary" disabled={isAlertPending(alert)} onClick={() => void closeAsNoNews(alert)}>
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
      {children}
    </section>
  )
}
