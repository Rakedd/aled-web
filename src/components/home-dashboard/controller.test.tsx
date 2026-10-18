import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { OpportunityListItem } from '@/domain/opportunities'
import { useController } from './controller'

const opportunity = { id: 'opportunity-1', jobApplicationId: null } as OpportunityListItem

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
})
