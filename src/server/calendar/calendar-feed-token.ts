import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

const CALENDAR_FEED_TOKEN_BYTE_LENGTH = 32
const CALENDAR_FEED_FILE_SUFFIX = '.ics'
const WELL_FORMED_CALENDAR_FEED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export const generateCalendarFeedToken = (): string =>
  randomBytes(CALENDAR_FEED_TOKEN_BYTE_LENGTH).toString('base64url')

export const hashCalendarFeedToken = (calendarFeedToken: string): string =>
  createHash('sha256').update(calendarFeedToken).digest('hex')

export const extractCalendarFeedToken = (pathSegment: string): string | null => {
  const calendarFeedToken = pathSegment.endsWith(CALENDAR_FEED_FILE_SUFFIX)
    ? pathSegment.slice(0, -CALENDAR_FEED_FILE_SUFFIX.length)
    : pathSegment
  return WELL_FORMED_CALENDAR_FEED_TOKEN_PATTERN.test(calendarFeedToken) ? calendarFeedToken : null
}
