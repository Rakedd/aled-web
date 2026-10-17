import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { EntityKind, EntitySuggestion } from '@/domain/entities'
import { ENTITY_SEARCH_DEBOUNCE_MILLISECONDS, useController } from './controller'

const renderEntityAutocompleteController = ({
  entityKind = 'intermediary',
  searchResult = { ok: true, data: [] },
}: { entityKind?: EntityKind; searchResult?: ActionResult<EntitySuggestion[]> } = {}) => {
  const onChange = jest.fn()
  const searchEntities = jest.fn().mockResolvedValue(searchResult)
  const { result } = renderHook(() => useController({ entityKind, onChange, searchEntities }))
  return { result, onChange, searchEntities }
}

const advanceDebounce = (milliseconds: number) => act(() => jest.advanceTimersByTimeAsync(milliseconds))

describe('entity-autocomplete useController', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('searches only once the typing has paused for 250 ms', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    act(() => result.current.changeValue('Fr'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS - 1)
    act(() => result.current.changeValue('Free'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS - 1)
    expect(searchEntities).not.toHaveBeenCalled()
    await advanceDebounce(1)
    expect(searchEntities).toHaveBeenCalledTimes(1)
    expect(searchEntities).toHaveBeenCalledWith('intermediary', 'Free')
  })

  it('shows the suggestions returned by the search', async () => {
    const { result } = renderEntityAutocompleteController({
      searchResult: { ok: true, data: [{ id: 'one', label: 'Free-Work' }] },
    })
    act(() => result.current.changeValue('Free'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.suggestions).toEqual([{ id: 'one', label: 'Free-Work' }])
    expect(result.current.isOpen).toBe(true)
  })

  it('keeps free text possible when nothing matches', async () => {
    const { result, onChange } = renderEntityAutocompleteController()
    act(() => result.current.changeValue('Nouvelle ESN'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(onChange).toHaveBeenLastCalledWith('Nouvelle ESN')
    expect(result.current.suggestions).toEqual([])
    expect(result.current.isOpen).toBe(false)
  })

  it('keeps free text possible when the search fails or throws', async () => {
    const failing = renderEntityAutocompleteController({ searchResult: { ok: false, errorMessage: 'Indisponible' } })
    act(() => failing.result.current.changeValue('Abc'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(failing.onChange).toHaveBeenLastCalledWith('Abc')
    expect(failing.result.current.suggestions).toEqual([])
    const throwing = renderEntityAutocompleteController()
    throwing.searchEntities.mockRejectedValue(new Error('network'))
    act(() => throwing.result.current.changeValue('Abc'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(throwing.result.current.suggestions).toEqual([])
  })

  it('does not search for a blank value', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    act(() => result.current.changeValue('   '))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(searchEntities).not.toHaveBeenCalled()
  })

  it('fills the value with the chosen suggestion and closes the list', async () => {
    const { result, onChange } = renderEntityAutocompleteController({
      searchResult: { ok: true, data: [{ id: 'one', label: 'Free-Work' }] },
    })
    act(() => result.current.changeValue('Free'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => result.current.selectSuggestion({ id: 'one', label: 'Free-Work' }))
    expect(onChange).toHaveBeenLastCalledWith('Free-Work')
    expect(result.current.isOpen).toBe(false)
  })

  it('fills an end client with its own name, without the parent group', () => {
    const { result, onChange } = renderEntityAutocompleteController({ entityKind: 'end_client' })
    act(() => result.current.selectSuggestion({ id: 'one', label: 'Société Générale (Groupe SG)' }))
    expect(onChange).toHaveBeenLastCalledWith('Société Générale')
  })

  it('navigates the suggestions with the keyboard', async () => {
    const { result, onChange } = renderEntityAutocompleteController({
      searchResult: {
        ok: true,
        data: [
          { id: 'one', label: 'Alpha' },
          { id: 'two', label: 'Beta' },
        ],
      },
    })
    act(() => result.current.changeValue('a'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => void result.current.handleKeyDown('ArrowDown'))
    act(() => void result.current.handleKeyDown('ArrowDown'))
    expect(result.current.highlightedIndex).toBe(1)
    act(() => void result.current.handleKeyDown('Enter'))
    expect(onChange).toHaveBeenLastCalledWith('Beta')
  })

  it('ignores a late search result that was superseded', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    let resolveFirstSearch: (searchResult: ActionResult<EntitySuggestion[]>) => void = () => undefined
    searchEntities.mockReturnValueOnce(new Promise((resolve) => (resolveFirstSearch = resolve)))
    act(() => result.current.changeValue('Old'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => result.current.changeValue(''))
    await act(async () => resolveFirstSearch({ ok: true, data: [{ id: 'one', label: 'Old Corp' }] }))
    expect(result.current.suggestions).toEqual([])
  })
})
