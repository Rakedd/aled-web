import { randomUUID } from 'node:crypto'
import {
  clearAnthropicApiKey,
  findEncryptedAnthropicApiKey,
  findProfileSettings,
  storeEncryptedAnthropicApiKey,
  updateProfileSettingsRow,
} from '@/server/repositories/profile-repository'
import { createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))

describe('profile repository', () => {
  it('reads the default settings of a new user without exposing any api key', async () => {
    const email = `settings-${randomUUID()}@test.local`
    const user = await createSignedInTestClient(email)
    await expect(findProfileSettings(user.client, user.userId)).resolves.toEqual({
      firstName: '',
      lastName: '',
      email,
      links: [],
      followUpDelayDays: 7,
      anthropicApiKeyLastFour: null,
    })
  })

  it('updates the profile settings of the user', async () => {
    const user = await createSignedInTestClient(`settings-${randomUUID()}@test.local`)
    const updatedProfileSettings = await updateProfileSettingsRow(user.client, user.userId, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
      followUpDelayDays: 14,
    })
    expect(updatedProfileSettings).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
      followUpDelayDays: 14,
    })
    await expect(findProfileSettings(user.client, user.userId)).resolves.toEqual(updatedProfileSettings)
  })

  it('stores, reads back and clears the encrypted api key of the user', async () => {
    const user = await createSignedInTestClient(`settings-${randomUUID()}@test.local`)
    await storeEncryptedAnthropicApiKey(user.client, user.userId, { encryptedApiKey: 'v1:iv:tag:cipher', apiKeyLastFour: '4f2a' })
    await expect(findEncryptedAnthropicApiKey(user.client, user.userId)).resolves.toBe('v1:iv:tag:cipher')
    await expect(findProfileSettings(user.client, user.userId)).resolves.toMatchObject({ anthropicApiKeyLastFour: '4f2a' })

    await clearAnthropicApiKey(user.client, user.userId)
    await expect(findEncryptedAnthropicApiKey(user.client, user.userId)).resolves.toBeNull()
    await expect(findProfileSettings(user.client, user.userId)).resolves.toMatchObject({ anthropicApiKeyLastFour: null })
  })

  it('never lets a user read or overwrite the api key of another user', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    await storeEncryptedAnthropicApiKey(userA.client, userA.userId, { encryptedApiKey: 'v1:a:a:a', apiKeyLastFour: 'aaaa' })

    await expect(findEncryptedAnthropicApiKey(userB.client, userA.userId)).resolves.toBeNull()
    await expect(
      storeEncryptedAnthropicApiKey(userB.client, userA.userId, { encryptedApiKey: 'v1:b:b:b', apiKeyLastFour: 'bbbb' }),
    ).rejects.toThrow()
    await expect(findEncryptedAnthropicApiKey(userA.client, userA.userId)).resolves.toBe('v1:a:a:a')
  })
})
