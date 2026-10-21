import sitemap from './sitemap'

const ORIGINAL_ENVIRONMENT = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENVIRONMENT }
  delete process.env.LANDING_HOSTNAMES
})

afterAll(() => {
  process.env = ORIGINAL_ENVIRONMENT
})

describe('landing sitemap', () => {
  it('lists every landing page under the canonical domain', () => {
    process.env.LANDING_HOSTNAMES = 'aled.work'

    expect(sitemap().map((sitemapEntry) => sitemapEntry.url)).toEqual([
      'https://aled.work/',
      'https://aled.work/mentions-legales',
      'https://aled.work/confidentialite',
    ])
  })

  it('lists nothing when the landing domain is unknown', () => {
    expect(sitemap()).toEqual([])
  })
})
