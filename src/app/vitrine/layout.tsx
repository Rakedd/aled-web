import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LandingFooter } from '@/components/landing-footer'
import { LandingHeader } from '@/components/landing-header'
import { LANDING_COPY } from '@/domain/landing-copy'
import { LEGAL_NOTICE_PATHNAME, PRIVACY_POLICY_PATHNAME, SIGN_IN_PATHNAME } from '@/domain/landing-routing'
import { buildAppUrl, buildLandingHref, readLandingOrigin } from '@/lib/landing/landing-environment'

export const buildLandingMetadata = (): Metadata => ({
  metadataBase: readLandingOrigin(),
  title: 'Aled · Du premier clic au premier jour',
  description: LANDING_COPY.hero.subtitle,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', locale: 'fr_FR', siteName: 'Aled' },
  twitter: { card: 'summary_large_image' },
})

export const metadata = buildLandingMetadata()

const LandingLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <>
    <LandingHeader homeHref={buildLandingHref('/')} signInUrl={buildAppUrl(SIGN_IN_PATHNAME)} />
    <main className="flex flex-1 flex-col">{children}</main>
    <LandingFooter
      legalNoticeHref={buildLandingHref(LEGAL_NOTICE_PATHNAME)}
      privacyPolicyHref={buildLandingHref(PRIVACY_POLICY_PATHNAME)}
    />
    <Analytics />
  </>
)

export default LandingLayout
