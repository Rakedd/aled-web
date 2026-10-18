import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useBlockForm } from './use-block-form'

type NoteFormValues = { location: string; duration: string }

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const renderBlockForm = (initialServerFormValues: NoteFormValues = { location: 'Paris', duration: '6 mois' }) => {
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(
    (serverFormValues: NoteFormValues) => useBlockForm({ serverFormValues, onDataChanged, onClose }),
    { initialProps: initialServerFormValues },
  )
  return { ...renderedHook, onDataChanged, onClose }
}

describe('useBlockForm', () => {
  it('closes without refreshing when there is nothing to save', async () => {
    const { result, onDataChanged, onClose } = renderBlockForm()
    await act(() => result.current.save(() => ({ ok: true, data: [] })))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the validation message and sends nothing', async () => {
    const { result, onClose } = renderBlockForm()
    await act(() => result.current.save(() => ({ ok: false, errorMessage: 'TJM invalide' })))
    expect(result.current.errorMessage).toBe('TJM invalide')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('runs the save steps in order, then refreshes and closes', async () => {
    const { result, onDataChanged, onClose } = renderBlockForm()
    const calls: string[] = []
    const firstStep = jest.fn(async () => {
      calls.push('first')
      return SUCCESS
    })
    const secondStep = jest.fn(async () => {
      calls.push('second')
      return SUCCESS
    })
    await act(() => result.current.save(() => ({ ok: true, data: [firstStep, secondStep] })))
    expect(calls).toEqual(['first', 'second'])
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDataChanged.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0])
  })

  it('stays in the saving state until the refreshed data is rendered, then closes', async () => {
    const onClose = jest.fn()
    const savingStatesSeenAtClose: boolean[] = []
    const { result, rerender } = renderHook(
      (serverFormValues: NoteFormValues) =>
        useBlockForm({
          serverFormValues,
          onDataChanged: () => rerender({ location: 'Lyon', duration: '6 mois' }),
          onClose: () => {
            savingStatesSeenAtClose.push(result.current.isSaving)
            onClose()
          },
        }),
      { initialProps: { location: 'Paris', duration: '6 mois' } },
    )
    act(() => result.current.setFormValue('location', 'Lyon'))
    await act(() => result.current.save(() => ({ ok: true, data: [jest.fn().mockResolvedValue(SUCCESS)] })))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(savingStatesSeenAtClose).toEqual([true])
    expect(result.current.baselineFormValues).toEqual({ location: 'Lyon', duration: '6 mois' })
  })

  it('stops at the first refused step, refreshes what was saved and stays open', async () => {
    const { result, onDataChanged, onClose } = renderBlockForm()
    const thirdStep = jest.fn().mockResolvedValue(SUCCESS)
    await act(() =>
      result.current.save(() => ({
        ok: true,
        data: [
          jest.fn().mockResolvedValue(SUCCESS),
          jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Intermédiaire introuvable' }),
          thirdStep,
        ],
      })),
    )
    expect(thirdStep).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Intermédiaire introuvable')
    expect(result.current.isSaving).toBe(false)
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the generic error without refreshing when the first step throws', async () => {
    const { result, onDataChanged } = renderBlockForm()
    await act(() => result.current.save(() => ({ ok: true, data: [jest.fn().mockRejectedValue(new Error('network'))] })))
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('ignores a second save while one is in flight', async () => {
    const { result } = renderBlockForm()
    let resolveStep: (stepResult: ActionResult<null>) => void = () => undefined
    const slowStep = jest.fn(() => new Promise<ActionResult<null>>((resolve) => (resolveStep = resolve)))
    let firstSave: Promise<void> = Promise.resolve()
    act(() => {
      firstSave = result.current.save(() => ({ ok: true, data: [slowStep] }))
    })
    await act(() => result.current.save(() => ({ ok: true, data: [slowStep] })))
    expect(slowStep).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveStep(SUCCESS)
      await firstSave
    })
    expect(result.current.isSaving).toBe(false)
  })

  it('keeps the field being edited and adopts the untouched ones when the server data changes', () => {
    const { result, rerender } = renderBlockForm()
    act(() => result.current.setFormValue('location', 'Lyon'))
    rerender({ location: 'Marseille', duration: '12 mois' })
    expect(result.current.formValues).toEqual({ location: 'Lyon', duration: '12 mois' })
    expect(result.current.baselineFormValues).toEqual({ location: 'Marseille', duration: '12 mois' })
  })
})
