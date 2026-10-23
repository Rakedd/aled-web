'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OpportunityCard } from '@/components/opportunity-card'
import { TodoBanner } from '@/components/todo-banner'
import { buttonVariants } from '@/components/ui/button'
import { INTERVIEW_KIND_LABELS, findNextInterview, sortInterviewsByStartsAt } from '@/domain/interviews'
import { pluralizeFrench } from '@/domain/french-plural'
import { buildHomeSummarySentence } from '@/domain/home-summary'
import {
  formatInterviewCountdown,
  formatParisDayBlock,
  formatParisInterviewDateTime,
  formatParisLongDate,
  formatParisTime,
} from '@/domain/paris-time'
import { CALENDAR_ROUTE, JOB_APPLICATIONS_ROUTE, OPPORTUNITIES_ROUTE, jobApplicationRoute } from '@/domain/routes'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { HomeDashboardProps } from './interfaces'

const MAXIMUM_VISIBLE_ALERTS = 5
const FOLLOWING_INTERVIEWS_COUNT = 2

const BENTO_ROW_CLASS_NAME = 'flex flex-col gap-5 md:flex-row md:flex-wrap'
const BENTO_TILE_CLASS_NAME = 'flex min-w-0 flex-col rounded-2xl p-6'
const OUTLINE_LINK_CLASS_NAME = cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'self-start font-bold')
const DAY_BLOCK_CLASS_NAMES = ['bg-lilac text-on-lilac', 'bg-hairline']

export const HomeDashboard = ({
  firstName,
  titleElementId,
  now,
  initialAlerts,
  jobApplicationSummaries,
  alertInterviews,
  upcomingInterviews,
  highlightedOpportunities,
  highlightedOpportunitiesErrorMessage,
  activeJobApplicationCount,
  opportunitiesToProcessCount,
  recentOpportunityCount,
  snoozeAlert,
  confirmCvStillGood,
  changeJobApplicationStatus,
  applyToOpportunity,
}: HomeDashboardProps) => {
  const router = useRouter()
  const { opportunities, pendingOpportunityId, errorMessage, applyTo } = useController({
    highlightedOpportunities,
    applyToOpportunity,
    onDataChanged: router.refresh,
  })
  const trimmedFirstName = firstName.trim()
  const nextInterview = findNextInterview(upcomingInterviews, now)
  const followingInterviews = sortInterviewsByStartsAt(upcomingInterviews)
    .filter(({ startsAt }) => startsAt.getTime() > now.getTime())
    .slice(1, 1 + FOLLOWING_INTERVIEWS_COUNT)
  const summarySentence = buildHomeSummarySentence({
    reminderCount: initialAlerts.length,
    nextInterview,
    recentOpportunityCount,
    now,
  })

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={BENTO_ROW_CLASS_NAME}>
        <section
          aria-label="Bienvenue"
          className={cn(BENTO_TILE_CLASS_NAME, 'min-h-52 justify-between gap-6 bg-brand-tile p-8 text-on-brand-tile-secondary md:flex-[2_1_32rem]')}
        >
          <p className="text-sm font-semibold">{formatParisLongDate(now)}</p>
          <div className="flex flex-col gap-2.5">
            <h1
              id={titleElementId}
              tabIndex={-1}
              className="font-heading text-4xl leading-none font-extrabold tracking-tight outline-none md:text-6xl"
            >
              {trimmedFirstName === '' ? 'Bonjour' : `Bonjour ${trimmedFirstName}`}
            </h1>
            <p className="text-lg">{summarySentence}</p>
          </div>
        </section>
        <section
          aria-labelledby="home-next-interview-title"
          className={cn(BENTO_TILE_CLASS_NAME, 'gap-2.5 bg-peach text-on-peach md:flex-[1_1_18rem]')}
        >
          <h2 id="home-next-interview-title" className="text-sm font-bold">
            {nextInterview === null ? 'Prochain entretien' : `Prochain entretien · ${formatInterviewCountdown(nextInterview.startsAt, now)}`}
          </h2>
          {nextInterview === null ? (
            <p className="text-base">Aucun entretien prévu.</p>
          ) : (
            <>
              <p className="font-heading text-4xl leading-none font-extrabold tracking-tight">
                {formatParisInterviewDateTime(nextInterview.startsAt)}
              </p>
              <p className="text-base">
                <strong>{INTERVIEW_KIND_LABELS[nextInterview.kind]}</strong>
                <br />
                {nextInterview.jobApplicationTitle}
                {nextInterview.endClientLabel !== null && ` · ${nextInterview.endClientLabel}`}
              </p>
            </>
          )}
          <Link
            href={CALENDAR_ROUTE}
            className={cn(buttonVariants({ variant: 'ink', size: 'lg' }), 'mt-auto self-start')}
          >
            Voir mon calendrier
          </Link>
        </section>
      </div>
      <div className={BENTO_ROW_CLASS_NAME}>
        <div className="flex min-w-0 flex-col md:flex-[2_1_26rem]">
          <TodoBanner
            title="À faire"
            initialAlerts={initialAlerts.slice(0, MAXIMUM_VISIBLE_ALERTS)}
            snoozeAlert={snoozeAlert}
            confirmCvStillGood={confirmCvStillGood}
            changeJobApplicationStatus={changeJobApplicationStatus}
            jobApplicationSummaries={jobApplicationSummaries}
            interviews={alertInterviews}
            now={now}
          >
            <Link href={JOB_APPLICATIONS_ROUTE} className={OUTLINE_LINK_CLASS_NAME}>
              Voir mes candidatures
            </Link>
          </TodoBanner>
        </div>
        {followingInterviews.length > 0 && (
          <section aria-labelledby="home-following-interviews-title" className={cn(BENTO_TILE_CLASS_NAME, 'gap-3.5 bg-card md:flex-[1_1_16rem]')}>
            <h2 id="home-following-interviews-title" className="font-heading text-xl font-extrabold">
              Ensuite
            </h2>
            <ul className="flex flex-col gap-3.5">
              {followingInterviews.map((interview, index) => {
                const { weekday, day } = formatParisDayBlock(interview.startsAt)
                return (
                  <li key={interview.id}>
                    <Link
                      href={jobApplicationRoute(interview.jobApplicationId)}
                      className="flex items-center gap-3 text-sm hover:underline focus-visible:underline"
                    >
                      <span
                        className={cn(
                          'flex size-14 shrink-0 flex-col items-center justify-center rounded-xl',
                          DAY_BLOCK_CLASS_NAMES[index],
                        )}
                      >
                        <span className="text-xs font-bold">{weekday}</span>
                        <span className="font-heading text-xl leading-none font-extrabold">{day}</span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <strong>
                          {formatParisTime(interview.startsAt)} · {INTERVIEW_KIND_LABELS[interview.kind]}
                        </strong>
                        <span className="text-ink-secondary">{interview.jobApplicationTitle}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <section aria-label="En chiffres" className="flex min-w-0 flex-col gap-5 md:flex-[1_1_14rem]">
          <div className={cn(BENTO_TILE_CLASS_NAME, 'flex-1 justify-end bg-lilac text-on-lilac')}>
            <p className="font-heading text-5xl leading-none font-extrabold">{activeJobApplicationCount}</p>
            <p className="text-sm font-semibold">
              {pluralizeFrench(activeJobApplicationCount, 'candidature en cours', 'candidatures en cours')}
            </p>
          </div>
          <div className={cn(BENTO_TILE_CLASS_NAME, 'flex-1 justify-end bg-deep-surface text-on-deep-surface-soft')}>
            <p className="font-heading text-5xl leading-none font-extrabold text-peach">{opportunitiesToProcessCount}</p>
            <p className="text-sm font-semibold">
              {pluralizeFrench(opportunitiesToProcessCount, 'mission à traiter', 'missions à traiter')}
            </p>
          </div>
        </section>
      </div>
      <section aria-labelledby="home-opportunities-title" className={cn(BENTO_TILE_CLASS_NAME, 'gap-4 bg-card')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-opportunities-title" className="font-heading text-xl font-extrabold">
            Missions intéressantes · moins de 48 h
          </h2>
          <Link href={OPPORTUNITIES_ROUTE} className={OUTLINE_LINK_CLASS_NAME}>
            Voir mes opportunités
          </Link>
        </div>
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
            <p className="text-sm text-ink-secondary">Pas de nouvelle mission intéressante depuis 48 h.</p>
          )
        ) : (
          <ul className="flex flex-wrap gap-4">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id} className="min-w-0 flex-[1_1_22rem]">
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
