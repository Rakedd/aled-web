'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pill } from '@/components/pill'
import { Button, buttonVariants } from '@/components/ui/button'
import { isExternalLinkUrl } from '@/domain/client-brief'
import { formatOpportunityRate, REMOTE_MODE_LABELS } from '@/domain/opportunities'
import { jobApplicationRoute } from '@/domain/routes'
import { cn } from '@/lib/utils'
import { formatOpportunityPublication } from './format-opportunity-publication'
import type { OpportunityCardProps } from './interfaces'

export const OpportunityCard = ({
  opportunity,
  tab,
  isCompact,
  isNew,
  isPending,
  now,
  onApply,
  onDismiss,
  onRestore,
}: OpportunityCardProps) => {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const descriptionId = `opportunity-description-${opportunity.id}`
  const facts = [
    opportunity.company,
    opportunity.remoteMode === null ? null : REMOTE_MODE_LABELS[opportunity.remoteMode],
    opportunity.locationLabel,
    opportunity.durationMonths === null || opportunity.durationMonths <= 0 ? null : `${opportunity.durationMonths} mois`,
    formatOpportunityPublication(opportunity.publishedAt, now),
  ].filter((fact): fact is string => fact !== null && fact !== '')
  const applicationLink =
    opportunity.jobApplicationId === null ? null : (
      <Link
        href={jobApplicationRoute(opportunity.jobApplicationId)}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        Voir la candidature
      </Link>
    )

  const externalLink = isExternalLinkUrl(opportunity.url) && (
    <a
      href={opportunity.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
    >
      Voir sur Free-Work
    </a>
  )

  return (
    <article className={'flex flex-col gap-3 rounded-2xl bg-card p-4'}>
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-base font-semibold">{opportunity.title}</h3>
          {isNew && <Pill tone="lilac">nouveau</Pill>}
        </div>
        <p className="shrink-0 font-heading text-base text-forest">{formatOpportunityRate(opportunity)}</p>
      </header>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {facts.map((fact, factIndex) => (
          <li key={`${factIndex}-${fact}`}>{fact}</li>
        ))}
      </ul>
      {!isCompact && opportunity.description && (
        <div className="flex flex-col items-start gap-1">
          <p id={descriptionId} className={cn('whitespace-pre-line break-words text-sm', !isDescriptionExpanded && 'line-clamp-3')}>
            {opportunity.description}
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            aria-expanded={isDescriptionExpanded}
            aria-controls={descriptionId}
            onClick={() => setIsDescriptionExpanded((isExpanded) => !isExpanded)}
          >
            {isDescriptionExpanded ? 'Réduire' : 'Afficher la suite'}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {tab === 'to_process' && opportunity.jobApplicationId === null && (
          <Button type="button" size="sm" disabled={isPending} onClick={() => onApply(opportunity)}>
            {isPending ? 'Création…' : <>J&apos;ai postulé</>}
          </Button>
        )}
        {tab === 'to_process' && opportunity.jobApplicationId !== null && (
          <>
            <span className="text-sm text-muted-foreground">Candidature créée ·</span>
            {applicationLink}
          </>
        )}
        {tab === 'applied' && applicationLink}
        {externalLink}
        {tab === 'to_process' && opportunity.jobApplicationId === null && !isCompact && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto" disabled={isPending} onClick={() => onDismiss(opportunity)}>
            Pas intéressé
          </Button>
        )}
        {tab === 'dismissed' && !isCompact && (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => onRestore(opportunity)}>
            Remettre
          </Button>
        )}
      </div>
    </article>
  )
}
