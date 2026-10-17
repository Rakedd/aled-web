/**
 * @jest-environment node
 */
import { randomBytes } from 'node:crypto'
import { decryptApiKey } from '@/server/crypto/api-key-encryption'
import { storeEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { saveAnthropicApiKeyWithVerifier } from './save-anthropic-api-key-with-verifier'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ storeEncryptedAnthropicApiKey: jest.fn() }))

const encryptionSecret = randomBytes(32).toString('base64')
const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const originalEncryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_KEY_ENCRYPTION_SECRET = encryptionSecret
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'freelance@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(storeEncryptedAnthropicApiKey).mockResolvedValue(undefined)
})

afterAll(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = originalEncryptionSecret
})

describe('saveAnthropicApiKeyWithVerifier', () => {
  it.each(['sk-proj-abc', '', 42])('rejects %p without asking Claude or touching the database', async (invalidApiKey) => {
    const verifyApiKey = jest.fn()
    await expect(saveAnthropicApiKeyWithVerifier(invalidApiKey as string, verifyApiKey)).resolves.toEqual({
      ok: false,
      errorMessage: 'Une clé Claude commence par sk-ant-',
    })
    expect(verifyApiKey).not.toHaveBeenCalled()
    expect(storeEncryptedAnthropicApiKey).not.toHaveBeenCalled()
  })

  it('authenticates the user before asking Claude to verify the key', async () => {
    const verifyApiKey = jest.fn().mockResolvedValue(true)
    await saveAnthropicApiKeyWithVerifier('sk-ant-api03-abcd4f2a', verifyApiKey)
    expect(jest.mocked(getAuthenticatedUser).mock.invocationCallOrder[0]).toBeLessThan(
      verifyApiKey.mock.invocationCallOrder[0],
    )
  })

  it('stores the trimmed key encrypted for the authenticated user and returns its last four characters', async () => {
    const verifyApiKey = jest.fn().mockResolvedValue(true)
    await expect(saveAnthropicApiKeyWithVerifier('  sk-ant-api03-abcd4f2a ', verifyApiKey)).resolves.toEqual({
      ok: true,
      data: { lastFour: '4f2a' },
    })
    expect(verifyApiKey).toHaveBeenCalledWith('sk-ant-api03-abcd4f2a')
    const [supabaseClient, userId, encryptedAnthropicApiKey] = jest.mocked(storeEncryptedAnthropicApiKey).mock.calls[0]
    expect(supabaseClient).toBe(fakeSupabaseClient)
    expect(userId).toBe('user-1')
    expect(encryptedAnthropicApiKey.apiKeyLastFour).toBe('4f2a')
    expect(encryptedAnthropicApiKey.encryptedApiKey).not.toContain('sk-ant')
    expect(decryptApiKey(encryptedAnthropicApiKey.encryptedApiKey, encryptionSecret)).toBe('sk-ant-api03-abcd4f2a')
  })

  it('refuses a key that Claude rejects and stores nothing', async () => {
    const verifyApiKey = jest.fn().mockResolvedValue(false)
    await expect(saveAnthropicApiKeyWithVerifier('sk-ant-revoked', verifyApiKey)).resolves.toEqual({
      ok: false,
      errorMessage: 'Clé refusée par Claude : vérifie-la ou ton crédit',
    })
    expect(storeEncryptedAnthropicApiKey).not.toHaveBeenCalled()
  })

  it('asks to retry when Claude cannot be reached, without logging the key', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const verifyApiKey = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED sk-ant-secret-value'))
    await expect(saveAnthropicApiKeyWithVerifier('sk-ant-secret-value', verifyApiKey)).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de vérifier la clé pour le moment. Réessaie dans quelques minutes.',
    })
    expect(storeEncryptedAnthropicApiKey).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('sk-ant-secret-value')
    consoleErrorSpy.mockRestore()
  })

  it('reports a generic error when the encrypted key cannot be stored', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(storeEncryptedAnthropicApiKey).mockRejectedValue(new Error('Profile repository failed with code 42501'))
    await expect(saveAnthropicApiKeyWithVerifier('sk-ant-api03-abcd4f2a', jest.fn().mockResolvedValue(true))).resolves.toEqual({
      ok: false,
      errorMessage: "Impossible d'enregistrer la clé pour le moment. Réessaie dans quelques minutes.",
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
