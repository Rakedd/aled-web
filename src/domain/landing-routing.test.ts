import {
  isAppPathname,
  isLandingHostname,
  isLandingInternalPathname,
  isWwwHostname,
  parseLandingHostnames,
  stripWwwPrefix,
  toBareLandingHost,
  toLandingInternalPathname,
} from './landing-routing'

describe('parseLandingHostnames', () => {
  it('splits, trims and lowercases a comma separated list', () => {
    expect(parseLandingHostnames(' aled.work, WWW.aled.work ,,')).toEqual(['aled.work', 'www.aled.work'])
  })

  it('returns no hostname when the variable is missing', () => {
    expect(parseLandingHostnames(undefined)).toEqual([])
  })
})

describe('isLandingHostname', () => {
  it('ignores the case of the requested hostname', () => {
    expect(isLandingHostname('ALED.work', ['aled.work'])).toBe(true)
  })

  it('ignores the port of a local hostname', () => {
    expect(isLandingHostname('aled.localhost:3000', ['aled.localhost'])).toBe(true)
  })

  it('does not treat the app subdomain as the landing', () => {
    expect(isLandingHostname('app.aled.work', ['aled.work'])).toBe(false)
  })
})

describe('toBareLandingHost', () => {
  it('removes www and keeps a numeric port', () => {
    expect(toBareLandingHost('www.aled.work')).toBe('aled.work')
    expect(toBareLandingHost('www.aled.localhost:3000')).toBe('aled.localhost:3000')
  })

  it('drops anything after the colon that is not a port, so a forged Host cannot point elsewhere', () => {
    expect(toBareLandingHost('www.aled.work:@evil.com')).toBe('aled.work')
  })
})

describe('www hostnames', () => {
  it('removes the www prefix', () => {
    expect(stripWwwPrefix('www.aled.work')).toBe('aled.work')
  })

  it('recognises a hostname without www', () => {
    expect(isWwwHostname('aled.work')).toBe(false)
    expect(isWwwHostname('www.aled.work')).toBe(true)
  })
})

describe('landing internal pathnames', () => {
  it('maps the landing home to the internal segment', () => {
    expect(toLandingInternalPathname('/')).toBe('/vitrine')
  })

  it('maps a landing page under the internal segment', () => {
    expect(toLandingInternalPathname('/mentions-legales')).toBe('/vitrine/mentions-legales')
  })

  it.each(['/vitrine', '/vitrine/confidentialite'])('recognises the internal pathname %s', (pathname) => {
    expect(isLandingInternalPathname(pathname)).toBe(true)
  })

  it('does not confuse a pathname that only starts like the internal segment', () => {
    expect(isLandingInternalPathname('/vitrines')).toBe(false)
  })
})

describe('isAppPathname', () => {
  it.each([
    '/login',
    '/auth/confirm',
    '/candidatures/42',
    '/calendar',
    '/contacts',
    '/agences/x',
    '/opportunites',
    '/preferences/opportunites',
    '/settings',
    '/api/export',
    '/inscription',
  ])('recognises the app pathname %s', (pathname) => {
    expect(isAppPathname(pathname)).toBe(true)
  })

  it.each(['/', '/mentions-legales', '/confidentialite', '/robots.txt', '/loginx'])(
    'keeps %s on the landing',
    (pathname) => {
      expect(isAppPathname(pathname)).toBe(false)
    },
  )
})
