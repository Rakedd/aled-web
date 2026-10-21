import { buildAppUrl, buildLandingHref, readLandingOrigin } from './landing-environment'

const ORIGINAL_ENVIRONMENT = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENVIRONMENT }
  delete process.env.APP_ORIGIN
  delete process.env.LANDING_HOSTNAMES
  delete process.env.VERCEL_ENV
})

afterAll(() => {
  process.env = ORIGINAL_ENVIRONMENT
})

describe('buildAppUrl', () => {
  it('prefixes the pathname with the app origin without doubling the slash', () => {
    process.env.APP_ORIGIN = 'https://app.aled.work/'

    expect(buildAppUrl('/inscription')).toBe('https://app.aled.work/inscription')
  })

  it('falls back to a relative pathname when the app origin is missing', () => {
    expect(buildAppUrl('/login')).toBe('/login')
  })
})

describe('readLandingOrigin', () => {
  it('builds the canonical origin from the first landing hostname', () => {
    process.env.LANDING_HOSTNAMES = 'aled.work,www.aled.work'

    expect(readLandingOrigin()?.href).toBe('https://aled.work/')
  })

  it('has no origin when no landing hostname is configured', () => {
    expect(readLandingOrigin()).toBeUndefined()
  })
})

describe('buildLandingHref', () => {
  it('keeps the public pathname in production', () => {
    process.env.VERCEL_ENV = 'production'

    expect(buildLandingHref('/mentions-legales')).toBe('/mentions-legales')
  })

  it('stays under the internal segment on a preview deployment', () => {
    process.env.VERCEL_ENV = 'preview'

    expect(buildLandingHref('/mentions-legales')).toBe('/vitrine/mentions-legales')
    expect(buildLandingHref('/')).toBe('/vitrine')
  })
})
