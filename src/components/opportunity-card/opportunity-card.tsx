'use client'

import Link from 'next/link'
import { useState } from 'react'
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
    formatOpportunityRate(opportunity),
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

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <header className="flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words text-base font-semibold">{opportunity.title}</h3>
        {isNew && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            nouveau
          </span>
        )}
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
        {isExternalLinkUrl(opportunity.url) && (
          <a
            href={opportunity.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Voir sur Free-Work
          </a>
        )}
        {tab === 'to_process' && opportunity.jobApplicationId === null && (
          <>
            <Button type="button" size="sm" disabled={isPending} onClick={() => onApply(opportunity)}>
              {isPending ? 'Création…' : <>J&apos;ai postulé</>}
            </Button>
            {!isCompact && (
              <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => onDismiss(opportunity)}>
                Pas intéressé
              </Button>
            )}
          </>
        )}
        {tab === 'to_process' && opportunity.jobApplicationId !== null && (
          <>
            <span className="text-sm text-muted-foreground">Candidature créée ·</span>
            {applicationLink}
          </>
        )}
        {tab === 'applied' && applicationLink}
        {tab === 'dismissed' && !isCompact && (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => onRestore(opportunity)}>
            Remettre
          </Button>
        )}
      </div>
    </article>
  )
}
