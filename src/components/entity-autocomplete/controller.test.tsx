import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { EntityKind, EntitySuggestion } from '@/domain/entities'
import { ENTITY_SEARCH_DEBOUNCE_MILLISECONDS, useController } from './controller'

const renderEntityAutocompleteController = ({
  entityKind = 'intermediary',
  searchResult = { ok: true, data: [] },
  allowsCreation = false,
}: { entityKind?: EntityKind; searchResult?: ActionResult<EntitySuggestion[]>; allowsCreation?: boolean } = {}) => {
  const onChange = jest.fn()
  const onSelectSuggestion = jest.fn()
  const searchEntities = jest.fn().mockResolvedValue(searchResult)
  const { result } = renderHook(() => useController({ entityKind, onChange, onSelectSuggestion, searchEntities, allowsCreation }))
  return { result, onChange, onSelectSuggestion, searchEntities }
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
      searchResult: { ok: true, data: [{ id: 'one', name: 'Free-Work', label: 'Free-Work', parentName: null, contactDetails: null }] },
    })
    act(() => result.current.changeValue('Free'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.suggestions).toEqual([{ id: 'one', name: 'Free-Work', label: 'Free-Work', parentName: null, contactDetails: null }])
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
      searchResult: { ok: true, data: [{ id: 'one', name: 'Free-Work', label: 'Free-Work', parentName: null, contactDetails: null }] },
    })
    act(() => result.current.changeValue('Free'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => result.current.selectSuggestion({ id: 'one', name: 'Free-Work', label: 'Free-Work', parentName: null, contactDetails: null }))
    expect(onChange).toHaveBeenLastCalledWith('Free-Work')
    expect(result.current.isOpen).toBe(false)
  })

  it('fills an end client with its structured name and reports the suggestion with its parent', () => {
    const { result, onChange, onSelectSuggestion } = renderEntityAutocompleteController({ entityKind: 'end_client' })
    const suggestion = { id: 'one', name: 'Thales', label: 'Thales (Défense)', parentName: 'Défense', contactDetails: null }
    act(() => result.current.selectSuggestion(suggestion))
    expect(onChange).toHaveBeenLastCalledWith('Thales')
    expect(onSelectSuggestion).toHaveBeenCalledWith(suggestion)
  })

  it('keeps a name containing parentheses when it has no parent', () => {
    const { result, onChange } = renderEntityAutocompleteController({ entityKind: 'end_client' })
    act(() =>
      result.current.selectSuggestion({ id: 'one', name: 'Thales (Défense)', label: 'Thales (Défense)', parentName: null, contactDetails: null }),
    )
    expect(onChange).toHaveBeenLastCalledWith('Thales (Défense)')
  })

  it('navigates the suggestions with the keyboard', async () => {
    const { result, onChange } = renderEntityAutocompleteController({
      searchResult: {
        ok: true,
        data: [
          { id: 'one', name: 'Alpha', label: 'Alpha', parentName: null, contactDetails: null },
          { id: 'two', name: 'Beta', label: 'Beta', parentName: null, contactDetails: null },
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
    await act(async () => resolveFirstSearch({ ok: true, data: [{ id: 'one', name: 'Old Corp', label: 'Old Corp', parentName: null, contactDetails: null }] }))
    expect(result.current.suggestions).toEqual([])
  })

  it('cancels the pending search when the list is closed by a blur or Escape', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    act(() => result.current.changeValue('Abc'))
    act(() => result.current.closeSuggestions())
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(searchEntities).not.toHaveBeenCalled()
  })

  it('keeps the list closed when a search resolves after a blur', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    let resolveSearch: (searchResult: ActionResult<EntitySuggestion[]>) => void = () => undefined
    searchEntities.mockReturnValueOnce(new Promise((resolve) => (resolveSearch = resolve)))
    act(() => result.current.changeValue('Abc'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => result.current.closeSuggestions())
    await act(async () =>
      resolveSearch({ ok: true, data: [{ id: 'one', name: 'Abc Corp', label: 'Abc Corp', parentName: null, contactDetails: null }] }),
    )
    expect(result.current.isOpen).toBe(false)
    expect(result.current.suggestions).toEqual([])
  })

  it('cancels the pending search on Escape', async () => {
    const { result, searchEntities } = renderEntityAutocompleteController()
    act(() => result.current.changeValue('Abc'))
    act(() => void result.current.handleKeyDown('Escape'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(searchEntities).not.toHaveBeenCalled()
    expect(result.current.isOpen).toBe(false)
  })

  it('offers to create the typed contact when no suggestion matches exactly', async () => {
    const { result } = renderEntityAutocompleteController({
      entityKind: 'contact',
      allowsCreation: true,
      searchResult: { ok: true, data: [{ id: 'one', name: 'Jeanne Martin', label: 'Jeanne Martin · Acme', parentName: null, contactDetails: null }] },
    })
    act(() => result.current.changeValue('Jeanne'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.creationOptionLabel).toBe('Créer « Jeanne »')
    expect(result.current.isOpen).toBe(true)
  })

  it('does not offer creation when a suggestion has the same normalized name', async () => {
    const { result } = renderEntityAutocompleteController({
      entityKind: 'contact',
      allowsCreation: true,
      searchResult: { ok: true, data: [{ id: 'one', name: 'Jeanne Martin', label: 'Jeanne Martin · Acme', parentName: null, contactDetails: null }] },
    })
    act(() => result.current.changeValue('  jeanne  MARTIN '))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.creationOptionLabel).toBeNull()
  })

  it('offers creation even when the search returns nothing', async () => {
    const { result } = renderEntityAutocompleteController({ entityKind: 'contact', allowsCreation: true })
    act(() => result.current.changeValue('Nouvelle Personne'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.creationOptionLabel).toBe('Créer « Nouvelle Personne »')
    expect(result.current.isOpen).toBe(true)
  })

  it('never offers creation when it is not allowed', async () => {
    const { result } = renderEntityAutocompleteController({ entityKind: 'contact' })
    act(() => result.current.changeValue('Nouvelle Personne'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    expect(result.current.creationOptionLabel).toBeNull()
  })

  it('closes the list without changing the value when the creation option is chosen with the keyboard', async () => {
    const { result, onChange } = renderEntityAutocompleteController({ entityKind: 'contact', allowsCreation: true })
    act(() => result.current.changeValue('Nouvelle Personne'))
    await advanceDebounce(ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
    act(() => void result.current.handleKeyDown('ArrowDown'))
    expect(result.current.highlightedIndex).toBe(0)
    act(() => void result.current.handleKeyDown('Enter'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(result.current.isOpen).toBe(false)
  })
})
