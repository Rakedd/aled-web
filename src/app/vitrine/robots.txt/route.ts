import { readLandingOrigin } from '@/lib/landing/landing-environment'

export const dynamic = 'force-static'

export const buildLandingRobotsText = (landingOrigin: URL | undefined): string => {
  const crawlerRules = 'User-Agent: *\nAllow: /\n'
  return landingOrigin ? `${crawlerRules}Sitemap: ${new URL('/sitemap.xml', landingOrigin).href}\n` : crawlerRules
}

export const GET = () =>
  new Response(buildLandingRobotsText(readLandingOrigin()), { headers: { 'Content-Type': 'text/plain' } })
