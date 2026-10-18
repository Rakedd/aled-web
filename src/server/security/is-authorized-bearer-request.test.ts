/** @jest-environment node */
import { isAuthorizedBearerRequest } from './is-authorized-bearer-request'

jest.mock('server-only', () => ({}))

const EXPECTED_SECRET = 'jeton-de-test'

const buildRequest = (authorizationHeader?: string): Request =>
  new Request('http://localhost:3000/api/opportunities/ingest', {
    method: 'POST',
    headers: authorizationHeader === undefined ? {} : { authorization: authorizationHeader },
  })

describe('isAuthorizedBearerRequest', () => {
  it('accepts the expected secret sent with the bearer scheme', () => {
    expect(isAuthorizedBearerRequest(buildRequest(`Bearer ${EXPECTED_SECRET}`), EXPECTED_SECRET)).toBe(true)
  })

  it.each([
    ['without an authorization header', undefined],
    ['with a wrong secret', 'Bearer mauvais-jeton'],
    ['with the secret but no bearer scheme', EXPECTED_SECRET],
    ['with a longer secret sharing the same prefix', `Bearer ${EXPECTED_SECRET}-suffixe`],
  ])('refuses a request %s', (_caseName, authorizationHeader) => {
    expect(isAuthorizedBearerRequest(buildRequest(authorizationHeader), EXPECTED_SECRET)).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
  ])('refuses every request when the expected secret is %s', (_caseName, expectedSecret) => {
    expect(isAuthorizedBearerRequest(buildRequest('Bearer '), expectedSecret)).toBe(false)
    expect(isAuthorizedBearerRequest(buildRequest('Bearer undefined'), expectedSecret)).toBe(false)
  })
})
