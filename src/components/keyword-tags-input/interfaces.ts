import type { PillTone } from '@/components/pill/interfaces'

export type KeywordTagsInputProps = {
  label: string
  helpText: string
  values: string[]
  onChange: (values: string[]) => void
  tone: PillTone
  normalizeKey?: (term: string) => string
}

export type KeywordTagsInputControllerParameters = Pick<KeywordTagsInputProps, 'values' | 'onChange' | 'normalizeKey'>

export type KeywordDraftKeyboardEvent = {
  key: string
  preventDefault: () => void
}
