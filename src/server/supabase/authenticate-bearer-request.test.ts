/** @jest-environment node */
import { authenticateBearerRequest } from './authenticate-bearer-request'
import { createBearerSupabaseClient } from './create-bearer-supabase-client'

jest.mock('server-only', () => ({}))
jest.mock('./create-bearer-supabase-client')

const createBearerSupabaseClientMock = jest.mocked(createBearerSupabaseClient)

const buildRequest = (authorizationHeader?: string): Request =>
  new Request('http://localhost/api/calls', {
    headers: authorizationHeader === undefined ? {} : { authorization: authorizationHeader },
  })

const mockClaimsResult = (claimsResult: unknown) => {
  const getClaims = jest.fn().mockResolvedValue(claimsResult)
  createBearerSupabaseClientMock.mockReturnValue({ auth: { getClaims } } as unknown as ReturnType<
    typeof createBearerSupabaseClient
  >)
  return getClaims
}

describe('authenticateBearerRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns null without creating a client when the authorization header is missing', async () => {
    expect(await authenticateBearerRequest(buildRequest())).toBeNull()
    expect(createBearerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it.each(['Basic abc', 'Bearer', 'Bearer ', 'bearer abc def'])(
    'returns null for the malformed header %p',
    async (malformedHeader) => {
      expect(await authenticateBearerRequest(buildRequest(malformedHeader))).toBeNull()
      expect(createBearerSupabaseClientMock).not.toHaveBeenCalled()
    },
  )

  it('returns null for an expired token', async () => {
    mockClaimsResult({ data: null, error: new Error('JWT expired') })
    expect(await authenticateBearerRequest(buildRequest('Bearer jeton-mobile'))).toBeNull()
  })

  it('returns null when the claims have no subject', async () => {
    mockClaimsResult({ data: { claims: {} }, error: null })
    expect(await authenticateBearerRequest(buildRequest('Bearer jeton-mobile'))).toBeNull()
  })

  it('accepts a token without email and returns the user id with the client carrying the token', async () => {
    const getClaims = mockClaimsResult({ data: { claims: { sub: 'user-1' } }, error: null })
    const authentication = await authenticateBearerRequest(buildRequest('Bearer jeton-mobile'))
    expect(authentication?.userId).toBe('user-1')
    expect(authentication?.supabase).toBe(createBearerSupabaseClientMock.mock.results[0].value)
    expect(createBearerSupabaseClientMock).toHaveBeenCalledWith('jeton-mobile')
    expect(getClaims).toHaveBeenCalledWith('jeton-mobile')
  })
})
