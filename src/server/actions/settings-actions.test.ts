/**
 * @jest-environment node
 */
import type { ProfileSettings } from '@/domain/profile-settings'
import { verifyAnthropicApiKey } from '@/server/ai/verify-anthropic-api-key'
import { clearAnthropicApiKey, findProfileSettings, updateProfileSettingsRow } from '@/server/repositories/profile-repository'
import { saveAnthropicApiKeyWithVerifier } from '@/server/settings/save-anthropic-api-key-with-verifier'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import {
  deleteAnthropicApiKey,
  getProfileSettings,
  hasAnthropicApiKeyConfigured,
  saveAnthropicApiKey,
  updateProfileSettings,
} from './settings-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/ai/verify-anthropic-api-key', () => ({ verifyAnthropicApiKey: jest.fn() }))
jest.mock('@/server/settings/save-anthropic-api-key-with-verifier', () => ({ saveAnthropicApiKeyWithVerifier: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({
  findProfileSettings: jest.fn(),
  updateProfileSettingsRow: jest.fn(),
  clearAnthropicApiKey: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>

const storedProfileSettings: ProfileSettings = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  links: [],
  followUpDelayDays: 7,
  anthropicApiKeyLastFour: '4f2a',
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
})

describe('getProfileSettings', () => {
  it('returns the settings of the authenticated user', async () => {
    jest.mocked(findProfileSettings).mockResolvedValue(storedProfileSettings)
    await expect(getProfileSettings()).resolves.toEqual({ ok: true, data: storedProfileSettings })
    expect(findProfileSettings).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('reports a generic error when the settings cannot be read', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(findProfileSettings).mockRejectedValue(new Error('Profile repository failed'))
    await expect(getProfileSettings()).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de charger tes réglages pour le moment. Réessaie dans quelques minutes.',
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})

describe('hasAnthropicApiKeyConfigured', () => {
  it('is true when the authenticated user has stored a key', async () => {
    jest.mocked(findProfileSettings).mockResolvedValue(storedProfileSettings)
    await expect(hasAnthropicApiKeyConfigured()).resolves.toBe(true)
    expect(findProfileSettings).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('is false when the authenticated user has no key', async () => {
    jest.mocked(findProfileSettings).mockResolvedValue({ ...storedProfileSettings, anthropicApiKeyLastFour: null })
    await expect(hasAnthropicApiKeyConfigured()).resolves.toBe(false)
  })

  it('stays true when the settings cannot be read, so the AI actions report the real problem themselves', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(findProfileSettings).mockRejectedValue(new Error('Profile repository failed'))
    await expect(hasAnthropicApiKeyConfigured()).resolves.toBe(true)
    consoleErrorSpy.mockRestore()
  })
})

describe('updateProfileSettings', () => {
  it('rejects invalid settings without touching the database', async () => {
    await expect(
      updateProfileSettings({ firstName: 'Ada', lastName: 'Lovelace', links: [], followUpDelayDays: 90 }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Entre 1 et 60 jours' })
    expect(updateProfileSettingsRow).not.toHaveBeenCalled()
  })

  it('saves the validated settings for the authenticated user', async () => {
    jest.mocked(updateProfileSettingsRow).mockResolvedValue(storedProfileSettings)
    await expect(
      updateProfileSettings({ firstName: ' Ada ', lastName: 'Lovelace', links: [], followUpDelayDays: 7 }),
    ).resolves.toEqual({ ok: true, data: storedProfileSettings })
    expect(updateProfileSettingsRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: [],
      followUpDelayDays: 7,
    })
  })

  it('reports a generic error when the settings cannot be saved', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(updateProfileSettingsRow).mockRejectedValue(new Error('Profile repository failed'))
    await expect(
      updateProfileSettings({ firstName: 'Ada', lastName: 'Lovelace', links: [], followUpDelayDays: 7 }),
    ).resolves.toEqual({
      ok: false,
      errorMessage: "Impossible d'enregistrer tes réglages pour le moment. Réessaie dans quelques minutes.",
    })
    consoleErrorSpy.mockRestore()
  })
})

describe('saveAnthropicApiKey', () => {
  it('verifies the key with Claude before saving it', async () => {
    jest.mocked(saveAnthropicApiKeyWithVerifier).mockResolvedValue({ ok: true, data: { lastFour: '4f2a' } })
    await expect(saveAnthropicApiKey('sk-ant-api03-abcd4f2a')).resolves.toEqual({ ok: true, data: { lastFour: '4f2a' } })
    expect(saveAnthropicApiKeyWithVerifier).toHaveBeenCalledWith('sk-ant-api03-abcd4f2a', verifyAnthropicApiKey)
  })
})

describe('deleteAnthropicApiKey', () => {
  it('clears the key of the authenticated user', async () => {
    jest.mocked(clearAnthropicApiKey).mockResolvedValue(undefined)
    await expect(deleteAnthropicApiKey()).resolves.toEqual({ ok: true, data: null })
    expect(clearAnthropicApiKey).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('reports a generic error when the key cannot be deleted', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(clearAnthropicApiKey).mockRejectedValue(new Error('Profile repository failed'))
    await expect(deleteAnthropicApiKey()).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de supprimer la clé pour le moment. Réessaie dans quelques minutes.',
    })
    consoleErrorSpy.mockRestore()
  })
})
