import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { AiError } from './ai-error'

export const readStructuredOutputText = (response: Anthropic.Message): string => {
  const textBlock = response.content.find((contentBlock) => contentBlock.type === 'text')
  if (!textBlock) throw new AiError('unknown')
  return textBlock.text
}
