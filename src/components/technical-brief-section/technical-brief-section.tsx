'use client'

import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Button, buttonVariants } from '@/components/ui/button'
import { jobApplicationTabRoute } from '@/domain/job-application-tabs'
import { CV_LIBRARY_ROUTE } from '@/domain/routes'
import {
  formatTechnicalBriefSource,
  TECHNICAL_BRIEF_EMPHASIS_LABELS,
  TECHNICAL_BRIEF_MESSAGES,
  type TechnicalBrief,
  type TechnicalBriefMission,
} from '@/domain/technical-brief'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { TechnicalBriefSectionProps, TransientOutcome } from './interfaces'

const SECTION_TITLE_ID = 'technical-brief-title'
const STORYLINE_TITLE_ID = 'technical-brief-storyline-title'
const MISSIONS_TITLE_ID = 'technical-brief-missions-title'
const GAPS_TITLE_ID = 'technical-brief-gaps-title'

const EMPHASIS_PILL_CLASS_NAMES = {
  lean_on: 'bg-peach text-on-peach',
  intro: 'bg-forest-soft text-on-forest-soft',
  skim: 'bg-forest-soft text-on-forest-soft',
} as const

const MissionCard = ({ mission }: { mission: TechnicalBriefMission }) => (
  <article aria-label={mission.label} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="font-semibold break-words">{mission.label}</h4>
      {mission.period !== '' && <span className="text-xs text-muted-foreground">{mission.period}</span>}
      <span
        className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
          EMPHASIS_PILL_CLASS_NAMES[mission.emphasis],
        )}
      >
        {TECHNICAL_BRIEF_EMPHASIS_LABELS[mission.emphasis]}
      </span>
    </div>
    {mission.sharedStack.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">{TECHNICAL_BRIEF_MESSAGES.sharedStackLabel}</span>
        {mission.sharedStack.map((stackItem) => (
          <span key={stackItem} className="rounded-full border border-border px-2 py-0.5 text-xs">
            {stackItem}
          </span>
        ))}
      </div>
    )}
    <p className="break-words">{`${TECHNICAL_BRIEF_MESSAGES.whyLabel} ${mission.why}`}</p>
    {mission.reflectionQuestions.length > 0 && (
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground">{TECHNICAL_BRIEF_MESSAGES.reflectionQuestionsLabel}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {mission.reflectionQuestions.map((question) => (
            <li key={question} className="break-words">
              {question}
            </li>
          ))}
        </ul>
      </div>
    )}
  </article>
)

const BriefContent = ({ brief }: { brief: TechnicalBrief }) => {
  const { storyline, missions, gaps } = brief.content
  const missionsToLeanOn = missions.filter((mission) => mission.emphasis !== 'skim')
  const missionsToSkim = missions.filter((mission) => mission.emphasis === 'skim')
  const skimLine = missionsToSkim.map((mission) => `${mission.label} (${mission.why})`).join(' ; ')

  return (
    <>
      <div className="flex flex-col gap-2">
        <h4 id={STORYLINE_TITLE_ID} className="text-sm font-semibold">
          {TECHNICAL_BRIEF_MESSAGES.storylineTitle}
        </h4>
        <ol aria-labelledby={STORYLINE_TITLE_ID} className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          {storyline.map((step) => (
            <li key={step.title} className="break-words">
              <span className="font-semibold">{step.title}</span>
              <p className="text-muted-foreground">{step.guidance}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-2">
        <h4 id={MISSIONS_TITLE_ID} className="text-sm font-semibold">
          {TECHNICAL_BRIEF_MESSAGES.missionsTitle}
        </h4>
        {missionsToLeanOn.map((mission) => (
          <MissionCard key={mission.label} mission={mission} />
        ))}
        {missionsToSkim.length > 0 && (
          <p className="text-sm break-words">{`${TECHNICAL_BRIEF_MESSAGES.skimPrefix} ${skimLine}.`}</p>
        )}
      </div>
      {gaps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 id={GAPS_TITLE_ID} className="text-sm font-semibold">
            {TECHNICAL_BRIEF_MESSAGES.gapsTitle}
          </h4>
          <p className="text-sm">{TECHNICAL_BRIEF_MESSAGES.gapsIntroduction}</p>
          <ul aria-labelledby={GAPS_TITLE_ID} className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {gaps.map((gap) => (
              <li key={gap.stackItem} className="break-words">{`${gap.stackItem} — ${gap.question}`}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

const TransientOutcomeNotice = ({ transientOutcome }: { transientOutcome: TransientOutcome }) => (
  <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
    {transientOutcome === 'cv_missing_information' ? (
      <>
        <p className="font-semibold">{TECHNICAL_BRIEF_MESSAGES.cvMissingInformationTitle}</p>
        <p>{TECHNICAL_BRIEF_MESSAGES.cvMissingInformationDetail}</p>
        <p>{TECHNICAL_BRIEF_MESSAGES.cvMissingInformationReassurance}</p>
      </>
    ) : (
      <p>{TECHNICAL_BRIEF_MESSAGES.cvUnreadable}</p>
    )}
    <div>
      <a href={CV_LIBRARY_ROUTE} className={cn(buttonVariants({ variant: 'outline' }))}>
        {TECHNICAL_BRIEF_MESSAGES.improveCv}
      </a>
    </div>
  </div>
)

export const TechnicalBriefSection = (sectionProps: TechnicalBriefSectionProps) => {
  const { jobApplicationId, hasAnthropicApiKey } = sectionProps
  const { view, isLoading, isGenerating, errorMessage, transientOutcome, generate } = useController(sectionProps)
  const chooseSentCvLink = (
    <a
      href={`${jobApplicationTabRoute(jobApplicationId, 'apercu')}#cv-envoye`}
      className={cn(buttonVariants({ variant: 'outline' }))}
    >
      {TECHNICAL_BRIEF_MESSAGES.chooseSentCv}
    </a>
  )
  const generationButtonLabel = (idleLabel: string) =>
    isGenerating ? TECHNICAL_BRIEF_MESSAGES.generationProgress : idleLabel
  const brief = view?.brief ?? null

  return (
    <section
      aria-labelledby={SECTION_TITLE_ID}
      aria-busy={isLoading}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 id={SECTION_TITLE_ID} className="text-sm font-semibold">
            {TECHNICAL_BRIEF_MESSAGES.title}
          </h3>
          {brief !== null && <p className="text-xs text-muted-foreground">{formatTechnicalBriefSource(brief)}</p>}
        </div>
        {view !== null && brief !== null && view.availability === 'ready' && hasAnthropicApiKey && (
          <Button
            type="button"
            variant={view.isCvOutdated ? 'default' : 'outline'}
            onClick={() => void generate()}
            disabled={isGenerating}
          >
            {generationButtonLabel(TECHNICAL_BRIEF_MESSAGES.regenerate)}
          </Button>
        )}
        {view !== null && brief !== null && view.availability === 'missing_sent_cv' && chooseSentCvLink}
      </div>
      {!hasAnthropicApiKey && <MissingAnthropicApiKeyNotice featureDescription="la préparation du pitch" />}
      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          {TECHNICAL_BRIEF_MESSAGES.loading}
        </p>
      )}
      {view !== null && view.isCvOutdated && (
        <p className="text-sm text-muted-foreground">{TECHNICAL_BRIEF_MESSAGES.cvOutdated}</p>
      )}
      {view !== null && brief !== null && view.availability === 'missing_mission_details' && (
        <p className="text-sm">{TECHNICAL_BRIEF_MESSAGES.missingMissionDetails}</p>
      )}
      {brief !== null && <BriefContent brief={brief} />}
      {view !== null && brief === null && view.availability === 'missing_sent_cv' && (
        <>
          <p className="text-sm">{TECHNICAL_BRIEF_MESSAGES.missingSentCv}</p>
          <div>{chooseSentCvLink}</div>
        </>
      )}
      {view !== null && brief === null && view.availability === 'missing_mission_details' && (
        <p className="text-sm">{TECHNICAL_BRIEF_MESSAGES.missingMissionDetails}</p>
      )}
      {view !== null && brief === null && view.availability === 'ready' && (
        <>
          <p className="text-sm">{TECHNICAL_BRIEF_MESSAGES.readyIntroduction}</p>
          {hasAnthropicApiKey && (
            <div>
              <Button type="button" variant="outline" onClick={() => void generate()} disabled={isGenerating}>
                {generationButtonLabel(TECHNICAL_BRIEF_MESSAGES.generate)}
              </Button>
            </div>
          )}
        </>
      )}
      {transientOutcome !== null && <TransientOutcomeNotice transientOutcome={transientOutcome} />}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
