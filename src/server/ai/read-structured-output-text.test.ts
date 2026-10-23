/** @jest-environment node */
import type Anthropic from '@anthropic-ai/sdk'
import { AiError } from './ai-error'
import { readStructuredOutputText } from './read-structured-output-text'

jest.mock('server-only', () => ({}))

const buildMessage = (content: unknown[]): Anthropic.Message => ({ content }) as unknown as Anthropic.Message

describe('readStructuredOutputText', () => {
  it('answers the text of the first text block', () => {
    const message = buildMessage([
      { type: 'thinking', thinking: 'je réfléchis', signature: 'signature' },
      { type: 'text', text: '{"questions":[]}' },
      { type: 'text', text: 'second' },
    ])
    expect(readStructuredOutputText(message)).toBe('{"questions":[]}')
  })

  it('throws an unknown ai error when there is no text block', () => {
    const readWithoutTextBlock = () => readStructuredOutputText(buildMessage([{ type: 'thinking', thinking: '', signature: '' }]))
    expect(readWithoutTextBlock).toThrow(AiError)
    expect(readWithoutTextBlock).toThrow(expect.objectContaining({ kind: 'unknown' }))
  })
})
