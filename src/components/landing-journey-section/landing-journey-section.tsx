import { LANDING_COPY } from '@/domain/landing-copy'
import { cn } from '@/lib/utils'

export const LandingJourneySection = () => {
  const lastStepIndex = LANDING_COPY.journey.steps.length - 1

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-10 sm:py-20">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-3xl leading-tight font-extrabold text-ink sm:text-4xl">
          {LANDING_COPY.journey.title}
        </h2>
        <p className="text-base text-ink-secondary">{LANDING_COPY.journey.text}</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LANDING_COPY.journey.steps.map((step, stepIndex) => {
          const isLastStep = stepIndex === lastStepIndex
          return (
            <li
              key={step.title}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border p-4',
                isLastStep ? 'border-brand-tile bg-brand-tile' : 'border-hairline bg-card',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-full text-sm font-extrabold',
                  isLastStep ? 'bg-peach text-on-peach' : 'bg-forest-soft text-on-forest-soft',
                )}
              >
                {stepIndex + 1}
              </span>
              <h3
                className={cn(
                  'font-heading text-lg font-extrabold',
                  isLastStep ? 'text-on-brand-tile' : 'text-ink',
                )}
              >
                {step.title}
              </h3>
              <p className={cn('text-sm leading-relaxed', isLastStep ? 'text-on-brand-tile-secondary' : 'text-ink-secondary')}>
                {step.text}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
