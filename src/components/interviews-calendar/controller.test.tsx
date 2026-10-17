import { act, renderHook, waitFor } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import { toCalendarEvents, useController } from './controller'

const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'

const buildInterview = (overrides: Partial<InterviewWithJobApplication> = {}): InterviewWithJobApplication => ({
  id: 'interview-1',
  jobApplicationId: JOB_APPLICATION_ID,
  startsAt: new Date('2026-10-28T13:00:00Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
  jobApplicationTitle: 'Développeur React senior',
  endClientLabel: 'Acme',
  stack: [
    { name: 'TypeScript', category: 'language', origin: 'posting' },
    { name: 'React', category: 'framework', origin: 'posting' },
    { name: 'Next.js', category: 'framework', origin: 'job_spec' },
  ],
  ...overrides,
})

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const RANGE_START = new Date('2026-09-28T00:00:00Z')
const RANGE_END = new Date('2026-11-09T00:00:00Z')

describe('toCalendarEvents', () => {
  it('gives distinct class names to client and mock interviews', () => {
    const events = toCalendarEvents([
      buildInterview({ id: 'client-interview', kind: 'client' }),
      buildInterview({ id: 'mock-interview', kind: 'mock' }),
      buildInterview({ id: 'other-interview', kind: 'other' }),
    ])

    expect(events.map((event) => event.className)).toEqual(['interview-client', 'interview-mock', 'interview-other'])
    expect(events[1].title).toBe('Entretien blanc · Développeur React senior')
    expect(events[0].start).toBe('2026-10-28T13:00:00.000Z')
  })
})

describe('useController', () => {
  it('reloads the interviews of the newly visible range', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview()] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))

    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    expect(listUpcomingInterviews).toHaveBeenCalledWith(RANGE_START, RANGE_END)
    expect(result.current.calendarEvents).toHaveLength(1)
  })

  it('ignores a slower response belonging to a previous range', async () => {
    const slowResponse = createDeferred<{ ok: true; data: InterviewWithJobApplication[] }>()
    const listUpcomingInterviews = jest
      .fn()
      .mockReturnValueOnce(slowResponse.promise)
      .mockResolvedValueOnce({ ok: true, data: [buildInterview({ id: 'current-range' })] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))

    let slowLoad: Promise<void> = Promise.resolve()
    act(() => {
      slowLoad = result.current.onDatesSet(RANGE_START, RANGE_END)
    })
    await act(() => result.current.onDatesSet(RANGE_END, new Date('2026-12-20T00:00:00Z')))
    await act(async () => {
      slowResponse.resolve({ ok: true, data: [buildInterview({ id: 'stale-range' })] })
      await slowLoad
    })

    expect(result.current.calendarEvents.map((event) => event.id)).toEqual(['current-range'])
  })

  it('shows the action error message when loading fails', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Chargement impossible' })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))

    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    expect(result.current.errorMessage).toBe('Chargement impossible')
  })

  it('shows the generic error message when the action rejects', async () => {
    const listUpcomingInterviews = jest.fn().mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))

    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
  })

  it('opens the revision panel with title, end client, grouped stack and application link, then closes it', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview()] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    act(() => result.current.selectInterview('interview-1'))

    expect(result.current.revisionPanelContent).toEqual({
      jobApplicationTitle: 'Développeur React senior',
      endClientLabel: 'Acme',
      startsAtLabel: 'mer. 28/10 · 14h00',
      kindLabel: 'Entretien client',
      formatLabel: 'Visio',
      stackGroups: [
        { categoryLabel: 'Langage', stackItemNames: ['TypeScript'] },
        { categoryLabel: 'Framework', stackItemNames: ['React', 'Next.js'] },
      ],
      jobApplicationHref: `/candidatures/${JOB_APPLICATION_ID}`,
    })

    act(() => result.current.closePanel())

    expect(result.current.revisionPanelContent).toBeNull()
  })

  it('picks the list view on narrow screens and the month view otherwise', async () => {
    const listUpcomingInterviews = jest.fn()
    window.innerWidth = 375
    const narrow = renderHook(() => useController({ listUpcomingInterviews }))
    await waitFor(() => expect(narrow.result.current.initialView).toBe('listWeek'))

    window.innerWidth = 1280
    const wide = renderHook(() => useController({ listUpcomingInterviews }))
    await waitFor(() => expect(wide.result.current.initialView).toBe('dayGridMonth'))
  })
})
