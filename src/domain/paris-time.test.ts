import { PARIS_TIME_ZONE, countParisCalendarDaysBetween, formatRelativeDaysAgo } from './paris-time'

describe('PARIS_TIME_ZONE', () => {
  it('is the Europe/Paris IANA zone', () => {
    expect(PARIS_TIME_ZONE).toBe('Europe/Paris')
  })
})

describe('countParisCalendarDaysBetween', () => {
  it('counts Paris calendar days, not 24h blocks', () => {
    expect(countParisCalendarDaysBetween(new Date('2026-10-16T21:30:00Z'), new Date('2026-10-17T06:00:00Z'))).toBe(1)
    expect(countParisCalendarDaysBetween(new Date('2026-10-17T08:00:00Z'), new Date('2026-10-17T20:00:00Z'))).toBe(0)
  })
  it('survives the winter time change', () => {
    expect(countParisCalendarDaysBetween(new Date('2026-10-24T10:00:00Z'), new Date('2026-10-26T10:00:00Z'))).toBe(2)
  })
})

describe('formatRelativeDaysAgo', () => {
  const now = new Date('2026-10-17T10:00:00Z')

  it('says today for the same Paris calendar day', () => {
    expect(formatRelativeDaysAgo(new Date('2026-10-16T22:30:00Z'), now)).toBe("aujourd'hui")
  })
  it('says yesterday for the previous Paris calendar day', () => {
    expect(formatRelativeDaysAgo(new Date('2026-10-16T21:30:00Z'), now)).toBe('hier')
  })
  it('counts days for anything older', () => {
    expect(formatRelativeDaysAgo(new Date('2026-10-12T10:00:00Z'), now)).toBe('il y a 5 j')
  })
})
