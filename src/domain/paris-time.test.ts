import {
  PARIS_TIME_ZONE,
  addParisCalendarDays,
  countParisCalendarDaysBetween,
  formatParisCalendarDate,
  formatRelativeDaysAgo,
  parseParisCalendarDate,
} from './paris-time'

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

describe('parseParisCalendarDate', () => {
  it('reads a calendar date as midnight in Paris', () => {
    expect(parseParisCalendarDate('2026-10-17')).toEqual(new Date('2026-10-16T22:00:00Z'))
    expect(parseParisCalendarDate('2026-12-01')).toEqual(new Date('2026-11-30T23:00:00Z'))
  })
})

describe('formatParisCalendarDate', () => {
  it('writes the Paris calendar date of an instant', () => {
    expect(formatParisCalendarDate(new Date('2026-10-16T22:30:00Z'))).toBe('2026-10-17')
    expect(formatParisCalendarDate(new Date('2026-10-16T21:30:00Z'))).toBe('2026-10-16')
  })

  it('round-trips with parseParisCalendarDate', () => {
    expect(formatParisCalendarDate(parseParisCalendarDate('2026-03-29'))).toBe('2026-03-29')
  })
})

describe('addParisCalendarDays', () => {
  it('keeps the Paris wall-clock time across the winter time change', () => {
    expect(addParisCalendarDays(new Date('2026-10-24T08:00:00Z'), 3)).toEqual(new Date('2026-10-27T09:00:00Z'))
  })
})
