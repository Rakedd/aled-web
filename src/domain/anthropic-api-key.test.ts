import { formatMaskedAnthropicApiKey, hasAnthropicApiKeyFormat } from './anthropic-api-key'

describe('hasAnthropicApiKeyFormat', () => {
  it('accepts a value starting with sk-ant-', () => {
    expect(hasAnthropicApiKeyFormat('sk-ant-api03-abc')).toBe(true)
  })

  it.each(['', 'sk-proj-abc', 'sk-ant-abc def', `sk-ant-${'a'.repeat(300)}`])('rejects %p', (candidate) => {
    expect(hasAnthropicApiKeyFormat(candidate)).toBe(false)
  })
})

describe('formatMaskedAnthropicApiKey', () => {
  it('shows only the last four characters', () => {
    expect(formatMaskedAnthropicApiKey('4f2a')).toBe('sk-ant-…4f2a')
  })
})
