/** @jest-environment node */
import { findCookieRequestRejection } from './find-cookie-request-rejection'

jest.mock('server-only', () => ({}))

const buildRequest = (headers: Record<string, string>) =>
  new Request('http://localhost:3000/api/follow-up-messages', { method: 'POST', body: '{}', headers })

describe('findCookieRequestRejection', () => {
  it('accepts a same origin JSON request', () => {
    expect(
      findCookieRequestRejection(buildRequest({ 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' })),
    ).toBeNull()
  })

  it('accepts a JSON request from a browser that does not send Sec-Fetch-Site, with a charset', () => {
    expect(findCookieRequestRejection(buildRequest({ 'Content-Type': 'application/json; charset=utf-8' }))).toBeNull()
  })

  it.each(['cross-site', 'same-site', 'none'])('rejects a request whose Sec-Fetch-Site is %s', (fetchSite) => {
    expect(
      findCookieRequestRejection(buildRequest({ 'Content-Type': 'application/json', 'Sec-Fetch-Site': fetchSite })),
    ).toBe('cross_site')
  })

  it.each([['text/plain'], ['application/x-www-form-urlencoded'], ['multipart/form-data']])(
    'rejects a %s body',
    (contentType) => {
      expect(findCookieRequestRejection(buildRequest({ 'Content-Type': contentType }))).toBe('not_json')
    },
  )

  it('rejects a request without content type', () => {
    const request = new Request('http://localhost:3000/api/follow-up-messages', { method: 'POST' })
    expect(findCookieRequestRejection(request)).toBe('not_json')
  })
})
