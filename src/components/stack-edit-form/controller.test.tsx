import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview } from '@/domain/job-application'
import type { StackItem } from '@/domain/types'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { useController } from './controller'

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const NODE: StackItem = { name: 'Node', category: 'language', origin: 'posting' }

const renderStackController = (jobApplication: JobApplicationOverview = buildJobApplicationOverview()) => {
  const updateJobApplication = jest.fn().mockResolvedValue(SUCCESS)
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(
    (currentJobApplication: JobApplicationOverview) =>
      useController({ jobApplication: currentJobApplication, updateJobApplication, onDataChanged, onClose }),
    { initialProps: jobApplication },
  )
  return { ...renderedHook, updateJobApplication, onDataChanged, onClose }
}

describe('stack-edit-form useController', () => {
  it('sends only the stack when it changed, then refreshes and closes', async () => {
    const { result, updateJobApplication, onDataChanged, onClose } = renderStackController()
    const editedStack = [...buildJobApplicationOverview().stack, NODE]
    act(() => result.current.setStack(editedStack))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { stack: editedStack })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes without sending when the stack is unchanged', async () => {
    const { result, updateJobApplication, onClose } = renderStackController()
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('goes back to reading without sending anything on cancel', () => {
    const { result, updateJobApplication, onClose } = renderStackController()
    act(() => result.current.setStack([]))
    act(() => result.current.cancel())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('shows the generic error when the update throws', async () => {
    const { result, updateJobApplication, onClose } = renderStackController()
    updateJobApplication.mockRejectedValue(new Error('network'))
    act(() => result.current.setStack([]))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSaving).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps an edited stack across a refresh', () => {
    const { result, rerender } = renderStackController()
    act(() => result.current.setStack([NODE]))
    rerender(buildJobApplicationOverview({ title: 'Lead React', stack: [] }))
    expect(result.current.stack).toEqual([NODE])
  })

  it('adopts the refreshed stack while it is untouched', () => {
    const { result, rerender } = renderStackController()
    const refreshedStack = [...buildJobApplicationOverview().stack, { ...NODE, origin: 'job_spec' as const }]
    rerender(buildJobApplicationOverview({ stack: refreshedStack }))
    expect(result.current.stack).toEqual(refreshedStack)
  })
})
