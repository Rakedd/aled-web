import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { TodoAlert } from '@/domain/todo-alerts'
import { useController } from './controller'

const followUpAlert: TodoAlert = {
  kind: 'follow_up_due',
  jobApplicationId: 'application-1',
  jobApplicationTitle: 'Dev React',
  referenceDate: new Date('2026-10-01T10:00:00Z'),
}
const noNewsAlert: TodoAlert = { ...followUpAlert, kind: 'no_news_suggestion' }
const otherApplicationAlert: TodoAlert = { ...followUpAlert, jobApplicationId: 'application-2' }

const renderTodoBannerController = (serverResult: ActionResult<null> | Error = { ok: true, data: null }) => {
  const respond = () => (serverResult instanceof Error ? Promise.reject(serverResult) : Promise.resolve(serverResult))
  const snoozeAlert = jest.fn().mockImplementation(respond)
  const changeJobApplicationStatus = jest.fn().mockImplementation(respond)
  const { result } = renderHook(() =>
    useController({
      initialAlerts: [followUpAlert, noNewsAlert, otherApplicationAlert],
      snoozeAlert,
      changeJobApplicationStatus,
    }),
  )
  return { result, snoozeAlert, changeJobApplicationStatus }
}

describe('todo-banner useController', () => {
  it('snoozes an alert and removes it right away', async () => {
    const { result, snoozeAlert } = renderTodoBannerController()
    await act(() => result.current.snooze(followUpAlert, 3))
    expect(snoozeAlert).toHaveBeenCalledWith('application-1', 'follow_up_due', 3)
    expect(result.current.alerts).toEqual([noNewsAlert, otherApplicationAlert])
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
    expect(result.current.alerts).toEqual([otherApplicationAlert])
  })

  it('keeps the alerts and shows the error when closing fails', async () => {
    const { result } = renderTodoBannerController({ ok: false, errorMessage: 'Échec' })
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(result.current.alerts).toHaveLength(3)
    expect(result.current.errorMessage).toBe('Échec')
  })

  it('keeps the alerts and shows a generic error when closing throws', async () => {
    const { result } = renderTodoBannerController(new Error('network'))
    await act(() => result.current.closeAsNoNews(noNewsAlert))
    expect(result.current.alerts).toHaveLength(3)
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })
})
