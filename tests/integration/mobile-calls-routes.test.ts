import { randomUUID } from 'node:crypto'
import type { Anthropic } from '@anthropic-ai/sdk'
import { POST as recordCallRoute } from '@/app/api/mobile/calls/route'
import { POST as callDraftRoute } from '@/app/api/mobile/calls/draft/route'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { createFakeAnthropicClientReturning, emptyCallNoteExtraction } from '@/server/ai/testing/fake-anthropic-client'
import { encryptApiKey } from '@/server/crypto/api-key-encryption'
import { insertContact } from '@/server/repositories/contacts-repository'
import { listExchangesForContact } from '@/server/repositories/exchanges-repository'
import { storeEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import { createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))

const ENCRYPTION_SECRET = Buffer.alloc(32, 7).toString('base64')
const CONTACT_PHONE = '+33 6 12 34 56 78'

const createTestUser = async () => {
  const user = await createSignedInTestClient(`mobile-calls-${randomUUID()}@test.local`)
  const { data } = await user.client.auth.getSession()
  if (!data.session) throw new Error('Missing session for the test user')
  const encryptedApiKey = encryptApiKey('sk-ant-fake-key', ENCRYPTION_SECRET)
  await storeEncryptedAnthropicApiKey(user.client, user.userId, { encryptedApiKey, apiKeyLastFour: 'fake' })
  return { ...user, accessToken: data.session.access_token }
}

const callRoute = (
  route: (request: Request) => Promise<Response>,
  path: string,
  accessToken: string,
  body: unknown,
) =>
  route(
    new Request(`http://localhost:3000/api/mobile/calls${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

describe('mobile calls routes', () => {
  beforeAll(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = ENCRYPTION_SECRET
  })

  beforeEach(() => {
    jest
      .mocked(createAnthropicClient)
      .mockReturnValue(createFakeAnthropicClientReturning({ ...emptyCallNoteExtraction, summary: 'Point rapide' }) as Anthropic)
  })

  it('prepares a draft that suggests the contact matching the pasted number', async () => {
    const user = await createTestUser()
    const insertion = await insertContact(user.client, user.userId, {
      fullName: 'Hélène Martin',
      phone: CONTACT_PHONE,
      email: null,
      linkedinUrl: null,
      intermediaryName: null,
      referredBy: null,
      notes: null,
    })
    if (!insertion.ok) throw new Error(insertion.errorMessage)

    const response = await callRoute(callDraftRoute, '/draft', user.accessToken, {
      text: 'Appel rapide',
      phone: CONTACT_PHONE,
      contactId: null,
      occurredAt: new Date().toISOString(),
    })

    expect(response.status).toBe(200)
    expect((await response.json()).contact.suggestedContactId).toBe(insertion.data.id)
  })

  it('records the call and shows it in the contact history', async () => {
    const user = await createTestUser()
    const response = await callRoute(recordCallRoute, '', user.accessToken, {
      contact: {
        new: { fullName: 'Marie Dupont', phone: null, email: null, linkedinUrl: null, intermediaryName: null, referredBy: null, notes: null },
      },
      contactDetails: { phone: null, email: null, linkedinUrl: null },
      userEditedContactFields: [],
      exchange: { summary: 'Appel de présentation', occurredAt: new Date().toISOString() },
      jobApplication: null,
    })

    expect(response.status).toBe(200)
    const recorded = await response.json()
    expect(recorded.jobApplicationId).toBeNull()
    const exchanges = await listExchangesForContact(user.client, user.userId, recorded.contactId)
    expect(exchanges).toHaveLength(1)
    expect(exchanges[0].summary).toBe('Appel de présentation')
  })

  it('answers 401 to a tampered token on both routes', async () => {
    const user = await createTestUser()
    const lastCharacter = user.accessToken.slice(-1)
    const tamperedToken = user.accessToken.slice(0, -1) + (lastCharacter === 'A' ? 'B' : 'A')

    const draftResponse = await callRoute(callDraftRoute, '/draft', tamperedToken, {})
    const recordResponse = await callRoute(recordCallRoute, '', tamperedToken, {})

    expect(draftResponse.status).toBe(401)
    expect(recordResponse.status).toBe(401)
  })
})
