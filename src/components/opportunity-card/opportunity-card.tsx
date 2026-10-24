'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Pill } from '@/components/pill'
import type { PillTone } from '@/components/pill/interfaces'
import { Button, buttonVariants } from '@/components/ui/button'
import { isExternalLinkUrl } from '@/domain/client-brief'
import { formatOpportunityRate, OPPORTUNITY_SOURCE_LABELS, REMOTE_MODE_LABELS } from '@/domain/opportunities'
import {
  describeHiddenSkillCount,
  describeOpportunityMatchForScreenReaders,
  describeOpportunityMatchLevel,
  formatOpportunityMatchPercent,
  formatOpportunityMatchSummary,
  OPPORTUNITY_MATCH_MESSAGES,
  type OpportunityMatchLevel,
} from '@/domain/opportunity-match'
import { jobApplicationRoute } from '@/domain/routes'
import { cn } from '@/lib/utils'
import { buildOpportunitySkillLine } from './build-opportunity-skill-line'
import { formatOpportunityPublication } from './format-opportunity-publication'
import type { OpportunityCardProps } from './interfaces'

const NO_SKILLS: string[] = []

const MATCH_LEVEL_TONES: Record<OpportunityMatchLevel, PillTone> = {
  strong: 'forest-soft',
  good: 'peach',
  weak: 'neutral',
}

export const OpportunityCard = ({
  opportunity,
  mySkills = NO_SKILLS,
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
  const { match, visibleSkills, hiddenSkillCount } = buildOpportunitySkillLine(opportunity.skills, mySkills)
  const matchLevel = match === null ? null : describeOpportunityMatchLevel(match.percent)
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
      Voir sur {OPPORTUNITY_SOURCE_LABELS[opportunity.source]}
    </a>
  )

  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl bg-card', isCompact ? 'p-0' : 'p-6')}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-base font-semibold">{opportunity.title}</h3>
          <Pill tone="neutral">{OPPORTUNITY_SOURCE_LABELS[opportunity.source]}</Pill>
          {isNew && <Pill tone="lilac">nouveau</Pill>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {match !== null && matchLevel !== null && (
            <Pill tone={MATCH_LEVEL_TONES[matchLevel.level]}>
              <span aria-hidden="true">{formatOpportunityMatchPercent(match.percent)}</span>
              <span className="sr-only">{describeOpportunityMatchForScreenReaders(match)}</span>
            </Pill>
          )}
          <p className={cn('font-heading font-extrabold text-accent-text', isCompact ? 'text-lg' : 'text-xl')}>
            {formatOpportunityRate(opportunity)}
          </p>
        </div>
      </header>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {facts.map((fact, factIndex) => (
          <li key={`${factIndex}-${fact}`}>{fact}</li>
        ))}
      </ul>
      {!isCompact && visibleSkills.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1.5">
          {match !== null && (
            <p aria-hidden="true" className="text-xs font-medium text-muted-foreground">
              {formatOpportunityMatchSummary(match)}
            </p>
          )}
          <ul aria-label={OPPORTUNITY_MATCH_MESSAGES.opportunitySkillsLabel} className="flex min-w-0 flex-wrap gap-1.5">
            {visibleSkills.map((skillChip) => (
              <li key={skillChip.name} className="min-w-0 max-w-full">
                <Pill
                  tone={skillChip.isShared ? MATCH_LEVEL_TONES.strong : 'neutral'}
                  className="max-w-full gap-1 whitespace-normal"
                >
                  {skillChip.isShared && <Check className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />}
                  <span className="min-w-0 break-words">{skillChip.name}</span>
                  {skillChip.isShared && <span className="sr-only">{OPPORTUNITY_MATCH_MESSAGES.sharedSkillSuffix}</span>}
                </Pill>
              </li>
            ))}
            {hiddenSkillCount > 0 && (
              <li>
                <Pill tone="neutral">
                  <span aria-hidden="true">+{hiddenSkillCount}</span>
                  <span className="sr-only">{describeHiddenSkillCount(hiddenSkillCount)}</span>
                </Pill>
              </li>
            )}
          </ul>
        </div>
      )}
      {!isCompact && opportunity.description && (
        <div className="flex flex-col items-start gap-1">
          <p id={descriptionId} className={cn('whitespace-pre-line break-words text-sm', !isDescriptionExpanded && 'line-clamp-3')}>
            {opportunity.description}
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-11 px-0 sm:h-9"
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3.5 ml-auto"
            disabled={isPending}
            onClick={() => onDismiss(opportunity)}
          >
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
