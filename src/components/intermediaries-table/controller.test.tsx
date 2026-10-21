import { act, renderHook } from '@testing-library/react'
import type { IntermediaryListItem } from '@/domain/contacts'
import { useController } from './controller'

const buildIntermediary = (overrides: Partial<IntermediaryListItem>): IntermediaryListItem => ({
  id: 'id',
  name: 'Agence',
  kind: null,
  contactCount: 0,
  proposedMissionCount: 0,
  lastExchangeAt: null,
  ...overrides,
})

const intermediaries = [
  buildIntermediary({ id: 'a', name: 'Free-Work', lastExchangeAt: new Date('2026-10-01T10:00:00Z') }),
  buildIntermediary({ id: 'b', name: 'Malt', lastExchangeAt: new Date('2026-10-10T10:00:00Z') }),
  buildIntermediary({ id: 'c', name: 'Collective' }),
]

const getVisibleIntermediaryIds = (visibleIntermediaries: IntermediaryListItem[]) =>
  visibleIntermediaries.map(({ id }) => id)

describe('intermediaries-table useController', () => {
  it('sorts by last exchange descending at first', () => {
    const { result } = renderHook(() => useController({ intermediaries }))
    expect(result.current.sort).toEqual({ key: 'lastExchangeAt', direction: 'desc' })
    expect(getVisibleIntermediaryIds(result.current.visibleIntermediaries)).toEqual(['b', 'a', 'c'])
  })

  it('filters by name', () => {
    const { result } = renderHook(() => useController({ intermediaries }))
    act(() => result.current.setQuery('malt'))
    expect(getVisibleIntermediaryIds(result.current.visibleIntermediaries)).toEqual(['b'])
  })

  it('keeps agencies without exchange last after reversing the sort', () => {
    const { result } = renderHook(() => useController({ intermediaries }))
    act(() => result.current.toggleSort('lastExchangeAt'))
    expect(getVisibleIntermediaryIds(result.current.visibleIntermediaries)).toEqual(['a', 'b', 'c'])
  })
})
