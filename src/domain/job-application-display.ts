import { STACK_CATEGORIES, STACK_CATEGORY_LABELS, type StackCategory, type StackItem } from './types'

export const MISSING_VALUE_LABEL = '—'

export const UNKNOWN_END_CLIENT_LABEL = 'Client inconnu'

export type StackCategoryGroup = { category: StackCategory; label: string; names: string[] }

const DAILY_RATE_NUMBER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const PHONE_HREF_FORBIDDEN_CHARACTERS_PATTERN = /[^\d+]/g

export const toDisplayText = (value: string | null): string =>
  value === null || value.trim().length === 0 ? MISSING_VALUE_LABEL : value

export const formatDailyRate = (dailyRate: number | null): string | null =>
  dailyRate === null ? null : `${DAILY_RATE_NUMBER_FORMAT.format(dailyRate)}\u00a0€`

export const toPhoneHref = (phone: string): string => `tel:${phone.replace(PHONE_HREF_FORBIDDEN_CHARACTERS_PATTERN, '')}`

export const groupStackByCategory = (stack: StackItem[]): StackCategoryGroup[] =>
  STACK_CATEGORIES.map((category) => ({
    category,
    label: STACK_CATEGORY_LABELS[category],
    names: stack.filter((stackItem) => stackItem.category === category).map((stackItem) => stackItem.name),
  })).filter((stackCategoryGroup) => stackCategoryGroup.names.length > 0)
