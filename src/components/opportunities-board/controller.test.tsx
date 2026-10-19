import { act, renderHook, waitFor } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import {
  NO_OPPORTUNITY_QUICK_FILTERS,
  type OpportunityListing,
  type OpportunityListingCursor,
  type OpportunityListItem,
} from '@/domain/opportunities'
import { useController } from './controller'

const buildOpportunity = (id: string, overrides: Partial<OpportunityListItem> = {}): OpportunityListItem => ({
  id,
  source: 'free-work',
  externalId: `external-${id}`,
  url: `https://www.free-work.com/${id}`,
  title: `Mission ${id}`,
  company: null,
  description: null,
  rateMin: null,
  rateMax: null,
  rateLabel: null,
  currency: null,
  remoteMode: null,
  locationLabel: null,
  region: null,
  country: null,
  durationMonths: null,
  publishedAt: new Date('2026-10-18T08:00:00Z'),
  skills: [],
  receivedAt: new Date('2026-10-18T09:00:00Z'),
  decision: null,
  jobApplicationId: null,
  ...overrides,
})

const buildListing = (overrides: Partial<OpportunityListing> = {}): OpportunityListing => ({
  items: [buildOpportunity('first'), buildOpportunity('second')],
  hasMore: true,
  counts: { to_process: 2, applied: 0, dismissed: 0 },
  lastReceivedAt: new Date('2026-10-18T09:00:00Z'),
  lastViewedAt: null,
  ...overrides,
})

const succeeded = <T,>(data: T): ActionResult<T> => ({ ok: true, data })

const renderBoardController = (listingOverrides: Partial<OpportunityListing> = {}) => {
  const listOpportunities = jest.fn().mockResolvedValue(succeeded(buildListing()))
  const applyToOpportunity = jest.fn().mockResolvedValue(succeeded({ jobApplicationId: 'application-1' }))
  const dismissOpportunity = jest.fn().mockResolvedValue(succeeded(null))
  const restoreOpportunity = jest.fn().mockResolvedValue(succeeded(null))
  const markOpportunitiesViewed = jest.fn().mockResolvedValue(succeeded(null))
  const onDataChanged = jest.fn()
  const onTabChanged = jest.fn()
  const { result, rerender, unmount } = renderHook(
    ({ initialListing }: { initialListing: OpportunityListing }) =>
      useController({
      initialTab: 'to_process',
      initialListing,
      listOpportunities,
      applyToOpportunity,
      dismissOpportunity,
      restoreOpportunity,
      markOpportunitiesViewed,
      onDataChanged,
      onTabChanged,
    }),
    { initialProps: { initialListing: buildListing(listingOverrides) } },
  )
  return {
    result,
    rerender,
    unmount,
    listOpportunities,
    applyToOpportunity,
    dismissOpportunity,
    restoreOpportunity,
    markOpportunitiesViewed,
    onDataChanged,
    onTabChanged,
  }
}

describe('opportunities-board useController', () => {
  it('marks the opportunities as viewed once on mount', () => {
    const { markOpportunitiesViewed } = renderBoardController()
    expect(markOpportunitiesViewed).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['refuses', () => Promise.resolve({ ok: false, errorMessage: 'Visite refusée' }), 'Visite refusée'],
    ['throws', () => Promise.reject(new Error('network')), new Error('network')],
  ])('logs an error when marking as viewed %s', async (_label, respond, expectedLog) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const markOpportunitiesViewed = jest.fn().mockImplementation(respond)
    renderHook(() =>
      useController({
        initialTab: 'to_process',
        initialListing: buildListing(),
        listOpportunities: jest.fn(),
        applyToOpportunity: jest.fn(),
        dismissOpportunity: jest.fn(),
        restoreOpportunity: jest.fn(),
        markOpportunitiesViewed,
        onDataChanged: jest.fn(),
        onTabChanged: jest.fn(),
      }),
    )
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(expectedLog))
    consoleError.mockRestore()
  })

  it('keeps the new badges frozen when the server sends a later lastViewedAt', () => {
    const { result, rerender } = renderBoardController()
    const firstItem = result.current.items[0]
    expect(result.current.isOpportunityNew(firstItem)).toBe(true)
    rerender({ initialListing: buildListing({ lastViewedAt: new Date('2026-10-18T12:00:00Z') }) })
    expect(result.current.isOpportunityNew(firstItem)).toBe(true)
  })

  it('flags only items received after lastViewedAt as new', () => {
    const { result } = renderBoardController({ lastViewedAt: new Date('2026-10-18T09:30:00Z') })
    expect(result.current.isOpportunityNew(result.current.items[0])).toBe(false)
    expect(result.current.isOpportunityNew(buildOpportunity('late', { receivedAt: new Date('2026-10-18T10:00:00Z') }))).toBe(true)
  })

  it('blocks tab switching while an opportunity action is in flight', async () => {
    const { result, applyToOpportunity, listOpportunities } = renderBoardController()
    applyToOpportunity.mockReturnValue(new Promise(() => undefined))
    act(() => {
      void result.current.applyTo(result.current.items[0])
    })
    expect(result.current.isAnyOpportunityPending).toBe(true)
    await act(() => result.current.selectTab('applied'))
    expect(listOpportunities).not.toHaveBeenCalled()
  })

  it('never skips an item when « Voir plus » follows many dismissals', async () => {
    const serverItems = Array.from({ length: 120 }, (_, index) =>
      buildOpportunity(`item-${String(index).padStart(3, '0')}`, {
        publishedAt: new Date(Date.UTC(2026, 9, 18, 8) - index * 60_000),
      }),
    )
    const dismissedIds = new Set<string>()
    const isAfterCursor = (item: OpportunityListItem, cursor: OpportunityListingCursor | null): boolean =>
      cursor === null ||
      item.publishedAt.getTime() < new Date(cursor.publishedAt).getTime() ||
      (item.publishedAt.getTime() === new Date(cursor.publishedAt).getTime() && item.id < cursor.id)
    const serverPage = (cursor: OpportunityListingCursor | null) => {
      const remainingItems = serverItems.filter(({ id }) => !dismissedIds.has(id))
      const itemsAfterCursor = remainingItems.filter((item) => isAfterCursor(item, cursor))
      return succeeded(buildListing({ items: itemsAfterCursor.slice(0, 50), hasMore: itemsAfterCursor.length > 50 }))
    }
    const { result, listOpportunities, dismissOpportunity } = renderBoardController({
      items: serverItems.slice(0, 50),
      counts: { to_process: 120, applied: 0, dismissed: 0 },
    })
    listOpportunities.mockImplementation((_tab, cursor: OpportunityListingCursor | null) =>
      Promise.resolve(serverPage(cursor)),
    )
    dismissOpportunity.mockImplementation((opportunityId: string) => {
      dismissedIds.add(opportunityId)
      return Promise.resolve(succeeded(null))
    })
    const dismissFirstVisibleItems = async (count: number) => {
      for (const item of result.current.items.slice(0, count)) {
        await act(() => result.current.dismiss(item))
      }
    }

    await dismissFirstVisibleItems(45)
    await act(() => result.current.loadMore())
    await dismissFirstVisibleItems(45)
    await act(() => result.current.loadMore())

    expect(listOpportunities).toHaveBeenNthCalledWith(1, 'to_process', {
      publishedAt: serverItems[49].publishedAt.toISOString(),
      id: 'item-049',
      rate: null,
    }, '', NO_OPPORTUNITY_QUICK_FILTERS)
    expect(listOpportunities).toHaveBeenNthCalledWith(2, 'to_process', {
      publishedAt: serverItems[99].publishedAt.toISOString(),
      id: 'item-099',
      rate: null,
    }, '', NO_OPPORTUNITY_QUICK_FILTERS)
    const remainingIds = serverItems.map(({ id }) => id).filter((id) => !dismissedIds.has(id))
    expect(dismissedIds.size).toBe(90)
    expect(result.current.items.map(({ id }) => id)).toEqual(remainingIds)
    expect(result.current.hasMore).toBe(false)
  })

  it('applies only once despite two clicks, then exposes the job application id and refreshes', async () => {
    const { result, applyToOpportunity, onDataChanged } = renderBoardController()
    await act(async () => {
      void result.current.applyTo(result.current.items[0])
      void result.current.applyTo(result.current.items[0])
    })
    expect(applyToOpportunity).toHaveBeenCalledTimes(1)
    expect(applyToOpportunity).toHaveBeenCalledWith('first')
    expect(result.current.items[0].jobApplicationId).toBe('application-1')
    expect(result.current.counts).toEqual({ to_process: 1, applied: 1, dismissed: 0 })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('removes a dismissed card before the server answers', () => {
    const { result, dismissOpportunity } = renderBoardController()
    dismissOpportunity.mockReturnValue(new Promise(() => undefined))
    act(() => {
      void result.current.dismiss(result.current.items[0])
    })
    expect(result.current.items.map(({ id }) => id)).toEqual(['second'])
    expect(result.current.counts).toEqual({ to_process: 1, applied: 0, dismissed: 1 })
  })

  it('puts the card back with the error message when dismissing fails', async () => {
    const { result, dismissOpportunity, onDataChanged } = renderBoardController()
    dismissOpportunity.mockResolvedValue({ ok: false, errorMessage: 'Impossible de décider' })
    await act(() => result.current.dismiss(result.current.items[0]))
    expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second'])
    expect(result.current.counts).toEqual({ to_process: 2, applied: 0, dismissed: 0 })
    expect(result.current.errorMessage).toBe('Impossible de décider')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error message when an action throws', async () => {
    const { result, dismissOpportunity, applyToOpportunity } = renderBoardController()
    dismissOpportunity.mockRejectedValue(new Error('network'))
    await act(() => result.current.dismiss(result.current.items[0]))
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.items).toHaveLength(2)
    applyToOpportunity.mockRejectedValue(new Error('network'))
    await act(() => result.current.applyTo(result.current.items[1]))
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.items[1].jobApplicationId).toBeNull()
  })

  it('removes a restored card from the dismissed tab', async () => {
    const { result, listOpportunities, restoreOpportunity, onDataChanged } = renderBoardController()
    listOpportunities.mockResolvedValue(
      succeeded(
        buildListing({
          items: [buildOpportunity('old', { decision: 'dismissed' })],
          counts: { to_process: 0, applied: 0, dismissed: 1 },
        }),
      ),
    )
    await act(() => result.current.selectTab('dismissed'))
    await act(() => result.current.restore(result.current.items[0]))
    expect(restoreOpportunity).toHaveBeenCalledWith('old')
    expect(result.current.items).toEqual([])
    expect(result.current.counts).toEqual({ to_process: 1, applied: 0, dismissed: 0 })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('appends the next page on load more', async () => {
    const { result, listOpportunities } = renderBoardController()
    listOpportunities.mockResolvedValue(
      succeeded(buildListing({ items: [buildOpportunity('third')], hasMore: false })),
    )
    await act(() => result.current.loadMore())
    expect(listOpportunities).toHaveBeenCalledWith('to_process', {
      publishedAt: '2026-10-18T08:00:00.000Z',
      id: 'second',
      rate: null,
    }, '', NO_OPPORTUNITY_QUICK_FILTERS)
    expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
    expect(result.current.hasMore).toBe(false)
  })

  it('carries the effective rate of the last loaded item in the cursor', async () => {
    const { result, listOpportunities } = renderBoardController({
      items: [buildOpportunity('rated', { rateMin: 600, rateMax: 650 })],
    })
    listOpportunities.mockResolvedValue(succeeded(buildListing({ items: [], hasMore: false })))

    await act(() => result.current.loadMore())

    expect(listOpportunities).toHaveBeenCalledWith('to_process', expect.objectContaining({ id: 'rated', rate: 650 }), '', NO_OPPORTUNITY_QUICK_FILTERS)
  })

  it('reloads the first page when the tab changes', async () => {
    const { result, listOpportunities, onTabChanged } = renderBoardController()
    listOpportunities.mockResolvedValue(
      succeeded(
        buildListing({
          items: [buildOpportunity('done', { decision: 'applied', jobApplicationId: 'application-9' })],
          hasMore: false,
          counts: { to_process: 2, applied: 1, dismissed: 0 },
        }),
      ),
    )
    await act(() => result.current.selectTab('applied'))
    expect(listOpportunities).toHaveBeenCalledWith('applied', null, '', NO_OPPORTUNITY_QUICK_FILTERS)
    expect(result.current.tab).toBe('applied')
    expect(result.current.items.map(({ id }) => id)).toEqual(['done'])
    expect(onTabChanged).toHaveBeenCalledWith('applied')
  })

  it('keeps the current tab and shows the error when the reload fails', async () => {
    const { result, listOpportunities } = renderBoardController()
    listOpportunities.mockResolvedValue({ ok: false, errorMessage: 'Chargement impossible' })
    await act(() => result.current.selectTab('applied'))
    expect(result.current.tab).toBe('to_process')
    expect(result.current.errorMessage).toBe('Chargement impossible')
  })

  it('flags an opportunity as pending while its action is in flight', async () => {
    const { result, applyToOpportunity } = renderBoardController()
    let resolveApplication: (actionResult: ActionResult<{ jobApplicationId: string }>) => void = () => undefined
    applyToOpportunity.mockReturnValue(new Promise((resolve) => (resolveApplication = resolve)))
    let applying: Promise<void> = Promise.resolve()
    act(() => {
      applying = result.current.applyTo(result.current.items[0])
    })
    expect(result.current.isOpportunityPending('first')).toBe(true)
    expect(result.current.isOpportunityPending('second')).toBe(false)
    await act(async () => {
      resolveApplication({ ok: true, data: { jobApplicationId: 'application-1' } })
      await applying
    })
    expect(result.current.isOpportunityPending('first')).toBe(false)
  })

  describe('search', () => {
    const SEARCH_DEBOUNCE_IN_MILLISECONDS = 300

    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    const typeSearch = (result: ReturnType<typeof renderBoardController>['result'], value: string) =>
      act(() => {
        result.current.changeSearch(value)
      })

    const advanceDebounce = (milliseconds = SEARCH_DEBOUNCE_IN_MILLISECONDS) =>
      act(async () => {
        await jest.advanceTimersByTimeAsync(milliseconds)
      })

    it('shows the typed value immediately but only queries after 300 ms of silence', async () => {
      const { result, listOpportunities } = renderBoardController()

      typeSearch(result, 'rea')
      await advanceDebounce(200)
      typeSearch(result, 'react')
      await advanceDebounce(299)

      expect(result.current.searchInput).toBe('react')
      expect(listOpportunities).not.toHaveBeenCalled()

      await advanceDebounce(1)

      expect(listOpportunities).toHaveBeenCalledTimes(1)
      expect(listOpportunities).toHaveBeenCalledWith('to_process', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
    })

    it('trims the search and replaces the list from the start', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockResolvedValue(
        succeeded(
          buildListing({
            items: [buildOpportunity('found')],
            hasMore: false,
            counts: { to_process: 1, applied: 0, dismissed: 0 },
          }),
        ),
      )

      typeSearch(result, '  react  ')
      await advanceDebounce()

      expect(listOpportunities).toHaveBeenCalledWith('to_process', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(result.current.items.map(({ id }) => id)).toEqual(['found'])
      expect(result.current.counts).toEqual({ to_process: 1, applied: 0, dismissed: 0 })
      expect(result.current.hasMore).toBe(false)
      expect(result.current.hasActiveSearch).toBe(true)
    })

    it('does not query when the trimmed search did not change', async () => {
      const { result, listOpportunities } = renderBoardController()

      typeSearch(result, '   ')
      await advanceDebounce()

      expect(listOpportunities).not.toHaveBeenCalled()
    })

    it('ignores the response of an outdated search', async () => {
      const { result, listOpportunities } = renderBoardController()
      let resolveFirstSearch: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
      listOpportunities
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirstSearch = resolve)))
        .mockResolvedValueOnce(
          succeeded(buildListing({ items: [buildOpportunity('latest')], hasMore: false })),
        )

      typeSearch(result, 'java')
      await advanceDebounce()
      typeSearch(result, 'react')
      await advanceDebounce()
      await act(async () => {
        resolveFirstSearch(succeeded(buildListing({ items: [buildOpportunity('outdated')], hasMore: false })))
      })

      expect(listOpportunities).toHaveBeenNthCalledWith(1, 'to_process', null, 'java', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(listOpportunities).toHaveBeenNthCalledWith(2, 'to_process', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(result.current.items.map(({ id }) => id)).toEqual(['latest'])
      expect(result.current.isLoadingListing).toBe(false)
    })

    it('ignores a search still in flight when the input returns to the applied search', async () => {
      const { result, listOpportunities } = renderBoardController()
      let resolveSearch: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
      listOpportunities.mockReturnValueOnce(new Promise((resolve) => (resolveSearch = resolve)))
      typeSearch(result, 'java')
      await advanceDebounce()

      typeSearch(result, '')
      await act(async () => {
        resolveSearch(succeeded(buildListing({ items: [buildOpportunity('outdated')], hasMore: false })))
      })

      expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second'])
      expect(result.current.isLoadingListing).toBe(false)
    })

    it('restores the full list immediately when the search is cleared', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockResolvedValueOnce(
        succeeded(buildListing({ items: [buildOpportunity('found')], hasMore: false })),
      )
      typeSearch(result, 'react')
      await advanceDebounce()
      listOpportunities.mockResolvedValueOnce(succeeded(buildListing()))

      typeSearch(result, '')
      await advanceDebounce(0)

      expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, '', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second'])
      expect(result.current.hasActiveSearch).toBe(false)
    })

    it('keeps the search when the tab changes and when loading more', async () => {
      const { result, listOpportunities } = renderBoardController()
      typeSearch(result, 'react')
      await advanceDebounce()

      await act(() => result.current.selectTab('applied'))
      await act(() => result.current.loadMore())

      expect(listOpportunities).toHaveBeenNthCalledWith(2, 'applied', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(listOpportunities).toHaveBeenNthCalledWith(
        3,
        'applied',
        { publishedAt: '2026-10-18T08:00:00.000Z', id: 'second', rate: null },
        'react',
        NO_OPPORTUNITY_QUICK_FILTERS,
      )
    })

    it('searches in the tab selected while the input was being debounced', async () => {
      const { result, listOpportunities } = renderBoardController()
      typeSearch(result, 'react')
      await act(() => result.current.selectTab('dismissed'))
      await advanceDebounce()

      expect(listOpportunities).toHaveBeenLastCalledWith('dismissed', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
    })

    it('ends on the requested tab with the search applied when the debounce fires during the tab request', async () => {
      const { result, listOpportunities, onTabChanged } = renderBoardController()
      let resolveTabRequest: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
      listOpportunities
        .mockReturnValueOnce(new Promise((resolve) => (resolveTabRequest = resolve)))
        .mockResolvedValueOnce(succeeded(buildListing({ items: [buildOpportunity('searched')], hasMore: false })))
      typeSearch(result, 'react')

      let selectingTab: Promise<void> = Promise.resolve()
      act(() => {
        selectingTab = result.current.selectTab('applied')
      })
      await advanceDebounce()
      await act(async () => {
        resolveTabRequest(succeeded(buildListing({ items: [buildOpportunity('unsearched')], hasMore: false })))
        await selectingTab
      })

      expect(listOpportunities).toHaveBeenNthCalledWith(2, 'applied', null, 'react', NO_OPPORTUNITY_QUICK_FILTERS)
      expect(result.current.tab).toBe('applied')
      expect(result.current.items.map(({ id }) => id)).toEqual(['searched'])
      expect(onTabChanged).toHaveBeenCalledWith('applied')
      expect(result.current.hasActiveSearch).toBe(true)
    })

    it('shows the error and keeps the list when the search fails', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockResolvedValue({ ok: false, errorMessage: 'La recherche ne peut pas dépasser 100 caractères' })

      typeSearch(result, 'react')
      await advanceDebounce()

      expect(result.current.errorMessage).toBe('La recherche ne peut pas dépasser 100 caractères')
      expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second'])
    })

    it('shows the generic error when the search throws', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockRejectedValue(new Error('network'))

      typeSearch(result, 'react')
      await advanceDebounce()

      expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    })

    it('cancels the pending search on unmount', async () => {
      const { result, listOpportunities, unmount } = renderBoardController()
      typeSearch(result, 'react')

      unmount()
      await advanceDebounce()

      expect(listOpportunities).not.toHaveBeenCalled()
    })
  })

  describe('quick filters', () => {
    it('starts without quick filters', () => {
      const { result } = renderBoardController()
      expect(result.current.quickFilters).toEqual(NO_OPPORTUNITY_QUICK_FILTERS)
    })

    it('reloads the current tab from the start when the rate sort is toggled', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockResolvedValue(succeeded(buildListing({ items: [buildOpportunity('rated')], hasMore: false })))

      await act(() => result.current.toggleSortByRate())

      expect(listOpportunities).toHaveBeenCalledWith('to_process', null, '', { sortByRate: true, remoteModes: [] })
      expect(result.current.quickFilters.sortByRate).toBe(true)
      expect(result.current.items.map(({ id }) => id)).toEqual(['rated'])
    })

    it('keeps the remote modes in canonical order and removes a mode toggled twice', async () => {
      const { result, listOpportunities } = renderBoardController()

      await act(() => result.current.toggleRemoteMode('none'))
      await act(() => result.current.toggleRemoteMode('full'))
      expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, '', {
        sortByRate: false,
        remoteModes: ['full', 'none'],
      })

      await act(() => result.current.toggleRemoteMode('full'))
      expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, '', {
        sortByRate: false,
        remoteModes: ['none'],
      })
    })

    describe('with fake timers', () => {
      beforeEach(() => {
        jest.useFakeTimers()
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      const typeAndFireSearch = async (result: ReturnType<typeof renderBoardController>['result'], value: string) => {
        act(() => result.current.changeSearch(value))
        await act(async () => {
          await jest.advanceTimersByTimeAsync(300)
        })
      }

      it('sends the applied search with the filters', async () => {
        const { result, listOpportunities } = renderBoardController()
        await typeAndFireSearch(result, 'react')

        await act(() => result.current.toggleSortByRate())

        expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, 'react', {
          sortByRate: true,
          remoteModes: [],
        })
      })

      it('toggling a filter while a search is in flight ends with both search and filter applied', async () => {
        const { result, listOpportunities } = renderBoardController()
        let resolveSearch: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
        listOpportunities
          .mockReturnValueOnce(new Promise((resolve) => (resolveSearch = resolve)))
          .mockResolvedValueOnce(succeeded(buildListing({ items: [buildOpportunity('both')], hasMore: false })))
        await typeAndFireSearch(result, 'react')

        await act(() => result.current.toggleSortByRate())
        await act(async () => {
          resolveSearch(succeeded(buildListing({ items: [buildOpportunity('outdated')], hasMore: false })))
        })

        expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, 'react', {
          sortByRate: true,
          remoteModes: [],
        })
        expect(result.current.hasActiveSearch).toBe(true)
        expect(result.current.items.map(({ id }) => id)).toEqual(['both'])
      })

      it('restores the applied filters when a search that superseded a filter request fails', async () => {
        const { result, listOpportunities } = renderBoardController()
        let resolveFilter: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
        listOpportunities
          .mockReturnValueOnce(new Promise((resolve) => (resolveFilter = resolve)))
          .mockResolvedValueOnce({ ok: false, errorMessage: 'Recherche impossible' })
        act(() => {
          void result.current.toggleSortByRate()
        })

        await typeAndFireSearch(result, 'react')
        await act(async () => {
          resolveFilter(succeeded(buildListing()))
        })

        expect(result.current.errorMessage).toBe('Recherche impossible')
        expect(result.current.quickFilters).toEqual(NO_OPPORTUNITY_QUICK_FILTERS)
      })
    })

    it('loads more with the rated cursor and the current filters', async () => {
      const { result, listOpportunities } = renderBoardController({
        items: [buildOpportunity('rated', { rateMax: 650 })],
      })
      listOpportunities.mockResolvedValue(
        succeeded(buildListing({ items: [buildOpportunity('rated', { rateMax: 650 })], hasMore: true })),
      )
      await act(() => result.current.toggleSortByRate())
      listOpportunities.mockResolvedValue(succeeded(buildListing({ items: [], hasMore: false })))

      await act(() => result.current.loadMore())

      expect(listOpportunities).toHaveBeenLastCalledWith(
        'to_process',
        { publishedAt: '2026-10-18T08:00:00.000Z', id: 'rated', rate: 650 },
        '',
        { sortByRate: true, remoteModes: [] },
      )
    })

    it('keeps the filters when the tab changes', async () => {
      const { result, listOpportunities } = renderBoardController()
      await act(() => result.current.toggleRemoteMode('partial'))

      await act(() => result.current.selectTab('applied'))

      expect(listOpportunities).toHaveBeenLastCalledWith('applied', null, '', {
        sortByRate: false,
        remoteModes: ['partial'],
      })
    })

    it('ignores a response that arrives after a more recent one', async () => {
      const { result, listOpportunities } = renderBoardController()
      let resolveFirstRequest: (actionResult: ActionResult<OpportunityListing>) => void = () => undefined
      listOpportunities
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirstRequest = resolve)))
        .mockResolvedValueOnce(succeeded(buildListing({ items: [buildOpportunity('latest')], hasMore: false })))

      act(() => {
        void result.current.toggleSortByRate()
      })
      await act(() => result.current.toggleRemoteMode('full'))
      await act(async () => {
        resolveFirstRequest(succeeded(buildListing({ items: [buildOpportunity('outdated')], hasMore: false })))
      })

      expect(result.current.items.map(({ id }) => id)).toEqual(['latest'])
      expect(result.current.quickFilters).toEqual({ sortByRate: true, remoteModes: ['full'] })
      expect(result.current.isLoadingListing).toBe(false)
    })

    it('restores the applied filters and shows the error when the reload fails', async () => {
      const { result, listOpportunities } = renderBoardController()
      listOpportunities.mockResolvedValue({ ok: false, errorMessage: 'Chargement impossible' })

      await act(() => result.current.toggleSortByRate())

      expect(result.current.errorMessage).toBe('Chargement impossible')
      expect(result.current.quickFilters).toEqual(NO_OPPORTUNITY_QUICK_FILTERS)
      expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second'])
    })
  })
})
