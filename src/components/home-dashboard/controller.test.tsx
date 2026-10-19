import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { OpportunityListItem } from '@/domain/opportunities'
import { useController } from './controller'

const opportunity = { id: 'opportunity-1', jobApplicationId: null } as OpportunityListItem

const buildOpportunity = (index: number) => ({ id: `opportunity-${index}`, jobApplicationId: null }) as OpportunityListItem

describe('home-dashboard useController', () => {
  it('ignores a second apply while the first one is still in flight', async () => {
    let resolveApply: (actionResult: ActionResult<{ jobApplicationId: string }>) => void = () => undefined
    const applyToOpportunity = jest.fn().mockReturnValue(new Promise((resolve) => (resolveApply = resolve)))
    const { result } = renderHook(() =>
      useController({ highlightedOpportunities: [opportunity], applyToOpportunity, onDataChanged: jest.fn() }),
    )
    let firstApply: Promise<void> = Promise.resolve()
    act(() => {
      firstApply = result.current.applyTo(opportunity)
      void result.current.applyTo(opportunity)
    })
    expect(applyToOpportunity).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveApply({ ok: true, data: { jobApplicationId: 'created-1' } })
      await firstApply
    })
    expect(result.current.opportunities[0].jobApplicationId).toBe('created-1')
  })

  it('keeps every applied mission at its place when the refreshed list no longer contains them', async () => {
    const applyToOpportunity = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { jobApplicationId: 'created-1' } })
      .mockResolvedValueOnce({ ok: true, data: { jobApplicationId: 'created-3' } })
    const { result, rerender } = renderHook(
      ({ highlightedOpportunities }: { highlightedOpportunities: OpportunityListItem[] }) =>
        useController({ highlightedOpportunities, applyToOpportunity, onDataChanged: jest.fn() }),
      { initialProps: { highlightedOpportunities: [1, 2, 3, 4].map(buildOpportunity) } },
    )
    await act(() => result.current.applyTo(buildOpportunity(1)))
    await act(() => result.current.applyTo(buildOpportunity(3)))

    rerender({ highlightedOpportunities: [buildOpportunity(2), buildOpportunity(4)] })

    expect(result.current.opportunities.map(({ id, jobApplicationId }) => [id, jobApplicationId])).toEqual([
      ['opportunity-1', 'created-1'],
      ['opportunity-2', null],
      ['opportunity-3', 'created-3'],
      ['opportunity-4', null],
    ])
  })
})
