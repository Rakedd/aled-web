import { getLastActivityAging } from './last-activity-aging'

describe('getLastActivityAging', () => {
  const now = new Date('2026-10-19T10:00:00Z')

  it.each([
    ['3 days ago', '2026-10-16T10:00:00Z', 'recent'],
    ['7 days ago', '2026-10-12T10:00:00Z', 'aging'],
    ['14 days ago', '2026-10-05T10:00:00Z', 'aging'],
    ['15 days ago', '2026-10-04T10:00:00Z', 'stale'],
    ['in the future', '2026-10-25T10:00:00Z', 'recent'],
  ] as const)('classifies %s', (_description, lastActivityAt, expected) => {
    expect(getLastActivityAging({ status: 'cv_submitted', lastActivityAt: new Date(lastActivityAt) }, now)).toBe(expected)
  })

  it.each(['signed', 'ko_cv', 'no_news_abandoned'] as const)('returns null for terminal status %s', (status) => {
    expect(getLastActivityAging({ status, lastActivityAt: new Date('2026-09-19T10:00:00Z') }, now)).toBeNull()
  })

  it('returns null without last activity', () => {
    expect(getLastActivityAging({ status: 'cv_submitted', lastActivityAt: null }, now)).toBeNull()
  })

  it('counts Paris calendar days around midnight', () => {
    const lateEvening = new Date('2026-10-19T21:30:00Z')

    expect(getLastActivityAging({ status: 'cv_submitted', lastActivityAt: new Date('2026-10-12T22:30:00Z') }, lateEvening)).toBe('recent')
    expect(getLastActivityAging({ status: 'cv_submitted', lastActivityAt: new Date('2026-10-12T21:30:00Z') }, lateEvening)).toBe('aging')
  })
})
