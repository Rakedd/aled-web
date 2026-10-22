import { randomUUID } from 'node:crypto'
import type { ContactProfileInput } from '@/domain/contacts'
import { insertContact, listContactListItems } from '@/server/repositories/contacts-repository'
import { authenticateBearerRequest } from '@/server/supabase/authenticate-bearer-request'
import { createBearerSupabaseClient } from '@/server/supabase/create-bearer-supabase-client'
import { createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`bearer-${randomUUID()}@test.local`)

type TestUser = Awaited<ReturnType<typeof createTestUser>>

const readAccessToken = async (user: TestUser): Promise<string> => {
  const { data } = await user.client.auth.getSession()
  if (!data.session) throw new Error('Missing session for the test user')
  return data.session.access_token
}

const buildContactProfileInput = (): ContactProfileInput => ({
  fullName: 'Hélène Martin',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
})

describe('bearer supabase client', () => {
  it('reads only the rows of the token owner through RLS', async () => {
    const owner = await createTestUser()
    const otherUser = await createTestUser()
    const insertion = await insertContact(owner.client, owner.userId, buildContactProfileInput())
    expect(insertion.ok).toBe(true)

    const ownerBearerClient = createBearerSupabaseClient(await readAccessToken(owner))
    const otherBearerClient = createBearerSupabaseClient(await readAccessToken(otherUser))

    expect(await listContactListItems(otherBearerClient, owner.userId)).toEqual([])
    expect(await listContactListItems(ownerBearerClient, owner.userId)).toHaveLength(1)
  })

  it('refuses a tampered token', async () => {
    const owner = await createTestUser()
    const accessToken = await readAccessToken(owner)
    const lastCharacter = accessToken.slice(-1)
    const tamperedToken = accessToken.slice(0, -1) + (lastCharacter === 'A' ? 'B' : 'A')

    const request = new Request('http://localhost/api/calls', {
      headers: { authorization: `Bearer ${tamperedToken}` },
    })

    expect(await authenticateBearerRequest(request)).toBeNull()
  })
})
