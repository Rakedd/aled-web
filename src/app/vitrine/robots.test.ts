/** @jest-environment node */
import { buildLandingRobotsText } from './robots.txt/route'

describe('landing robots.txt', () => {
  it('opens the landing to crawlers and points them to the sitemap', () => {
    expect(buildLandingRobotsText(new URL('https://aled.work'))).toBe(
      'User-Agent: *\nAllow: /\nSitemap: https://aled.work/sitemap.xml\n',
    )
  })

  it('omits the sitemap when the landing domain is unknown', () => {
    expect(buildLandingRobotsText(undefined)).toBe('User-Agent: *\nAllow: /\n')
  })
})
