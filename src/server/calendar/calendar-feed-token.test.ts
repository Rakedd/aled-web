/** @jest-environment node */
import { createHash } from 'node:crypto'
import { extractCalendarFeedToken, generateCalendarFeedToken, hashCalendarFeedToken } from './calendar-feed-token'

jest.mock('server-only', () => ({}))

const WELL_FORMED_TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE'

describe('generateCalendarFeedToken', () => {
  it('generates a 43 character base64url token from 32 random bytes', () => {
    const calendarFeedToken = generateCalendarFeedToken()
    expect(calendarFeedToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(calendarFeedToken, 'base64url')).toHaveLength(32)
  })

  it('generates a different token every time', () => {
    expect(generateCalendarFeedToken()).not.toBe(generateCalendarFeedToken())
  })
})

describe('hashCalendarFeedToken', () => {
  it('returns the hexadecimal SHA-256 of the token', () => {
    expect(hashCalendarFeedToken(WELL_FORMED_TOKEN)).toBe(
      createHash('sha256').update(WELL_FORMED_TOKEN).digest('hex'),
    )
    expect(hashCalendarFeedToken(WELL_FORMED_TOKEN)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('extractCalendarFeedToken', () => {
  it('accepts a well formed token with or without the .ics suffix', () => {
    expect(extractCalendarFeedToken(WELL_FORMED_TOKEN)).toBe(WELL_FORMED_TOKEN)
    expect(extractCalendarFeedToken(`${WELL_FORMED_TOKEN}.ics`)).toBe(WELL_FORMED_TOKEN)
  })

  it.each([
    ['an empty segment', ''],
    ['the suffix alone', '.ics'],
    ['a token that is too short', WELL_FORMED_TOKEN.slice(1)],
    ['a token that is too long', `${WELL_FORMED_TOKEN}A`],
    ['a token with a forbidden character', `${WELL_FORMED_TOKEN.slice(1)}=`],
    ['a token with a double suffix', `${WELL_FORMED_TOKEN}.ics.ics`],
  ])('rejects %s', (_caseName, pathSegment) => {
    expect(extractCalendarFeedToken(pathSegment)).toBeNull()
  })
})
