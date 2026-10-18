import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { OpportunityListing, OpportunityListItem } from '@/domain/opportunities'
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

const renderBoardController = () => {
  const listOpportunities = jest.fn().mockResolvedValue(succeeded(buildListing()))
  const applyToOpportunity = jest.fn().mockResolvedValue(succeeded({ jobApplicationId: 'application-1' }))
  const dismissOpportunity = jest.fn().mockResolvedValue(succeeded(null))
  const restoreOpportunity = jest.fn().mockResolvedValue(succeeded(null))
  const markOpportunitiesViewed = jest.fn().mockResolvedValue(succeeded(null))
  const onDataChanged = jest.fn()
  const onTabChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({
      initialTab: 'to_process',
      initialListing: buildListing(),
      listOpportunities,
      applyToOpportunity,
      dismissOpportunity,
      restoreOpportunity,
      markOpportunitiesViewed,
      onDataChanged,
      onTabChanged,
    }),
  )
  return {
    result,
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
    expect(listOpportunities).toHaveBeenCalledWith('to_process', 2)
    expect(result.current.items.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
    expect(result.current.hasMore).toBe(false)
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
    expect(listOpportunities).toHaveBeenCalledWith('applied', 1)
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
})
