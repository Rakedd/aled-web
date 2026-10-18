import { AI_ERROR_MESSAGES } from './ai-errors'
import { CLIENT_BRIEF_AI_ERROR_MESSAGES, CLIENT_BRIEF_MESSAGES } from './client-brief'
import { PROFILE_SETTINGS_VALIDATION_MESSAGES } from './profile-settings'

const exportedMessageGroups = {
  AI_ERROR_MESSAGES,
  CLIENT_BRIEF_AI_ERROR_MESSAGES,
  CLIENT_BRIEF_MESSAGES,
  PROFILE_SETTINGS_VALIDATION_MESSAGES,
}

describe('user-facing messages', () => {
  it.each(Object.entries(exportedMessageGroups))('%s never mention « réglages »', (_groupName, messages) => {
    Object.values(messages).forEach((message) => {
      expect(message.toLowerCase()).not.toContain('réglages')
    })
  })

  it('points to the preferences when a Claude key is missing or invalid', () => {
    expect(AI_ERROR_MESSAGES.missing_api_key).toContain('dans tes préférences')
    expect(AI_ERROR_MESSAGES.invalid_api_key).toContain('dans tes préférences')
    expect(CLIENT_BRIEF_AI_ERROR_MESSAGES.missing_api_key).toContain('dans tes préférences')
  })
})
