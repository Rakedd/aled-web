import { NO_NEWS_SUGGESTION_DAYS, UPCOMING_INTERVIEW_WINDOW_DAYS, computeTodoAlerts } from './todo-alerts'

describe('todo alert thresholds', () => {
  it('suggests no news after 21 days and shows interviews 7 days ahead', () => {
    expect(NO_NEWS_SUGGESTION_DAYS).toBe(21)
    expect(UPCOMING_INTERVIEW_WINDOW_DAYS).toBe(7)
  })
})

describe('computeTodoAlerts', () => {
  const now = new Date('2026-10-17T10:00:00Z')
  const baseApplication = { id: 'a1', title: 'Dev React senior', appliedOn: new Date('2026-10-01T10:00:00Z'), lastActivityAt: null, hasJobSpec: true, hasEndClient: true }

  it('raises follow_up_due after the configured delay on cv_submitted', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-10-10T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['follow_up_due'])
  })
  it('does not raise follow_up_due one day before the delay', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-10-11T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts).toEqual([])
  })
  it('raises job_spec_missing from cv_submitted onwards', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'interview_done', hasJobSpec: false, lastActivityAt: now }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['job_spec_missing'])
  })
  it('raises end_client_unknown only when an interview is scheduled', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'interview_scheduled', hasEndClient: false, lastActivityAt: now }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['end_client_unknown'])
  })
  it('replaces follow_up_due by no_news_suggestion after 21 days', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'cv_submitted', lastActivityAt: new Date('2026-09-25T10:00:00Z') }], interviews: [], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts.map((alert) => alert.kind)).toEqual(['no_news_suggestion'])
  })
  it('lists interviews in the next 7 days first, sorted by date', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled', hasJobSpec: false, lastActivityAt: now }],
      interviews: [
        { id: 'i2', jobApplicationId: 'a1', startsAt: new Date('2026-10-22T12:00:00Z'), kind: 'client' },
        { id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'mock' },
        { id: 'i3', jobApplicationId: 'a1', startsAt: new Date('2026-10-30T08:00:00Z'), kind: 'client' },
      ],
      snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts.map((alert) => alert.interviewId ?? alert.kind)).toEqual(['i1', 'i2', 'job_spec_missing'])
  })
  it('includes an interview on Paris day +7 even later in the day than now', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled', lastActivityAt: now }],
      interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-24T14:00:00Z'), kind: 'client' }],
      snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts.map((alert) => alert.interviewId)).toEqual(['i1'])
  })
  it('excludes an interview on Paris day +8', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled', lastActivityAt: now }],
      interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-25T08:00:00Z'), kind: 'client' }],
      snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts).toEqual([])
  })
  it('excludes interviews already past', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled', lastActivityAt: now }],
      interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-17T09:00:00Z'), kind: 'client' }],
      snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts).toEqual([])
  })
  it('hides snoozed alerts until the snooze expires, never snoozes interviews', () => {
    const input = {
      jobApplications: [{ ...baseApplication, status: 'interview_scheduled' as const, hasJobSpec: false, lastActivityAt: now }],
      interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'client' as const }],
      snoozes: [
        { jobApplicationId: 'a1', alertKind: 'job_spec_missing' as const, snoozedUntil: new Date('2026-10-20T00:00:00Z') },
        { jobApplicationId: 'a1', alertKind: 'upcoming_interview' as const, snoozedUntil: new Date('2026-10-20T00:00:00Z') },
      ],
      now, followUpDelayDays: 7,
    }
    expect(computeTodoAlerts(input).map((alert) => alert.kind)).toEqual(['upcoming_interview'])
    expect(computeTodoAlerts({ ...input, now: new Date('2026-10-20T01:00:00Z') }).map((alert) => alert.kind)).toContain('job_spec_missing')
  })
  it('ignores terminal applications entirely', () => {
    const alerts = computeTodoAlerts({ jobApplications: [{ ...baseApplication, status: 'ko_cv', hasJobSpec: false }], interviews: [{ id: 'i1', jobApplicationId: 'a1', startsAt: new Date('2026-10-18T08:00:00Z'), kind: 'client' }], snoozes: [], now, followUpDelayDays: 7 })
    expect(alerts).toEqual([])
  })
  it('sorts non-interview alerts by kind, then by reference date', () => {
    const alerts = computeTodoAlerts({
      jobApplications: [
        { ...baseApplication, id: 'a1', status: 'cv_submitted', hasJobSpec: false, lastActivityAt: new Date('2026-10-09T10:00:00Z') },
        { ...baseApplication, id: 'a2', status: 'cv_submitted', lastActivityAt: new Date('2026-10-08T10:00:00Z') },
        { ...baseApplication, id: 'a3', status: 'applied', lastActivityAt: new Date('2026-09-20T10:00:00Z') },
      ],
      interviews: [], snoozes: [], now, followUpDelayDays: 7,
    })
    expect(alerts.map((alert) => `${alert.kind}:${alert.jobApplicationId}`)).toEqual([
      'follow_up_due:a2',
      'follow_up_due:a1',
      'job_spec_missing:a1',
      'no_news_suggestion:a3',
    ])
  })
})
