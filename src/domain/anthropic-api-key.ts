const ANTHROPIC_API_KEY_PREFIX = 'sk-ant-'
export const INVALID_ANTHROPIC_API_KEY_FORMAT_MESSAGE = 'Une clé Claude commence par sk-ant-'
export const REJECTED_ANTHROPIC_API_KEY_MESSAGE = 'Clé refusée par Claude : vérifie-la ou ton crédit'

const MAXIMUM_ANTHROPIC_API_KEY_LENGTH = 256
const WHITESPACE_PATTERN = /\s/

export const hasAnthropicApiKeyFormat = (candidateApiKey: string): boolean =>
  candidateApiKey.startsWith(ANTHROPIC_API_KEY_PREFIX) &&
  candidateApiKey.length <= MAXIMUM_ANTHROPIC_API_KEY_LENGTH &&
  !WHITESPACE_PATTERN.test(candidateApiKey)

export const formatMaskedAnthropicApiKey = (apiKeyLastFour: string): string =>
  `${ANTHROPIC_API_KEY_PREFIX}…${apiKeyLastFour}`
