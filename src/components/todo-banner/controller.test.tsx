import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { CvOutdatedTodoAlert, JobApplicationTodoAlert } from '@/domain/todo-alerts'
import { useController } from './controller'

const followUpAlert: JobApplicationTodoAlert = {
  kind: 'follow_up_due',
  jobApplicationId: 'application-1',
  jobApplicationTitle: 'Dev React',
  referenceDate: new Date('2026-10-01T10:00:00Z'),
}
const noNewsAlert: JobApplicationTodoAlert = { ...followUpAlert, kind: 'no_news_suggestion' }
const otherApplicationAlert: JobApplicationTodoAlert = { ...followUpAlert, jobApplicationId: 'application-2' }
const cvAlert: CvOutdatedTodoAlert = {
  kind: 'cv_outdated',
  cvId: 'cv-1',
  cvLabel: 'CV DevOps',
  referenceDate: new Date('2026-07-01T10:00:00Z'),
}

const renderTodoBannerController = (serverResult: ActionResult<null> | Error = { ok: true, data: null }) => {
  const respond = () => (serverResult instanceof Error ? Promise.reject(serverResult) : Promise.resolve(serverResult))
  const snoozeAlert = jest.fn().mockImplementation(respond)
  const changeJobApplicationStatus = jest.fn().mockImplementation(respond)
  const confirmCvStillGood = jest.fn().mockImplementation(respond)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({
      initialAlerts: [followUpAlert, noNewsAlert, otherApplicationAlert, cvAlert],
      snoozeAlert,
      confirmCvStillGood,
      changeJobApplicationStatus,
      onDataChanged,
    }),
  )
  return { result, snoozeAlert, changeJobApplicationStatus, confirmCvStillGood, onDataChanged }
}

describe('todo-banner useController', () => {
  it('snoozes an alert and removes it right away', async () => {
    const { result, snoozeAlert } = renderTodoBannerController()
    await act(() => result.current.snooze(followUpAlert, 3))
    expect(snoozeAlert).toHaveBeenCalledWith('application-1', 'follow_up_due', 3)
    expect(result.current.alerts).toEqual([noNewsAlert, otherApplicationAlert, cvAlert])
    expect(result.current.errorMessage).toBeNull()
  })

  it('removes the alert before the server answers', () => {
    const { result, snoozeAlert } = renderTodoBannerController()
    snoozeAlert.mockReturnValue(new Promise(() => undefined))
    act(() => {
      void result.current.snooze(followUpAlert, 7)
    })
    expect(result.current.alerts).not.toContain(followUpAlert)
  })

  it('brings the alert back with the error message when the server refuses', async () => {
    const { result } = renderTodoBannerController({ ok: false, errorMessage: 'Impossible de reporter' })
    await act(() => result.current.snooze(followUpAlert, 3))
    expect(result.current.alerts).toContain(followUpAlert)
    expect(result.current.errorMessage).toBe('Impossible de reporter')
  })

  it('brings the alert back with a generic message when the call throws', async () => {
    const { result } = renderTodoBannerController(new Error('network'))
    await act(() => result.current.snooze(followUpAlert, 3))
    expect(result.current.alerts).toContain(followUpAlert)
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('closes an application as abandoned and hides all its alerts', async () => {
    const { result, changeJobApplicationStatus } = renderTodoBannerController()
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(changeJobApplicationStatus).toHaveBeenCalledWith('application-1', 'no_news_abandoned')
    expect(result.current.alerts).toEqual([otherApplicationAlert, cvAlert])
  })

  it('keeps the alerts and shows the error when closing fails', async () => {
    const { result } = renderTodoBannerController({ ok: false, errorMessage: 'Échec' })
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(result.current.alerts).toHaveLength(4)
    expect(result.current.errorMessage).toBe('Échec')
  })

  it('keeps the alerts and shows a generic error when closing throws', async () => {
    const { result } = renderTodoBannerController(new Error('network'))
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(result.current.alerts).toHaveLength(4)
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('refreshes the data after a successful snooze or close', async () => {
    const { result, onDataChanged } = renderTodoBannerController()
    await act(() => result.current.snooze(followUpAlert, 3))
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(onDataChanged).toHaveBeenCalledTimes(2)
  })

  it.each([{ ok: false, errorMessage: 'Échec' } as const, new Error('network')])(
    'does not refresh the data when the action fails (%p)',
    async (serverResult) => {
      const { result, onDataChanged } = renderTodoBannerController(serverResult)
      await act(() => result.current.snooze(followUpAlert, 3))
      await act(() => result.current.closeAsNoNews(noNewsAlert))
      expect(onDataChanged).not.toHaveBeenCalled()
    },
  )

  it('flags an alert as pending while its action is in flight', async () => {
    const { result, changeJobApplicationStatus } = renderTodoBannerController()
    let resolveStatusChange: (actionResult: ActionResult<null>) => void = () => undefined
    changeJobApplicationStatus.mockReturnValue(new Promise((resolve) => (resolveStatusChange = resolve)))
    let closing: Promise<void> = Promise.resolve()
    act(() => {
      closing = result.current.closeAsNoNews(noNewsAlert)
    })
    expect(result.current.isAlertPending(noNewsAlert)).toBe(true)
    expect(result.current.isAlertPending(followUpAlert)).toBe(false)
    await act(async () => {
      resolveStatusChange({ ok: true, data: null })
      await closing
    })
    expect(result.current.isAlertPending(noNewsAlert)).toBe(false)
  })

  it('confirms a cv as still good and hides its reminder right away', async () => {
    const { result, confirmCvStillGood, onDataChanged } = renderTodoBannerController()
    confirmCvStillGood.mockReturnValue(new Promise(() => undefined))
    act(() => {
      void result.current.confirmStillGood(cvAlert)
    })
    expect(confirmCvStillGood).toHaveBeenCalledWith('cv-1')
    expect(result.current.alerts).not.toContain(cvAlert)
    confirmCvStillGood.mockResolvedValue({ ok: true, data: null })
    await act(() => result.current.confirmStillGood(cvAlert))
    expect(result.current.alerts).not.toContain(cvAlert)
    expect(result.current.errorMessage).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('brings the cv reminder back with the error when confirming fails', async () => {
    const { result, onDataChanged } = renderTodoBannerController({ ok: false, errorMessage: 'Impossible de confirmer' })
    await act(() => result.current.confirmStillGood(cvAlert))
    expect(result.current.alerts).toContain(cvAlert)
    expect(result.current.errorMessage).toBe('Impossible de confirmer')
    expect(onDataChanged).not.toHaveBeenCalled()
  })
})
