import { act, renderHook } from '@testing-library/react'
import type { ContactListItem } from '@/domain/contacts'
import { useController } from './controller'

const buildContact = (overrides: Partial<ContactListItem>): ContactListItem => ({
  id: 'id',
  fullName: 'Contact',
  intermediaryId: null,
  intermediaryName: null,
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
  ...overrides,
})

const contacts = [
  buildContact({ id: 'a', fullName: 'Alice', lastExchangeAt: new Date('2026-10-01T10:00:00Z'), phone: '+33 6 12 34 56 78' }),
  buildContact({ id: 'b', fullName: 'Bob', lastExchangeAt: new Date('2026-10-10T10:00:00Z') }),
  buildContact({ id: 'c', fullName: 'Carole' }),
]

const getVisibleContactIds = (visibleContacts: ContactListItem[]) => visibleContacts.map(({ id }) => id)

describe('contacts-table useController', () => {
  it('sorts by last exchange descending at first', () => {
    const { result } = renderHook(() => useController({ contacts }))
    expect(result.current.sort).toEqual({ key: 'lastExchangeAt', direction: 'desc' })
    expect(getVisibleContactIds(result.current.visibleContacts)).toEqual(['b', 'a', 'c'])
  })

  it('filters by phone fragment', () => {
    const { result } = renderHook(() => useController({ contacts }))
    act(() => result.current.setQuery('06 12 34'))
    expect(getVisibleContactIds(result.current.visibleContacts)).toEqual(['a'])
  })

  it('keeps contacts without exchange last after reversing the sort', () => {
    const { result } = renderHook(() => useController({ contacts }))
    act(() => result.current.toggleSort('lastExchangeAt'))
    expect(result.current.sort).toEqual({ key: 'lastExchangeAt', direction: 'asc' })
    expect(getVisibleContactIds(result.current.visibleContacts)).toEqual(['a', 'b', 'c'])
  })
})
