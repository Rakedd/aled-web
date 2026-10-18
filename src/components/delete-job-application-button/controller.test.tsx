import { act, renderHook } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { useController } from './controller'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const DELETION_FAILURE_MESSAGE = 'Impossible de supprimer la candidature pour le moment. Réessaie dans quelques minutes.'

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const renderDeletionController = (
  deleteJobApplication = jest
    .fn<Promise<ActionResult<null>>, [string]>()
    .mockResolvedValue({ ok: true, data: null }),
) => {
  const navigate = jest.fn()
  const renderedHook = renderHook(() =>
    useController({ jobApplicationId: JOB_APPLICATION_ID, deleteJobApplication, navigate }),
  )
  return { ...renderedHook, deleteJobApplication, navigate }
}

describe('DeleteJobApplicationButton controller', () => {
  it('opens the confirmation, then « Annuler » closes it without deleting anything', () => {
    const { result, deleteJobApplication, navigate } = renderDeletionController()

    act(() => result.current.openConfirmation())
    expect(result.current.isConfirmationOpen).toBe(true)

    act(() => result.current.closeConfirmation())

    expect(result.current.isConfirmationOpen).toBe(false)
    expect(deleteJobApplication).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('deletes only once despite a double click, then navigates to the applications list with the notice', async () => {
    const deferredDeletion = createDeferred<ActionResult<null>>()
    const { result, deleteJobApplication, navigate } = renderDeletionController(
      jest.fn<Promise<ActionResult<null>>, [string]>().mockReturnValue(deferredDeletion.promise),
    )
    act(() => result.current.openConfirmation())

    let firstDeletion: Promise<void> = Promise.resolve()
    let secondDeletion: Promise<void> = Promise.resolve()
    act(() => {
      firstDeletion = result.current.confirmDeletion()
      secondDeletion = result.current.confirmDeletion()
    })

    expect(result.current.isDeleting).toBe(true)
    expect(result.current.confirmLabel).toBe('Suppression…')
    await act(async () => {
      deferredDeletion.resolve({ ok: true, data: null })
      await Promise.all([firstDeletion, secondDeletion])
    })

    expect(deleteJobApplication).toHaveBeenCalledTimes(1)
    expect(deleteJobApplication).toHaveBeenCalledWith(JOB_APPLICATION_ID)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/?supprimee=1')
    expect(result.current.isDeleting).toBe(true)
  })

  it('keeps the confirmation open while the deletion is in flight', async () => {
    const deferredDeletion = createDeferred<ActionResult<null>>()
    const { result } = renderDeletionController(
      jest.fn<Promise<ActionResult<null>>, [string]>().mockReturnValue(deferredDeletion.promise),
    )
    act(() => result.current.openConfirmation())
    let deletion: Promise<void> = Promise.resolve()
    act(() => {
      deletion = result.current.confirmDeletion()
    })

    act(() => result.current.closeConfirmation())

    expect(result.current.isConfirmationOpen).toBe(true)
    await act(async () => {
      deferredDeletion.resolve({ ok: true, data: null })
      await deletion
    })
  })

  it('shows the action error, keeps the confirmation open and allows a retry', async () => {
    const { result, deleteJobApplication, navigate } = renderDeletionController(
      jest
        .fn<Promise<ActionResult<null>>, [string]>()
        .mockResolvedValueOnce({ ok: false, errorMessage: DELETION_FAILURE_MESSAGE })
        .mockResolvedValueOnce({ ok: true, data: null }),
    )
    act(() => result.current.openConfirmation())

    await act(() => result.current.confirmDeletion())

    expect(result.current.errorMessage).toBe(DELETION_FAILURE_MESSAGE)
    expect(result.current.isConfirmationOpen).toBe(true)
    expect(result.current.isDeleting).toBe(false)
    expect(result.current.confirmLabel).toBe('Supprimer')
    expect(navigate).not.toHaveBeenCalled()

    await act(() => result.current.confirmDeletion())

    expect(deleteJobApplication).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledWith('/?supprimee=1')
  })

  it('shows the generic message when the action throws', async () => {
    const { result, navigate } = renderDeletionController(
      jest.fn<Promise<ActionResult<null>>, [string]>().mockRejectedValue(new Error('Network down')),
    )
    act(() => result.current.openConfirmation())

    await act(() => result.current.confirmDeletion())

    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    expect(result.current.isDeleting).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('clears a previous error when the confirmation is opened again', async () => {
    const { result } = renderDeletionController(
      jest.fn<Promise<ActionResult<null>>, [string]>().mockRejectedValue(new Error('Network down')),
    )
    act(() => result.current.openConfirmation())
    await act(() => result.current.confirmDeletion())
    act(() => result.current.closeConfirmation())

    act(() => result.current.openConfirmation())

    expect(result.current.errorMessage).toBeNull()
  })
})
