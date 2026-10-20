import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from '@/domain/opportunity-filters'
import { useController } from './controller'

const savedFilters: OpportunityFilters = {
  ...EMPTY_OPPORTUNITY_FILTERS,
  includeKeywords: ['react'],
  rateFloorHybrid: 500,
}

const renderOpportunityFiltersFormController = (
  saveResult: ActionResult<OpportunityFilters> = {
    ok: true,
    data: savedFilters,
  },
) => {
  const saveOpportunityFilters = jest.fn().mockResolvedValue(saveResult)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({
      source: 'free-work',
      initialFilters: EMPTY_OPPORTUNITY_FILTERS,
      saveOpportunityFilters,
      onDataChanged,
    }),
  )
  return { result, saveOpportunityFilters, onDataChanged }
}

describe('opportunity-filters-form useController', () => {
  it('sends the validated filters, then reports success and notifies the page', async () => {
    const { result, saveOpportunityFilters, onDataChanged } = renderOpportunityFiltersFormController()
    act(() => result.current.setKeywordList('includeKeywords', ['react']))
    act(() => result.current.setRateFloorText('rateFloorHybrid', ' 500 '))
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).toHaveBeenCalledWith('free-work', savedFilters)
    expect(result.current.successMessage).toBe('Filtres enregistrés')
    expect(result.current.errorMessage).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses a non numeric rate floor on its own field without calling the server', async () => {
    const { result, saveOpportunityFilters, onDataChanged } = renderOpportunityFiltersFormController()
    act(() => result.current.setRateFloorText('rateFloorOnsite', 'abc'))
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).not.toHaveBeenCalled()
    expect(result.current.rateFloorErrors).toEqual({ rateFloorOnsite: 'Montant invalide' })
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('clears the field error when the field changes', async () => {
    const { result } = renderOpportunityFiltersFormController()
    act(() => result.current.setRateFloorText('rateFloorOnsite', 'abc'))
    await act(() => result.current.submit())
    act(() => result.current.setRateFloorText('rateFloorOnsite', '400'))
    expect(result.current.rateFloorErrors.rateFloorOnsite).toBeUndefined()
  })

  it.each([
    ['450 €', 450],
    ['1 000', 1000],
    ['1\u00a0000 €', 1000],
    ['1\u202f000\u00a0€', 1000],
  ])('accepts the formatted amount %p', async (rateFloorText, expectedRateFloor) => {
    const { result, saveOpportunityFilters } = renderOpportunityFiltersFormController()
    act(() => result.current.setRateFloorText('rateFloorHybrid', rateFloorText))
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      'free-work',
      expect.objectContaining({ rateFloorHybrid: expectedRateFloor }),
    )
  })

  it('refuses a rate floor above the maximum with the domain message', async () => {
    const { result, saveOpportunityFilters } = renderOpportunityFiltersFormController()
    act(() => result.current.setRateFloorText('rateFloorFullRemote', '6000'))
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Le TJM minimum doit être un entier entre 0 et 5000')
  })

  it('sends null for an empty rate floor', async () => {
    const { result, saveOpportunityFilters } = renderOpportunityFiltersFormController()
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).toHaveBeenCalledWith('free-work', EMPTY_OPPORTUNITY_FILTERS)
  })

  it('shows the generic error when the action throws', async () => {
    const saveOpportunityFilters = jest.fn().mockRejectedValue(new Error('Network down'))
    const onDataChanged = jest.fn()
    const { result } = renderHook(() =>
      useController({
        source: 'free-work',
        initialFilters: EMPTY_OPPORTUNITY_FILTERS,
        saveOpportunityFilters,
        onDataChanged,
      }),
    )
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSubmitting).toBe(false)
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('relays the server error message', async () => {
    const { result, onDataChanged } = renderOpportunityFiltersFormController({
      ok: false,
      errorMessage: 'Indisponible',
    })
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Indisponible')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('is disabled while sending and ignores a second submit', async () => {
    let resolveSave: (saveResult: ActionResult<OpportunityFilters>) => void = () => undefined
    const saveOpportunityFilters = jest.fn().mockReturnValue(
      new Promise<ActionResult<OpportunityFilters>>((resolve) => {
        resolveSave = resolve
      }),
    )
    const { result } = renderHook(() =>
      useController({
        source: 'free-work',
        initialFilters: EMPTY_OPPORTUNITY_FILTERS,
        saveOpportunityFilters,
        onDataChanged: jest.fn(),
      }),
    )
    let firstSubmission: Promise<void> = Promise.resolve()
    act(() => {
      firstSubmission = result.current.submit()
    })
    expect(result.current.isSubmitting).toBe(true)
    await act(() => result.current.submit())
    expect(saveOpportunityFilters).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveSave({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
      await firstSubmission
    })
    expect(result.current.isSubmitting).toBe(false)
  })

  it('adds a region with toggleRegion', () => {
    const { result } = renderOpportunityFiltersFormController()
    act(() => result.current.toggleRegion('Île-de-France'))
    expect(result.current.filters.regions).toEqual(['Île-de-France'])
  })

  it('removes a selected region whose normalized name matches with toggleRegion', () => {
    const saveOpportunityFilters = jest.fn()
    const { result } = renderHook(() =>
      useController({
        source: 'free-work',
        initialFilters: { ...EMPTY_OPPORTUNITY_FILTERS, regions: ['ile-de-france'] },
        saveOpportunityFilters,
        onDataChanged: jest.fn(),
      }),
    )
    act(() => result.current.toggleRegion('Île-de-France'))
    expect(result.current.filters.regions).toEqual([])
  })

  it('removes a selected region written with a curly apostrophe and hyphens with toggleRegion', () => {
    const { result } = renderHook(() =>
      useController({
        source: 'free-work',
        initialFilters: { ...EMPTY_OPPORTUNITY_FILTERS, regions: ['Provence-Alpes-Côte d’Azur'] },
        saveOpportunityFilters: jest.fn(),
        onDataChanged: jest.fn(),
      }),
    )
    act(() => result.current.toggleRegion("Provence Alpes Côte d'Azur"))
    expect(result.current.filters.regions).toEqual([])
  })
})
