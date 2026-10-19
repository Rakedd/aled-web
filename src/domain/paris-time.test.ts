import {
  PARIS_TIME_ZONE,
  addParisCalendarDays,
  countParisCalendarDaysBetween,
  formatParisCalendarDate,
  formatParisDate,
  formatInterviewCountdown,
  formatParisDateTime,
  formatParisDayBlock,
  formatParisInterviewDateTime,
  formatParisLocalDateTime,
  formatParisLongDate,
  formatParisTime,
  formatParisWeekdayName,
  formatRelativeDaysAgo,
  parisLocalDateTimeToUtc,
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

describe('formatParisDateTime', () => {
  it('formats in Paris time across the daylight saving change', () => {
    expect(formatParisDateTime(new Date('2026-10-17T22:30:00Z'))).toBe('18/10/2026 00:30')
    expect(formatParisDateTime(new Date('2026-12-01T22:30:00Z'))).toBe('01/12/2026 23:30')
  })
})

describe('formatParisDate', () => {
  it('formats the Paris calendar date', () => {
    expect(formatParisDate(new Date('2026-10-17T22:30:00Z'))).toBe('18/10/2026')
  })
})

describe('parisLocalDateTimeToUtc', () => {
  it('stores 14:00 Paris as 13:00 UTC in winter and 12:00 UTC in summer', () => {
    expect(parisLocalDateTimeToUtc('2026-10-28T14:00').toISOString()).toBe('2026-10-28T13:00:00.000Z')
    expect(parisLocalDateTimeToUtc('2026-07-01T14:00').toISOString()).toBe('2026-07-01T12:00:00.000Z')
  })

  it('reads an ambiguous autumn wall-clock time as its first occurrence, in summer time', () => {
    expect(parisLocalDateTimeToUtc('2026-10-25T02:30').toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  it('returns an invalid date for a wall-clock time skipped by the spring time change', () => {
    expect(Number.isNaN(parisLocalDateTimeToUtc('2026-03-29T02:30').getTime())).toBe(true)
  })

  it('returns an invalid date for a malformed value', () => {
    expect(Number.isNaN(parisLocalDateTimeToUtc('28/10/2026 14:00').getTime())).toBe(true)
  })

  it('returns an invalid date for an impossible calendar date', () => {
    expect(Number.isNaN(parisLocalDateTimeToUtc('2026-02-30T10:00').getTime())).toBe(true)
  })
})

describe('formatParisInterviewDateTime', () => {
  it('formats back to Paris time regardless of process timezone', () => {
    expect(formatParisInterviewDateTime(new Date('2026-10-28T13:00:00Z'))).toBe('mer. 28/10 · 14h00')
  })
})

describe('formatParisLocalDateTime', () => {
  it('writes the Paris wall-clock time of an instant for a datetime-local field', () => {
    expect(formatParisLocalDateTime(new Date('2026-10-28T13:00:00Z'))).toBe('2026-10-28T14:00')
  })

  it('round-trips with parisLocalDateTimeToUtc', () => {
    expect(formatParisLocalDateTime(parisLocalDateTimeToUtc('2026-07-01T09:30'))).toBe('2026-07-01T09:30')
  })
})

describe('formatInterviewCountdown', () => {
  const NOW = new Date('2026-10-19T08:00:00Z')

  it.each([
    [NOW, '2026-10-19T14:00:00Z', "aujourd'hui"],
    [NOW, '2026-10-22T08:00:00Z', 'dans 3 jours'],
    [new Date('2026-10-19T21:30:00Z'), '2026-10-19T22:30:00Z', 'demain'],
    [new Date('2026-10-24T22:30:00Z'), '2026-10-25T23:30:00Z', 'demain'],
    [new Date('2026-10-24T21:30:00Z'), '2026-10-25T23:30:00Z', 'dans 2 jours'],
  ])('counts Paris calendar days from %s to %s', (now, startsAt, expectedCountdown) => {
    expect(formatInterviewCountdown(new Date(startsAt), now)).toBe(expectedCountdown)
  })
})

describe('Paris date formatters', () => {
  it('formats a capitalised long date in Paris time', () => {
    expect(formatParisLongDate(new Date('2026-10-19T08:00:00Z'))).toBe('Lundi 19 octobre')
    expect(formatParisLongDate(new Date('2026-10-19T22:30:00Z'))).toBe('Mardi 20 octobre')
  })

  it('formats the weekday and day block', () => {
    expect(formatParisDayBlock(new Date('2026-10-22T08:00:00Z'))).toEqual({ weekday: 'JEU', day: '22' })
  })

  it('formats the time of day', () => {
    expect(formatParisTime(new Date('2026-10-22T08:00:00Z'))).toBe('10h00')
  })
})

describe('formatParisWeekdayName', () => {
  it('returns the lowercase French weekday in Paris', () => {
    expect(formatParisWeekdayName(new Date('2026-10-22T08:00:00Z'))).toBe('jeudi')
  })
})
