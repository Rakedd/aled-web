import { act, renderHook, waitFor } from '@testing-library/react'
import { PILL_TONE_CLASS_NAMES } from '@/components/pill'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { INTERVIEW_KINDS, type InterviewWithJobApplication } from '@/domain/interviews'
import { EVENT_STYLES_BY_KIND, INTERVIEW_KIND_TONES, toCalendarEvents, useController } from './controller'

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
  location: 'Paris',
  remotePolicy: '2 jours sur site',
  postedDailyRate: 650,
  requestedDailyRate: null,
  desiredStart: 'ASAP',
  duration: '6 mois',
  postingRawText: 'Mission React pour une foncière',
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

describe('EVENT_STYLES_BY_KIND', () => {
  it('colours each interview kind with the atelier tokens', () => {
    expect(EVENT_STYLES_BY_KIND).toEqual({
      client: { className: 'interview-client', color: 'var(--peach)', contrastColor: 'var(--on-peach)' },
      mock: { className: 'interview-mock', color: 'var(--lilac)', contrastColor: 'var(--on-lilac)' },
      other: { className: 'interview-other', color: 'var(--hairline)', contrastColor: 'var(--ink)' },
    })
  })

  it('paints each event with the background of its legend pill', () => {
    expect(INTERVIEW_KIND_TONES).toEqual({ client: 'peach', mock: 'lilac', other: 'sage' })
    INTERVIEW_KINDS.forEach((interviewKind) => {
      const colorVariableName = EVENT_STYLES_BY_KIND[interviewKind].color.replace(/^var\(--(.+)\)$/, '$1')
      expect(PILL_TONE_CLASS_NAMES[INTERVIEW_KIND_TONES[interviewKind]]).toContain(`bg-${colorVariableName} `)
    })
  })
})

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
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    window.innerWidth = originalInnerWidth
  })

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

    act(() => result.current.selectInterview('interview-1', document.body))

    expect(result.current.revisionPanelContent).toEqual({
      interviewId: 'interview-1',
      jobApplicationTitle: 'Développeur React senior',
      endClientLabel: 'Acme',
      startsAtLabel: 'mer. 28/10 · 14h00',
      kindLabel: 'Entretien client',
      formatLabel: 'Visio',
      stackGroups: [
        { categoryLabel: 'Langage', stackItemNames: ['TypeScript'] },
        { categoryLabel: 'Framework', stackItemNames: ['React', 'Next.js'] },
      ],
      missionDetails: [
        { label: 'Lieu', value: 'Paris' },
        { label: 'Télétravail', value: '2 jours sur site' },
        { label: 'TJM annoncé', value: '650\u00a0€' },
        { label: 'Démarrage souhaité', value: 'ASAP' },
        { label: 'Durée', value: '6 mois' },
      ],
      postingRawText: 'Mission React pour une foncière',
      jobApplicationHref: `/candidatures/${JOB_APPLICATION_ID}`,
      briefHref: `/candidatures/${JOB_APPLICATION_ID}?onglet=entretiens`,
    })

    act(() => result.current.closePanel())

    expect(result.current.revisionPanelContent).toBeNull()
  })

  it('gives focus back to the clicked event when the panel closes', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview()] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))
    const clickedEventElement = document.createElement('a')
    clickedEventElement.tabIndex = 0
    document.body.append(clickedEventElement)

    act(() => result.current.selectInterview('interview-1', clickedEventElement))
    act(() => result.current.closePanel())

    expect(clickedEventElement).toHaveFocus()
    clickedEventElement.remove()
  })

  it('gives focus back to the calendar when the clicked event is gone', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview()] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))
    const calendarContainer = document.createElement('div')
    calendarContainer.tabIndex = -1
    document.body.append(calendarContainer)
    result.current.calendarContainerRef.current = calendarContainer
    const clickedEventElement = document.createElement('a')
    clickedEventElement.tabIndex = 0

    act(() => result.current.selectInterview('interview-1', clickedEventElement))
    act(() => result.current.closePanel())

    expect(calendarContainer).toHaveFocus()
    calendarContainer.remove()
  })

  it('keeps calendar events identity across panel interactions', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview()] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))
    const eventsBeforeInteraction = result.current.calendarEvents

    act(() => result.current.selectInterview('interview-1', document.body))
    expect(result.current.calendarEvents).toBe(eventsBeforeInteraction)

    act(() => result.current.closePanel())
    expect(result.current.calendarEvents).toBe(eventsBeforeInteraction)
  })

  it('lists every filled mission detail, including both daily rates, and nothing for empty ones', async () => {
    const listUpcomingInterviews = jest.fn().mockResolvedValue({
      ok: true,
      data: [
        buildInterview({
          location: null,
          remotePolicy: '  ',
          postedDailyRate: 0,
          requestedDailyRate: 1200,
          desiredStart: null,
          duration: null,
          postingRawText: null,
        }),
      ],
    })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    act(() => result.current.selectInterview('interview-1', document.body))

    expect(result.current.revisionPanelContent?.missionDetails).toEqual([
      { label: 'TJM annoncé', value: '0\u00a0€' },
      { label: 'TJM demandé', value: '1\u202f200\u00a0€' },
    ])
    expect(result.current.revisionPanelContent?.postingRawText).toBeNull()
  })

  it('removes case-insensitive duplicate stack names within a category', async () => {
    const stack = [
      { name: 'React', category: 'framework' as const, origin: 'posting' as const },
      { name: 'react', category: 'framework' as const, origin: 'job_spec' as const },
    ]
    const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [buildInterview({ stack })] })
    const { result } = renderHook(() => useController({ listUpcomingInterviews }))
    await act(() => result.current.onDatesSet(RANGE_START, RANGE_END))

    act(() => result.current.selectInterview('interview-1', document.body))

    expect(result.current.revisionPanelContent?.stackGroups).toEqual([
      { categoryLabel: 'Framework', stackItemNames: ['React'] },
    ])
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
