import { act, renderHook } from '@testing-library/react'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { TodoAlert } from '@/domain/todo-alerts'
import type { AlertKind } from '@/domain/types'
import { useController } from './controller'

const buildJobApplication = (overrides: Partial<JobApplicationListItem>): JobApplicationListItem => ({
  id: 'id',
  userId: 'user',
  title: 'Dev',
  source: null,
  postingUrl: null,
  status: 'applied',
  intermediaryId: null,
  contactId: null,
  endClientId: null,
  postedDailyRate: null,
  requestedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  appliedOn: new Date('2026-10-01T10:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [],
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  lastActivityAt: null,
  hasJobSpec: false,
  intermediaryName: null,
  intermediaryKind: null,
  contactName: null,
  endClientName: null,
  endClientParentName: null,
  endClientLabel: null,
  ...overrides,
})

const jobApplications = [
  buildJobApplication({ id: 'a', title: 'Alpha', source: 'LinkedIn' }),
  buildJobApplication({ id: 'b', title: 'Bravo', source: 'Free-Work' }),
  buildJobApplication({ id: 'c', title: 'Charlie', source: 'LinkedIn', status: 'signed' }),
  buildJobApplication({ id: 'd', title: 'Delta' }),
]

describe('job-applications-table useController', () => {
  it('lists the distinct sources present in the data', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    expect(result.current.availableSources).toEqual(['Free-Work', 'LinkedIn'])
  })

  it('hides terminal applications until asked', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).not.toContain('c')
    act(() => result.current.setShowTerminal(true))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toContain('c')
  })

  it('drops terminal status filters when terminal applications are hidden again', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    act(() => result.current.setShowTerminal(true))
    act(() => result.current.toggleStatus('signed'))
    act(() => result.current.toggleStatus('applied'))
    act(() => result.current.setShowTerminal(false))
    expect(result.current.filters.statuses).toEqual(['applied'])
    expect(result.current.visibleJobApplications.length).toBeGreaterThan(0)
  })

  it('sorts by last activity descending at first', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    expect(result.current.sort).toEqual({ key: 'lastActivityAt', direction: 'desc' })
  })

  it('sorts a new column ascending then reverses on the second click', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    act(() => result.current.toggleSort('title'))
    expect(result.current.sort).toEqual({ key: 'title', direction: 'asc' })
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['a', 'b', 'd'])
    act(() => result.current.toggleSort('title'))
    expect(result.current.sort).toEqual({ key: 'title', direction: 'desc' })
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['d', 'b', 'a'])
  })

  it('filters by search text and source', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    act(() => result.current.setSearchText('brav'))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['b'])
    act(() => result.current.setSearchText(''))
    act(() => result.current.toggleSource('LinkedIn'))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['a'])
    act(() => result.current.toggleSource('LinkedIn'))
    expect(result.current.visibleJobApplications).toHaveLength(3)
  })

  it('toggles a status filter', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    act(() => result.current.toggleStatus('applied'))
    expect(result.current.filters.statuses).toEqual(['applied'])
    act(() => result.current.toggleStatus('applied'))
    expect(result.current.filters.statuses).toEqual([])
  })

  describe('alert filter', () => {
    const buildAlert = (jobApplicationId: string, kind: AlertKind): TodoAlert => ({
      kind,
      jobApplicationId,
      jobApplicationTitle: 'Titre',
      referenceDate: new Date('2026-10-01T10:00:00Z'),
    })
    const alerts = [buildAlert('a', 'follow_up_due'), buildAlert('b', 'follow_up_due'), buildAlert('d', 'job_spec_missing')]

    it('counts alerts by kind', () => {
      const { result } = renderHook(() => useController({ jobApplications, alerts }))
      expect(result.current.kindCounts).toEqual([
        { kind: 'follow_up_due', count: 2 },
        { kind: 'job_spec_missing', count: 1 },
      ])
    })

    it('toggles the same kind on then off', () => {
      const { result } = renderHook(() => useController({ jobApplications, alerts }))
      act(() => result.current.toggleAlertKind('follow_up_due'))
      expect(result.current.selectedAlertKind).toBe('follow_up_due')
      act(() => result.current.toggleAlertKind('follow_up_due'))
      expect(result.current.selectedAlertKind).toBeNull()
    })

    it('switches from one kind to another', () => {
      const { result } = renderHook(() => useController({ jobApplications, alerts }))
      act(() => result.current.toggleAlertKind('follow_up_due'))
      act(() => result.current.toggleAlertKind('job_spec_missing'))
      expect(result.current.selectedAlertKind).toBe('job_spec_missing')
      expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['d'])
    })

    it('combines the alert filter with the status filter', () => {
      const { result } = renderHook(() => useController({ jobApplications, alerts }))
      act(() => result.current.toggleAlertKind('follow_up_due'))
      expect(result.current.visibleJobApplications.map(({ id }) => id).sort()).toEqual(['a', 'b'])
      act(() => result.current.toggleStatus('signed'))
      expect(result.current.visibleJobApplications).toEqual([])
    })

    it('stops hiding rows once the selected kind has no alert left', () => {
      const { result, rerender } = renderHook(({ currentAlerts }) => useController({ jobApplications, alerts: currentAlerts }), {
        initialProps: { currentAlerts: alerts },
      })
      act(() => result.current.toggleAlertKind('follow_up_due'))
      expect(result.current.visibleJobApplications).toHaveLength(2)
      rerender({ currentAlerts: [buildAlert('d', 'job_spec_missing')] })
      expect(result.current.selectedAlertKind).toBeNull()
      expect(result.current.visibleJobApplications).toHaveLength(3)
    })
  })

  it('expands and collapses the to-do list', () => {
    const { result } = renderHook(() => useController({ jobApplications, alerts: [] }))
    expect(result.current.isTodoListExpanded).toBe(false)
    act(() => result.current.toggleTodoListExpanded())
    expect(result.current.isTodoListExpanded).toBe(true)
    act(() => result.current.toggleTodoListExpanded())
    expect(result.current.isTodoListExpanded).toBe(false)
  })
})
