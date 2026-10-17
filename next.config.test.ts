/**
 * @jest-environment node
 */
import nextConfig from './next.config'

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
