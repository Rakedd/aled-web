import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { ActivityLogEntry } from '@/domain/activity-log'
import { useController } from './controller'

const OLDER_ENTRY: ActivityLogEntry = {
  id: 'entry-1',
  jobApplicationId: 'application-1',
  occurredAt: new Date('2026-10-10T09:00:00Z'),
  kind: 'email',
  summary: 'Envoi du CV',
}

const NEWER_ENTRY: ActivityLogEntry = {
  id: 'entry-2',
  jobApplicationId: 'application-1',
  occurredAt: new Date('2026-10-17T09:00:00Z'),
  kind: 'call',
  summary: 'Appel de qualification',
}

const renderActivityLogController = ({
  addResult = { ok: true, data: null },
  listResult = { ok: true, data: [NEWER_ENTRY, OLDER_ENTRY] },
}: {
  addResult?: ActionResult<null>
  listResult?: ActionResult<ActivityLogEntry[]>
} = {}) => {
  const addActivityLogEntry = jest.fn().mockResolvedValue(addResult)
  const listActivityLogEntries = jest.fn().mockResolvedValue(listResult)
  const onDataChanged = jest.fn()
  const { result, rerender } = renderHook(
    (initialEntries: ActivityLogEntry[]) =>
      useController({
        jobApplicationId: 'application-1',
        initialEntries,
        addActivityLogEntry,
        listActivityLogEntries,
        onDataChanged,
      }),
    { initialProps: [OLDER_ENTRY] },
  )
  return { result, rerender, addActivityLogEntry, listActivityLogEntries, onDataChanged }
}

describe('activity-log useController', () => {
  it('defaults the kind to call and offers only user loggable kinds', () => {
    const { result } = renderActivityLogController()
    expect(result.current.kind).toBe('call')
    expect(result.current.kindOptions).toEqual(['call', 'message', 'email', 'other'])
  })

  it('adds an entry with the chosen kind and summary, then shows it first', async () => {
    const { result, addActivityLogEntry, onDataChanged } = renderActivityLogController()
    act(() => result.current.setKind('message'))
    act(() => result.current.setSummary('Relance par LinkedIn'))
    await act(() => result.current.addEntry())
    expect(addActivityLogEntry).toHaveBeenCalledWith('application-1', { kind: 'message', summary: 'Relance par LinkedIn' })
    expect(result.current.entries[0]).toEqual(NEWER_ENTRY)
    expect(result.current.summary).toBe('')
    expect(result.current.kind).toBe('message')
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses an empty summary without calling the server', async () => {
    const { result, addActivityLogEntry } = renderActivityLogController()
    act(() => result.current.setSummary('   '))
    await act(() => result.current.addEntry())
    expect(addActivityLogEntry).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Le résumé est obligatoire')
  })

  it('keeps the summary and shows the server message when the add is refused', async () => {
    const { result, onDataChanged } = renderActivityLogController({
      addResult: { ok: false, errorMessage: 'Candidature introuvable' },
    })
    act(() => result.current.setSummary('Appel'))
    await act(() => result.current.addEntry())
    expect(result.current.errorMessage).toBe('Candidature introuvable')
    expect(result.current.summary).toBe('Appel')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error when the add throws', async () => {
    const { result, addActivityLogEntry } = renderActivityLogController()
    addActivityLogEntry.mockRejectedValue(new Error('network'))
    act(() => result.current.setSummary('Appel'))
    await act(() => result.current.addEntry())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isAdding).toBe(false)
  })

  it('relies on the server refresh when reloading the list fails after a successful add', async () => {
    const { result, listActivityLogEntries, onDataChanged } = renderActivityLogController()
    listActivityLogEntries.mockRejectedValue(new Error('network'))
    act(() => result.current.setSummary('Appel'))
    await act(() => result.current.addEntry())
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.summary).toBe('')
    expect(result.current.entries).toEqual([OLDER_ENTRY])
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('shows the entries refreshed by the server when the initial entries change', async () => {
    const { result, rerender } = renderActivityLogController()
    act(() => result.current.setSummary('Appel'))
    await act(() => result.current.addEntry())
    rerender([NEWER_ENTRY, OLDER_ENTRY, { ...OLDER_ENTRY, id: 'entry-3' }])
    expect(result.current.entries).toHaveLength(3)
  })
})
