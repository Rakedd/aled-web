import { act, renderHook } from '@testing-library/react'
import type { JobApplicationListItem } from '@/domain/job-application'
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
    const { result } = renderHook(() => useController({ jobApplications }))
    expect(result.current.availableSources).toEqual(['Free-Work', 'LinkedIn'])
  })

  it('hides terminal applications until asked', () => {
    const { result } = renderHook(() => useController({ jobApplications }))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).not.toContain('c')
    act(() => result.current.setShowTerminal(true))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toContain('c')
  })

  it('sorts by last activity descending at first', () => {
    const { result } = renderHook(() => useController({ jobApplications }))
    expect(result.current.sort).toEqual({ key: 'lastActivityAt', direction: 'desc' })
  })

  it('sorts a new column ascending then reverses on the second click', () => {
    const { result } = renderHook(() => useController({ jobApplications }))
    act(() => result.current.toggleSort('title'))
    expect(result.current.sort).toEqual({ key: 'title', direction: 'asc' })
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['a', 'b', 'd'])
    act(() => result.current.toggleSort('title'))
    expect(result.current.sort).toEqual({ key: 'title', direction: 'desc' })
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['d', 'b', 'a'])
  })

  it('filters by search text and source', () => {
    const { result } = renderHook(() => useController({ jobApplications }))
    act(() => result.current.setSearchText('brav'))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['b'])
    act(() => result.current.setSearchText(''))
    act(() => result.current.toggleSource('LinkedIn'))
    expect(result.current.visibleJobApplications.map(({ id }) => id)).toEqual(['a'])
    act(() => result.current.toggleSource('LinkedIn'))
    expect(result.current.visibleJobApplications).toHaveLength(3)
  })

  it('toggles a status filter', () => {
    const { result } = renderHook(() => useController({ jobApplications }))
    act(() => result.current.toggleStatus('applied'))
    expect(result.current.filters.statuses).toEqual(['applied'])
    act(() => result.current.toggleStatus('applied'))
    expect(result.current.filters.statuses).toEqual([])
  })
})
