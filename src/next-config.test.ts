import nextConfig from '../next.config'

const findRedirect = async (source: string) => (await nextConfig.redirects?.())?.find((redirect) => redirect.source === source)

describe('next config redirects', () => {
  it('permanently redirects /settings to /preferences', async () => {
    expect(await findRedirect('/settings')).toEqual({
      source: '/settings',
      destination: '/preferences',
      permanent: true,
    })
  })

  it('permanently redirects every /settings sub-path to /preferences', async () => {
    expect(await findRedirect('/settings/:path*')).toEqual({
      source: '/settings/:path*',
      destination: '/preferences/:path*',
      permanent: true,
    })
  })
})
