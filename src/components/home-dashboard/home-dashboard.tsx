'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OpportunityCard } from '@/components/opportunity-card'
import { TodoBanner } from '@/components/todo-banner'
import { buttonVariants } from '@/components/ui/button'
import { INTERVIEW_KIND_LABELS } from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
import { CALENDAR_ROUTE, JOB_APPLICATIONS_ROUTE, OPPORTUNITIES_ROUTE } from '@/domain/routes'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { HomeDashboardProps } from './interfaces'

const MAXIMUM_VISIBLE_ALERTS = 5
const MAXIMUM_VISIBLE_INTERVIEWS = 3

const SHORTCUTS = [
  { label: 'Voir mes candidatures', href: JOB_APPLICATIONS_ROUTE },
  { label: 'Voir mon calendrier', href: CALENDAR_ROUTE },
  { label: 'Voir mes opportunités', href: OPPORTUNITIES_ROUTE },
]

export const HomeDashboard = ({
  firstName,
  now,
  initialAlerts,
  jobApplicationSummaries,
  alertInterviews,
  upcomingInterviews,
  highlightedOpportunities,
  highlightedOpportunitiesErrorMessage,
  snoozeAlert,
  changeJobApplicationStatus,
  applyToOpportunity,
}: HomeDashboardProps) => {
  const router = useRouter()
  const { opportunities, pendingOpportunityId, errorMessage, applyTo } = useController({
    highlightedOpportunities,
    applyToOpportunity,
    onDataChanged: router.refresh,
  })
  const nextInterviews = upcomingInterviews.slice(0, MAXIMUM_VISIBLE_INTERVIEWS)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-2xl font-semibold">{firstName === '' ? 'Bonjour' : `Bonjour ${firstName}`}</h1>
      <nav aria-label="Raccourcis" className="flex flex-wrap gap-2">
        {SHORTCUTS.map(({ label, href }) => (
          <Link key={href} href={href} className={cn(buttonVariants({ variant: 'outline' }))}>
            {label}
          </Link>
        ))}
      </nav>
      <TodoBanner
        initialAlerts={initialAlerts}
        snoozeAlert={snoozeAlert}
        changeJobApplicationStatus={changeJobApplicationStatus}
        jobApplicationSummaries={jobApplicationSummaries}
        interviews={alertInterviews}
        now={now}
        maximumVisibleAlerts={MAXIMUM_VISIBLE_ALERTS}
        seeAllHref={JOB_APPLICATIONS_ROUTE}
      />
      <section aria-labelledby="home-interviews-title" className="flex flex-col gap-3">
        <h2 id="home-interviews-title" className="text-lg font-semibold">
          Prochains entretiens
        </h2>
        {nextInterviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun entretien prévu.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {nextInterviews.map((interview) => (
              <li key={interview.id}>
                <Link href={`${JOB_APPLICATIONS_ROUTE}/${interview.jobApplicationId}`} className="text-sm hover:underline focus-visible:underline">
                  {formatParisInterviewDateTime(interview.startsAt)} · {INTERVIEW_KIND_LABELS[interview.kind]} · {interview.jobApplicationTitle}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="home-opportunities-title" className="flex flex-col gap-3">
        <h2 id="home-opportunities-title" className="text-lg font-semibold">
          Missions à ne pas manquer
        </h2>
        {highlightedOpportunitiesErrorMessage !== null && (
          <p role="alert" className="text-sm text-destructive">
            {highlightedOpportunitiesErrorMessage}
          </p>
        )}
        {errorMessage !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {opportunities.length === 0 ? (
          highlightedOpportunitiesErrorMessage === null && (
            <p className="text-sm text-muted-foreground">Pas de nouvelle mission intéressante depuis 48 h.</p>
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id}>
                <OpportunityCard
                  opportunity={opportunity}
                  tab="to_process"
                  isCompact
                  isNew={false}
                  isPending={pendingOpportunityId === opportunity.id}
                  now={now}
                  onApply={(selectedOpportunity) => void applyTo(selectedOpportunity)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
