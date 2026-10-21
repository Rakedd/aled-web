/**
 * @jest-environment node
 */
import nextConfig, { buildLandingApiRedirects } from './next.config'

const readHeadersForEveryRoute = async () => {
  const headerRules = (await nextConfig.headers?.()) ?? []
  const everyRouteRule = headerRules.find((headerRule) => headerRule.source === '/:path*')
  return new Map(everyRouteRule?.headers.map((header) => [header.key, header.value]))
}

describe('next.config security headers', () => {
  it('forbids framing the app, sniffing content types and leaking full referrers on every route', async () => {
    const headersForEveryRoute = await readHeadersForEveryRoute()
    expect(headersForEveryRoute.get('X-Frame-Options')).toBe('DENY')
    expect(headersForEveryRoute.get('Content-Security-Policy')).toBe("frame-ancestors 'none'")
    expect(headersForEveryRoute.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headersForEveryRoute.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headersForEveryRoute.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=(), payment=()')
  })

  it('does not restrict scripts, so the Next.js runtime keeps working', async () => {
    const headersForEveryRoute = await readHeadersForEveryRoute()
    expect(headersForEveryRoute.get('Content-Security-Policy')).not.toContain('script-src')
  })
})

describe('next.config landing API redirects', () => {
  it('sends API calls made on a landing domain to the app', () => {
    expect(
      buildLandingApiRedirects({ landingHostnames: 'aled.work,www.aled.work', appOrigin: 'https://app.aled.work' }),
    ).toEqual([
      {
        source: '/api/:path*',
        has: [{ type: 'host', value: 'aled.work' }],
        destination: 'https://app.aled.work/api/:path*',
        permanent: true,
      },
      {
        source: '/api/:path*',
        has: [{ type: 'host', value: 'www.aled.work' }],
        destination: 'https://app.aled.work/api/:path*',
        permanent: true,
      },
    ])
  })

  it('adds no redirect when the app origin is unknown', () => {
    expect(buildLandingApiRedirects({ landingHostnames: 'aled.work', appOrigin: undefined })).toEqual([])
  })

  it('keeps the settings redirects', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []
    expect(redirects.map((redirect) => redirect.source)).toEqual(
      expect.arrayContaining(['/settings', '/settings/:path*']),
    )
  })
})
