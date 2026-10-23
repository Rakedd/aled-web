import { buildAppUrl, buildLandingHref, buildLandingLegalHref, readLandingOrigin } from './landing-environment'

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

describe('buildLandingLegalHref', () => {
  it('targets the landing origin in production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.LANDING_HOSTNAMES = 'aled.work,www.aled.work'

    expect(buildLandingLegalHref('/conditions-utilisation')).toBe('https://aled.work/conditions-utilisation')
  })

  it('logs an error and falls back to the internal segment in production without a landing hostname', () => {
    process.env.VERCEL_ENV = 'production'
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(buildLandingLegalHref('/confidentialite')).toBe('/vitrine/confidentialite')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Landing hostname missing for legal links')
    consoleErrorSpy.mockRestore()
  })

  it('falls back silently to the internal segment without a landing hostname outside production', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(buildLandingLegalHref('/confidentialite')).toBe('/vitrine/confidentialite')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('falls back to the internal segment outside production even with a landing hostname', () => {
    process.env.LANDING_HOSTNAMES = 'aled.work'

    expect(buildLandingLegalHref('/confidentialite')).toBe('/vitrine/confidentialite')
  })
})
