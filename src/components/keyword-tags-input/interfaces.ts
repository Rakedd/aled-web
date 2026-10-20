import type { PillTone } from '@/components/pill/interfaces'

export type KeywordTagsInputProps = {
  label: string
  helpText: string
  values: string[]
  onChange: (values: string[]) => void
  tone: PillTone
}

export type KeywordTagsInputControllerParameters = Pick<KeywordTagsInputProps, 'values' | 'onChange'>

export type KeywordDraftKeyboardEvent = {
  key: string
  preventDefault: () => void
}
