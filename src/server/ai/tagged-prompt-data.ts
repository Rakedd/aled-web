import 'server-only'
import { removeAngleBrackets } from '@/domain/client-brief'
import type { StackItem } from '@/domain/types'

const buildClosingTagPattern = (tagName: string): RegExp => new RegExp(`<\\s*/\\s*${tagName}\\s*>`, 'gi')

export const toTaggedNameOrNull = (tagName: string, name: string | null): string | null => {
  const sanitizedName = name === null ? '' : removeAngleBrackets(name)
  return sanitizedName === '' ? null : `<${tagName}>${sanitizedName}</${tagName}>`
}

export const toTaggedDocumentOrNull = (tagName: string, documentText: string | null): string | null => {
  const trimmedDocumentText = documentText?.trim() ?? ''
  if (trimmedDocumentText === '') return null
  const neutralisedDocumentText = trimmedDocumentText.replace(buildClosingTagPattern(tagName), tagName)
  return `<${tagName}>\n${neutralisedDocumentText}\n</${tagName}>`
}

export const toStackLine = (stackItem: StackItem): string =>
  `- ${removeAngleBrackets(stackItem.name)} (${stackItem.category})`

export const toTaggedStackOrNull = (stack: StackItem[]): string | null =>
  stack.length === 0 ? null : `<stack>\n${stack.map(toStackLine).join('\n')}\n</stack>`
