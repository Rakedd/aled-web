/**
 * @jest-environment node
 */
import { randomBytes } from 'node:crypto'
import { encryptApiKey } from '@/server/crypto/api-key-encryption'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { findProfileSettings, getDecryptedAnthropicApiKeyForUser, updateProfileSettingsRow } from './profile-repository'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type FakeSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

const profileSettingsRow = {
  first_name: null,
  last_name: 'Lovelace',
  email: 'ada@example.com',
  links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }, { unexpected: true }],
  follow_up_delay_days: 7,
  anthropic_api_key_last_four: '4f2a',
}

const createFakeSupabaseClientReturning = (rowData: unknown) => {
  const queryBuilder = {
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: rowData, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: rowData, error: null }),
  }
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  const supabaseClient = { from: jest.fn().mockReturnValue(queryBuilder) } as unknown as FakeSupabaseClient
  return { supabaseClient, queryBuilder }
}

describe('findProfileSettings', () => {
  it('reads only the profile of the given user and never selects the encrypted api key', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClientReturning(profileSettingsRow)
    await expect(findProfileSettings(supabaseClient, 'user-1')).resolves.toEqual({
      firstName: '',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
      followUpDelayDays: 7,
      anthropicApiKeyLastFour: '4f2a',
    })
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(queryBuilder.select.mock.calls[0][0]).not.toContain('encrypted_anthropic_api_key')
  })

  it('throws without leaking database details when the query fails', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClientReturning(null)
    queryBuilder.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows', details: 'secret' } })
    await expect(findProfileSettings(supabaseClient, 'user-1')).rejects.toThrow(
      'Profile repository findProfileSettings failed with code PGRST116',
    )
  })
})

describe('updateProfileSettingsRow', () => {
  it('updates only the profile of the given user and never returns the encrypted api key', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClientReturning(profileSettingsRow)
    await updateProfileSettingsRow(supabaseClient, 'user-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: [],
      followUpDelayDays: 10,
    })
    expect(queryBuilder.update).toHaveBeenCalledWith({
      first_name: 'Ada',
      last_name: 'Lovelace',
      links: [],
      follow_up_delay_days: 10,
    })
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(queryBuilder.select.mock.calls[0][0]).not.toContain('encrypted_anthropic_api_key')
  })
})

describe('getDecryptedAnthropicApiKeyForUser', () => {
  const encryptionSecret = randomBytes(32).toString('base64')
  const originalEncryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET

  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = encryptionSecret
  })

  afterAll(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = originalEncryptionSecret
  })

  it('decrypts the stored key of the given user', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClientReturning({
      encrypted_anthropic_api_key: encryptApiKey('sk-ant-api03-abcd4f2a', encryptionSecret),
    })
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabaseClient)
    await expect(getDecryptedAnthropicApiKeyForUser('user-1')).resolves.toBe('sk-ant-api03-abcd4f2a')
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns null when the user has no key', async () => {
    const { supabaseClient } = createFakeSupabaseClientReturning({ encrypted_anthropic_api_key: null })
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabaseClient)
    await expect(getDecryptedAnthropicApiKeyForUser('user-1')).resolves.toBeNull()
  })
})
