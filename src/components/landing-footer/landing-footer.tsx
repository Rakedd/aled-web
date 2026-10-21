import Link from 'next/link'
import { LANDING_COPY } from '@/domain/landing-copy'
import type { LandingFooterProps } from './interfaces'

export const LandingFooter = ({ legalNoticeHref, privacyPolicyHref }: LandingFooterProps) => (
  <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-muted sm:px-10">
    <span>{LANDING_COPY.footer.copyright}</span>
    <nav aria-label="Informations légales" className="flex gap-4">
      <Link href={legalNoticeHref} className="underline-offset-4 hover:text-ink hover:underline">
        {LANDING_COPY.footer.legalNotice}
      </Link>
      <Link href={privacyPolicyHref} className="underline-offset-4 hover:text-ink hover:underline">
        {LANDING_COPY.footer.privacyPolicy}
      </Link>
    </nav>
  </footer>
)
