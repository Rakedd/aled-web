import Link from 'next/link'
import { ACTIVITY_KIND_LABELS } from '@/domain/activity-log'
import { formatParisDateTime } from '@/domain/paris-time'
import { jobApplicationRoute } from '@/domain/routes'
import { ExchangeForm } from './exchange-form'
import type { ExchangesSectionProps } from './interfaces'

export const ExchangesSection = ({ exchanges, showsContactName, exchangeForm }: ExchangesSectionProps) => (
  <div className="flex min-w-0 flex-col gap-6">
    {exchanges.length === 0 ? (
      <p className="text-sm text-muted-foreground">Aucun échange pour l&apos;instant.</p>
    ) : (
      <ol className="flex flex-col">
        {exchanges.map((exchange) => (
          <li key={exchange.id} className="group flex gap-4">
            <span aria-hidden="true" className="flex flex-col items-center pt-1">
              <span className="size-3.5 shrink-0 rounded-full bg-accent-text" />
              <span className="w-0.5 grow bg-hairline group-last:hidden" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 pb-5 group-last:pb-0">
              <span className="text-xs font-semibold text-ink-muted">
                {formatParisDateTime(exchange.occurredAt)} · {ACTIVITY_KIND_LABELS[exchange.kind]}
                {showsContactName && exchange.contactName !== null && ` · ${exchange.contactName}`}
              </span>
              <span className="text-sm break-words">{exchange.summary}</span>
              {exchange.jobApplicationId !== null && exchange.jobApplicationTitle !== null && (
                <Link
                  href={jobApplicationRoute(exchange.jobApplicationId)}
                  className="text-sm break-words text-accent-text underline underline-offset-2"
                >
                  {exchange.jobApplicationTitle}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    )}
    {exchangeForm !== null && <ExchangeForm {...exchangeForm} />}
  </div>
)
