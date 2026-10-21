import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'

const renderIntermediaryHeaderController = (updateResult: ActionResult<null> | Error = { ok: true, data: null }) => {
  const updateIntermediaryKind = jest.fn()
  if (updateResult instanceof Error) updateIntermediaryKind.mockRejectedValue(updateResult)
  else updateIntermediaryKind.mockResolvedValue(updateResult)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() => useController({ intermediaryId: 'agency-1', updateIntermediaryKind, onDataChanged }))
  return { result, updateIntermediaryKind, onDataChanged }
}

describe('intermediary-header useController', () => {
  it('saves a valid kind and notifies the page', async () => {
    const { result, updateIntermediaryKind, onDataChanged } = renderIntermediaryHeaderController()
    await act(() => result.current.changeKind('platform'))
    expect(updateIntermediaryKind).toHaveBeenCalledWith('agency-1', 'platform')
    expect(onDataChanged).toHaveBeenCalled()
    expect(result.current.errorMessage).toBeNull()
  })

  it('rejects an unknown kind without calling the action', async () => {
    const { result, updateIntermediaryKind } = renderIntermediaryHeaderController()
    await act(() => result.current.changeKind('unknown'))
    expect(updateIntermediaryKind).not.toHaveBeenCalled()
    expect(result.current.errorMessage).not.toBeNull()
  })

  it('exposes the action error and does not notify the page', async () => {
    const { result, onDataChanged } = renderIntermediaryHeaderController({ ok: false, errorMessage: 'Enregistrement impossible' })
    await act(() => result.current.changeKind('esn'))
    expect(result.current.errorMessage).toBe('Enregistrement impossible')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('falls back to the generic message when the action throws', async () => {
    const { result } = renderIntermediaryHeaderController(new Error('network'))
    await act(() => result.current.changeKind('esn'))
    expect(result.current.errorMessage).toBeTruthy()
    expect(result.current.isSaving).toBe(false)
  })
})
