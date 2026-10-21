import { BrandLogoLink } from '@/components/brand-logo-link'
import { ThemeMenu } from '@/components/theme-menu'
import { buttonVariants } from '@/components/ui/button'
import { LANDING_COPY } from '@/domain/landing-copy'
import type { LandingHeaderProps } from './interfaces'

export const LandingHeader = ({ homeHref, signInUrl }: LandingHeaderProps) => (
  <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-10">
    <BrandLogoLink href={homeHref} />
    <div className="flex items-center gap-3">
      <ThemeMenu />
      <a href={signInUrl} className={buttonVariants({ variant: 'outline' })}>
        {LANDING_COPY.header.signIn}
      </a>
    </div>
  </header>
)
