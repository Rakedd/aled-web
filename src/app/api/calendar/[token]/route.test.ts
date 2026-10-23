/** @jest-environment node */
import { NextRequest } from 'next/server'
import type { CalendarFeedInterview } from '@/domain/calendar-feed'
import { hashCalendarFeedToken } from '@/server/calendar/calendar-feed-token'
import { findCalendarFeedOwnerUserId } from '@/server/repositories/calendar-feeds-repository'
import { findInterviewsForCalendarFeed } from '@/server/repositories/interviews-repository'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { GET } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-service-role-supabase-client', () => ({ createServiceRoleSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/calendar-feeds-repository', () => ({ findCalendarFeedOwnerUserId: jest.fn() }))
jest.mock('@/server/repositories/interviews-repository', () => ({ findInterviewsForCalendarFeed: jest.fn() }))

const createServiceRoleSupabaseClientMock = jest.mocked(createServiceRoleSupabaseClient)
const findCalendarFeedOwnerUserIdMock = jest.mocked(findCalendarFeedOwnerUserId)
const findInterviewsForCalendarFeedMock = jest.mocked(findInterviewsForCalendarFeed)

const CALENDAR_FEED_TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE'
const OWNER_USER_ID = 'owner-user-id'
const NOW = new Date('2026-10-23T12:00:00.000Z')
const fakeServiceRoleSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const originalAppOrigin = process.env.APP_ORIGIN

const storedInterview: CalendarFeedInterview = {
  id: '11111111-1111-4111-8111-111111111111',
  jobApplicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  startsAt: new Date('2026-10-27T09:30:00.000Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  jobApplicationTitle: 'Dev React senior',
  endClientLabel: 'BNP Paribas',
  intermediaryName: null,
  jobApplicationLocation: null,
}

const requestCalendarFeed = (pathSegment: string) =>
  GET(new NextRequest(`http://localhost:3000/api/calendar/${pathSegment}`), {
    params: Promise.resolve({ token: pathSegment }),
  })

describe('GET /api/calendar/[token]', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] })
    process.env.APP_ORIGIN = 'https://app.aled.work'
    createServiceRoleSupabaseClientMock.mockReturnValue(fakeServiceRoleSupabase)
    findCalendarFeedOwnerUserIdMock.mockResolvedValue(OWNER_USER_ID)
    findInterviewsForCalendarFeedMock.mockResolvedValue([storedInterview])
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    process.env.APP_ORIGIN = originalAppOrigin
  })

  it.each([
    ['an empty token', ''],
    ['the suffix alone', '.ics'],
    ['a token that is too short', `${CALENDAR_FEED_TOKEN.slice(1)}.ics`],
    ['a token that is too long', `${CALENDAR_FEED_TOKEN}A.ics`],
    ['a token with a forbidden character', `${CALENDAR_FEED_TOKEN.slice(1)}%.ics`],
  ])('answers an empty 404 without touching the database for %s', async (_caseName, pathSegment) => {
    const response = await requestCalendarFeed(pathSegment)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(createServiceRoleSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('answers an empty 404 without loading any interview for an unknown token', async () => {
    findCalendarFeedOwnerUserIdMock.mockResolvedValue(null)

    const response = await requestCalendarFeed(`${CALENDAR_FEED_TOKEN}.ics`)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
    expect(findInterviewsForCalendarFeedMock).not.toHaveBeenCalled()
  })

  it('serves the calendar of the token owner, from 90 days ago to 365 days ahead', async () => {
    const response = await requestCalendarFeed(`${CALENDAR_FEED_TOKEN}.ics`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toBe('inline; filename="aled.ics"')
    expect(findCalendarFeedOwnerUserIdMock).toHaveBeenCalledWith(
      fakeServiceRoleSupabase,
      hashCalendarFeedToken(CALENDAR_FEED_TOKEN),
    )
    expect(findInterviewsForCalendarFeedMock).toHaveBeenCalledWith(fakeServiceRoleSupabase, OWNER_USER_ID, {
      from: new Date('2026-07-25T12:00:00.000Z'),
      now: NOW,
      to: new Date('2027-10-23T12:00:00.000Z'),
    })
    const calendarFeed = await response.text()
    expect(calendarFeed.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(calendarFeed).toContain('\r\nUID:11111111-1111-4111-8111-111111111111@aled.work\r\n')
    expect(calendarFeed).toContain('\r\nDTSTAMP:20261023T120000Z\r\n')
    expect(calendarFeed).toContain('\r\nSUMMARY:Entretien client · Dev React senior · BNP Paribas\r\n')
    expect(calendarFeed.replace(/\r\n /g, '')).toContain(
      '\r\nDESCRIPTION:https://app.aled.work/candidatures/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\r\n',
    )
  })

  it('also accepts the token without the .ics suffix', async () => {
    const response = await requestCalendarFeed(CALENDAR_FEED_TOKEN)

    expect(response.status).toBe(200)
    expect(findCalendarFeedOwnerUserIdMock).toHaveBeenCalledWith(
      fakeServiceRoleSupabase,
      hashCalendarFeedToken(CALENDAR_FEED_TOKEN),
    )
  })

  it('links the job applications on the request origin when the app origin is not configured', async () => {
    process.env.APP_ORIGIN = ''

    const response = await requestCalendarFeed(`${CALENDAR_FEED_TOKEN}.ics`)

    expect((await response.text()).replace(/\r\n /g, '')).toContain(
      'DESCRIPTION:http://localhost:3000/candidatures/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\r\n',
    )
  })

  it.each([
    [
      'the service role client cannot be created',
      () => createServiceRoleSupabaseClientMock.mockImplementation(() => {
        throw new Error('Missing environment variable SUPABASE_SERVICE_ROLE_KEY')
      }),
      'Missing environment variable SUPABASE_SERVICE_ROLE_KEY',
    ],
    [
      'the token owner cannot be looked up',
      () => findCalendarFeedOwnerUserIdMock.mockRejectedValue(new Error('Repository operation findCalendarFeedOwnerUserId failed')),
      'Repository operation findCalendarFeedOwnerUserId failed',
    ],
    [
      'the interviews cannot be loaded',
      () => findInterviewsForCalendarFeedMock.mockRejectedValue(new Error('Repository operation findInterviewsForCalendarFeed failed')),
      'Repository operation findInterviewsForCalendarFeed failed',
    ],
  ])('answers an empty 500 and never logs the token nor its hash when %s', async (_caseName, makeStepFail, expectedErrorMessage) => {
    makeStepFail()

    const response = await requestCalendarFeed(`${CALENDAR_FEED_TOKEN}.ics`)

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
    expect(console.error).toHaveBeenCalledWith('Calendar feed route failed', { errorMessage: expectedErrorMessage })
    const loggedText = JSON.stringify(jest.mocked(console.error).mock.calls)
    expect(loggedText).not.toContain(CALENDAR_FEED_TOKEN)
    expect(loggedText).not.toContain(hashCalendarFeedToken(CALENDAR_FEED_TOKEN))
  })
})
