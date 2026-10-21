import { buttonVariants } from '@/components/ui/button'
import { LANDING_COPY } from '@/domain/landing-copy'
import type { LandingHeroProps } from './interfaces'

export const LandingHero = ({ signUpUrl }: LandingHeroProps) => (
  <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-10 sm:py-24">
    <h1 className="max-w-3xl font-heading text-4xl leading-tight font-extrabold text-ink sm:text-6xl sm:leading-[1.05]">
      {LANDING_COPY.hero.titleStart}{' '}
      <del className="text-ink-muted decoration-peach sm:whitespace-nowrap decoration-4 sm:decoration-[6px]">{LANDING_COPY.hero.struckText}</del>{' '}
      {LANDING_COPY.hero.titleEnd}
    </h1>
    <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary">{LANDING_COPY.hero.subtitle}</p>
    <a href={signUpUrl} className={buttonVariants({ size: 'lg' })}>
      {LANDING_COPY.hero.callToAction}
    </a>
  </section>
)
