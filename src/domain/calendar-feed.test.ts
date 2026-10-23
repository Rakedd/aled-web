import {
  buildCalendarFeed,
  buildCalendarFeedPathname,
  buildGoogleCalendarSubscriptionUrl,
  type CalendarFeedEvent,
  escapeICalendarText,
  foldICalendarLine,
  formatCalendarFeedActiveSince,
  formatICalendarUtcDateTime,
  toWebcalUrl,
} from './calendar-feed'

const countUtf8Octets = (text: string): number => Buffer.byteLength(text, 'utf8')

const buildCalendarFeedEvent = (overrides: Partial<CalendarFeedEvent> = {}): CalendarFeedEvent => ({
  id: '11111111-1111-4111-8111-111111111111',
  jobApplicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  startsAt: new Date('2026-10-27T09:30:00.000Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  jobApplicationTitle: 'Dev React senior',
  endClientLabel: null,
  intermediaryName: null,
  jobApplicationLocation: null,
  jobApplicationUrl: 'https://app.aled.work/candidatures/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ...overrides,
})

describe('escapeICalendarText', () => {
  it('escapes backslashes, semicolons, commas and every kind of line break', () => {
    expect(escapeICalendarText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng')
  })

  it('removes the control characters a calendar refuses, but keeps tabs and escaped line breaks', () => {
    expect(escapeICalendarText('Dev\u0000 React\u0008\u000B\u000C\u000E\u001F\u007F\tsenior\r\nParis')).toBe(
      'Dev React\tsenior\\nParis',
    )
  })

  it('leaves plain text untouched', () => {
    expect(escapeICalendarText('Entretien client · BNP Paribas')).toBe('Entretien client · BNP Paribas')
  })
})

describe('foldICalendarLine', () => {
  it('keeps a line of 75 octets on one line', () => {
    const line = 'A'.repeat(75)
    expect(foldICalendarLine(line)).toBe(line)
  })

  it('folds a longer line at 75 octets, then 74 octets after the leading space', () => {
    const line = 'A'.repeat(160)
    expect(foldICalendarLine(line)).toBe(`${'A'.repeat(75)}\r\n ${'A'.repeat(74)}\r\n ${'A'.repeat(11)}`)
  })

  it('never splits an accented character across two lines', () => {
    const line = `${'A'.repeat(74)}éé`
    const foldedLines = foldICalendarLine(line).split('\r\n')
    expect(foldedLines).toEqual(['A'.repeat(74), ' éé'])
  })

  it('never splits an emoji and keeps every line within 75 octets', () => {
    const line = `SUMMARY:${'🎉'.repeat(30)}`
    const foldedLines = foldICalendarLine(line).split('\r\n')
    foldedLines.forEach((foldedLine) => expect(countUtf8Octets(foldedLine)).toBeLessThanOrEqual(75))
    expect(foldedLines.map((foldedLine, lineIndex) => (lineIndex === 0 ? foldedLine : foldedLine.slice(1))).join('')).toBe(
      line,
    )
    expect(foldedLines.join('')).not.toContain('�')
    expect(foldedLines[0]).toBe(`SUMMARY:${'🎉'.repeat(16)}`)
  })
})

describe('formatICalendarUtcDateTime', () => {
  it('formats a date as a UTC date-time without separators', () => {
    expect(formatICalendarUtcDateTime(new Date('2026-03-05T07:04:09.123Z'))).toBe('20260305T070409Z')
  })
})

describe('buildCalendarFeed', () => {
  it('builds a complete feed with one VEVENT per interview, every line ending with CRLF', () => {
    const calendarFeed = buildCalendarFeed(
      [
        buildCalendarFeedEvent({
          endClientLabel: 'BNP Paribas',
          participants: 'Marie Dupont, CTO',
          intermediaryName: 'Hays',
        }),
        buildCalendarFeedEvent({
          id: '22222222-2222-4222-8222-222222222222',
          startsAt: new Date('2026-11-03T14:00:00.000Z'),
          kind: 'mock',
          format: 'onsite',
          jobApplicationTitle: 'Lead front',
          jobApplicationLocation: 'Paris 9e',
          jobApplicationUrl: 'https://app.aled.work/candidatures/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }),
      ],
      { generatedAt: new Date('2026-10-23T12:00:00.000Z') },
    )

    expect(calendarFeed).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Aled//Entretiens//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Aled · Entretiens',
        'X-WR-TIMEZONE:Europe/Paris',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
        'BEGIN:VEVENT',
        'UID:11111111-1111-4111-8111-111111111111@aled.work',
        'DTSTAMP:20261023T120000Z',
        'DTSTART:20261027T093000Z',
        'DTEND:20261027T103000Z',
        'SUMMARY:Entretien client · Dev React senior · BNP Paribas',
        'LOCATION:Visio',
        'DESCRIPTION:Interlocuteurs : Marie Dupont\\, CTO\\nIntermédiaire : Hays\\nhtt',
        ' ps://app.aled.work/candidatures/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:22222222-2222-4222-8222-222222222222@aled.work',
        'DTSTAMP:20261023T120000Z',
        'DTSTART:20261103T140000Z',
        'DTEND:20261103T150000Z',
        'SUMMARY:Entretien blanc · Lead front',
        'LOCATION:Sur site · Paris 9e',
        'DESCRIPTION:https://app.aled.work/candidatures/bbbbbbbb-bbbb-4bbb-8bbb-bbbb',
        ' bbbbbbbb',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
    )
  })

  it('builds an empty calendar when there is no interview', () => {
    const calendarFeed = buildCalendarFeed([], { generatedAt: new Date('2026-10-23T12:00:00.000Z') })
    expect(calendarFeed.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(calendarFeed.endsWith('X-PUBLISHED-TTL:PT1H\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(calendarFeed).not.toContain('BEGIN:VEVENT')
  })

  it('shows only the format when an on-site interview has no known location', () => {
    const calendarFeed = buildCalendarFeed([buildCalendarFeedEvent({ format: 'onsite', jobApplicationLocation: '  ' })], {
      generatedAt: new Date('2026-10-23T12:00:00.000Z'),
    })
    expect(calendarFeed).toContain('\r\nLOCATION:Sur site\r\n')
  })

  it('ignores the location of a remote interview', () => {
    const calendarFeed = buildCalendarFeed(
      [buildCalendarFeedEvent({ format: 'phone', jobApplicationLocation: 'Lyon' })],
      { generatedAt: new Date('2026-10-23T12:00:00.000Z') },
    )
    expect(calendarFeed).toContain('\r\nLOCATION:Téléphone\r\n')
  })

  it('escapes the free text of the job application', () => {
    const calendarFeed = buildCalendarFeed(
      [buildCalendarFeedEvent({ jobApplicationTitle: 'Dev React; Node, AWS' })],
      { generatedAt: new Date('2026-10-23T12:00:00.000Z') },
    )
    expect(calendarFeed).toContain('\r\nSUMMARY:Entretien client · Dev React\\; Node\\, AWS\r\n')
  })
})

describe('calendar feed urls', () => {
  it('builds the published path of a token with the .ics suffix', () => {
    expect(buildCalendarFeedPathname('abc_DEF-123')).toBe('/api/calendar/abc_DEF-123.ics')
  })

  it.each([
    ['https://app.aled.work/api/calendar/abc.ics', 'webcal://app.aled.work/api/calendar/abc.ics'],
    ['http://localhost:3000/api/calendar/abc.ics', 'webcal://localhost:3000/api/calendar/abc.ics'],
  ])('turns %s into a webcal url', (feedUrl, expectedWebcalUrl) => {
    expect(toWebcalUrl(feedUrl)).toBe(expectedWebcalUrl)
  })

  it('builds the Google Agenda subscription url from the encoded webcal url', () => {
    expect(buildGoogleCalendarSubscriptionUrl('https://app.aled.work/api/calendar/abc.ics')).toBe(
      'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fapp.aled.work%2Fapi%2Fcalendar%2Fabc.ics',
    )
  })
})

describe('formatCalendarFeedActiveSince', () => {
  it('shows the Paris date the feed was created', () => {
    expect(formatCalendarFeedActiveSince(new Date('2026-10-22T23:30:00.000Z'))).toBe('Flux actif depuis le 23/10/2026')
  })
})
