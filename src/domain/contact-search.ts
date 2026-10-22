import type { ContactListItem, IntermediaryListItem } from './contacts'
import { normalizeEntityName } from './entity-names'

export type SortDirection = 'asc' | 'desc'

export type ListSort<SortKey extends string> = {
  key: SortKey
  direction: SortDirection
}

export type ContactsSortKey = 'fullName' | 'intermediaryName' | 'lastExchangeAt' | 'proposedMissionCount'

export type IntermediariesSortKey = 'name' | 'contactCount' | 'proposedMissionCount' | 'lastExchangeAt'

type SortableValue = string | number | Date | null

export const INITIAL_CONTACTS_SORT: ListSort<ContactsSortKey> = {
  key: 'lastExchangeAt',
  direction: 'desc',
}

export const INITIAL_INTERMEDIARIES_SORT: ListSort<IntermediariesSortKey> = {
  key: 'lastExchangeAt',
  direction: 'desc',
}

const MINIMUM_PHONE_SEARCH_DIGIT_COUNT = 3
const NON_DIGIT_PATTERN = /\D/g
const INTERNATIONAL_FRENCH_PREFIX_PATTERN = /^(?:0033|33)/
const INTERNATIONAL_QUERY_PATTERN = /^\s*(?:\+|00)/

export const toggleListSort = <SortKey extends string>(
  currentSort: ListSort<SortKey>,
  clickedKey: SortKey,
): ListSort<SortKey> => {
  if (currentSort.key !== clickedKey) return { key: clickedKey, direction: 'asc' }
  return {
    key: clickedKey,
    direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
  }
}

export const normalizePhoneNumberForSearch = (phoneNumber: string): string =>
  phoneNumber.replace(NON_DIGIT_PATTERN, '').replace(INTERNATIONAL_FRENCH_PREFIX_PATTERN, '0')

const matchesNormalizedText = (text: string | null, normalizedQuery: string): boolean =>
  text !== null && normalizeEntityName(text).includes(normalizedQuery)

const matchesPhoneNumber = (phoneNumber: string | null, query: string): boolean => {
  const queryDigits = query.replace(NON_DIGIT_PATTERN, '')
  if (phoneNumber === null || queryDigits.length < MINIMUM_PHONE_SEARCH_DIGIT_COUNT) return false
  const comparableQueryDigits = INTERNATIONAL_QUERY_PATTERN.test(query)
    ? normalizePhoneNumberForSearch(query)
    : queryDigits
  return normalizePhoneNumberForSearch(phoneNumber).includes(comparableQueryDigits)
}

export const filterContacts = (contacts: ContactListItem[], query: string): ContactListItem[] => {
  const normalizedQuery = normalizeEntityName(query)
  if (normalizedQuery === '') return contacts
  return contacts.filter(
    (contact) =>
      matchesNormalizedText(contact.fullName, normalizedQuery) ||
      matchesNormalizedText(contact.intermediaryName, normalizedQuery) ||
      matchesPhoneNumber(contact.phone, query),
  )
}

export const filterIntermediaries = (intermediaries: IntermediaryListItem[], query: string): IntermediaryListItem[] => {
  const normalizedQuery = normalizeEntityName(query)
  if (normalizedQuery === '') return intermediaries
  return intermediaries.filter((intermediary) => matchesNormalizedText(intermediary.name, normalizedQuery))
}

const compareNonNullValues = (
  firstValue: Exclude<SortableValue, null>,
  secondValue: Exclude<SortableValue, null>,
): number => {
  if (typeof firstValue === 'string' && typeof secondValue === 'string') {
    return firstValue.localeCompare(secondValue, 'fr', { sensitivity: 'base' })
  }
  const firstNumber = firstValue instanceof Date ? firstValue.getTime() : Number(firstValue)
  const secondNumber = secondValue instanceof Date ? secondValue.getTime() : Number(secondValue)
  return firstNumber - secondNumber
}

const sortByValue = <Item>(
  items: Item[],
  direction: SortDirection,
  getSortableValue: (item: Item) => SortableValue,
): Item[] => {
  const directionMultiplier = direction === 'asc' ? 1 : -1
  return [...items].sort((firstItem, secondItem) => {
    const firstValue = getSortableValue(firstItem)
    const secondValue = getSortableValue(secondItem)
    if (firstValue === null && secondValue === null) return 0
    if (firstValue === null) return 1
    if (secondValue === null) return -1
    return compareNonNullValues(firstValue, secondValue) * directionMultiplier
  })
}

export const sortContacts = (contacts: ContactListItem[], sort: ListSort<ContactsSortKey>): ContactListItem[] =>
  sortByValue(contacts, sort.direction, (contact) => contact[sort.key])

export const sortIntermediaries = (
  intermediaries: IntermediaryListItem[],
  sort: ListSort<IntermediariesSortKey>,
): IntermediaryListItem[] => sortByValue(intermediaries, sort.direction, (intermediary) => intermediary[sort.key])
