import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { LANDING_COPY } from '@/domain/landing-copy'
import { cn } from '@/lib/utils'
import type { LandingClosingSectionProps } from './interfaces'

export const LandingClosingSection = ({ signUpUrl }: LandingClosingSectionProps) => (
  <section className="bg-brand-tile">
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-10 sm:py-24">
      <Image src="/brand/aled-logo-on-dark.png" alt="Aled" width={107} height={48} />
      <h2 className="font-heading text-3xl leading-tight font-extrabold text-on-brand-tile sm:text-5xl">
        {LANDING_COPY.closing.title}
      </h2>
      <p className="text-lg text-on-brand-tile-secondary">{LANDING_COPY.closing.text}</p>
      <a
        href={signUpUrl}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'bg-peach text-on-peach hover:bg-peach/90',
          'focus-visible:border-on-brand-tile focus-visible:ring-2 focus-visible:ring-on-brand-tile focus-visible:ring-offset-2 focus-visible:ring-offset-brand-tile',
        )}
      >
        {LANDING_COPY.closing.callToAction}
      </a>
    </div>
  </section>
)
