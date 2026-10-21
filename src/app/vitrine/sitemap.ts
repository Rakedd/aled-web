import type { MetadataRoute } from 'next'
import { LEGAL_NOTICE_PATHNAME, PRIVACY_POLICY_PATHNAME } from '@/domain/landing-routing'
import { readLandingOrigin } from '@/lib/landing/landing-environment'

const LANDING_PATHNAMES = ['/', LEGAL_NOTICE_PATHNAME, PRIVACY_POLICY_PATHNAME]

const sitemap = (): MetadataRoute.Sitemap => {
  const landingOrigin = readLandingOrigin()
  if (!landingOrigin) return []
  return LANDING_PATHNAMES.map((pathname) => ({ url: new URL(pathname, landingOrigin).href }))
}

export default sitemap
