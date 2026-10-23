/** @jest-environment node */
import { headers } from 'next/headers'
import { CALENDAR_FEED_MESSAGES } from '@/domain/calendar-feed'
import { hashCalendarFeedToken } from '@/server/calendar/calendar-feed-token'
import {
  findCalendarFeedStatus,
  removeCalendarFeed,
  saveCalendarFeedTokenHash,
} from '@/server/repositories/calendar-feeds-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createCalendarFeed, disableCalendarFeed, getCalendarFeedStatus } from './calendar-feed-actions'

jest.mock('server-only', () => ({}))
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/calendar-feeds-repository', () => ({
  findCalendarFeedStatus: jest.fn(),
  saveCalendarFeedTokenHash: jest.fn(),
  removeCalendarFeed: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const CALENDAR_FEED_URL_PATTERN = /^https:\/\/app\.aled\.work\/api\/calendar\/([A-Za-z0-9_-]{43})\.ics$/
const originalAppOrigin = process.env.APP_ORIGIN

const mockRequestOrigin = (requestOrigin: string | null) => {
  jest
    .mocked(headers)
    .mockResolvedValue(
      new Headers(requestOrigin === null ? {} : { origin: requestOrigin }) as unknown as Awaited<ReturnType<typeof headers>>,
    )
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.APP_ORIGIN = 'https://app.aled.work/'
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterAll(() => {
  process.env.APP_ORIGIN = originalAppOrigin
})

describe('getCalendarFeedStatus', () => {
  it('returns the feed status of the authenticated user', async () => {
    const createdAt = new Date('2026-10-20T08:00:00.000Z')
    jest.mocked(findCalendarFeedStatus).mockResolvedValue({ isActive: true, createdAt })

    await expect(getCalendarFeedStatus()).resolves.toEqual({ ok: true, data: { isActive: true, createdAt } })
    expect(findCalendarFeedStatus).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('reports the load failure message when the status cannot be read', async () => {
    jest.mocked(findCalendarFeedStatus).mockRejectedValue(new Error('database down'))

    await expect(getCalendarFeedStatus()).resolves.toEqual({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.loadFailure })
  })
})

describe('createCalendarFeed', () => {
  it('stores only the hash of a new token and returns the published url on the app origin', async () => {
    const createCalendarFeedResult = await createCalendarFeed()

    if (!createCalendarFeedResult.ok) throw new Error(createCalendarFeedResult.errorMessage)
    const [, calendarFeedToken] = createCalendarFeedResult.data.url.match(CALENDAR_FEED_URL_PATTERN) ?? []
    expect(calendarFeedToken).toBeDefined()
    expect(saveCalendarFeedTokenHash).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      hashCalendarFeedToken(calendarFeedToken),
      expect.any(Date),
    )
    expect(jest.mocked(saveCalendarFeedTokenHash).mock.calls[0]).not.toContain(calendarFeedToken)
  })

  it('falls back to the request origin when the app origin is not configured', async () => {
    process.env.APP_ORIGIN = ''
    mockRequestOrigin('http://localhost:3000')

    const createCalendarFeedResult = await createCalendarFeed()

    if (!createCalendarFeedResult.ok) throw new Error(createCalendarFeedResult.errorMessage)
    expect(createCalendarFeedResult.data.url).toMatch(/^http:\/\/localhost:3000\/api\/calendar\/[A-Za-z0-9_-]{43}\.ics$/)
  })

  it('refuses to create a feed it could not publish when no origin is known', async () => {
    process.env.APP_ORIGIN = ''
    mockRequestOrigin(null)

    await expect(createCalendarFeed()).resolves.toEqual({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.creationFailure })
    expect(saveCalendarFeedTokenHash).not.toHaveBeenCalled()
  })

  it('reports the creation failure message when the token cannot be stored', async () => {
    jest.mocked(saveCalendarFeedTokenHash).mockRejectedValue(new Error('database down'))

    await expect(createCalendarFeed()).resolves.toEqual({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.creationFailure })
  })
})

describe('disableCalendarFeed', () => {
  it('removes the feed of the authenticated user', async () => {
    await expect(disableCalendarFeed()).resolves.toEqual({ ok: true, data: null })
    expect(removeCalendarFeed).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('reports the disable failure message when the feed cannot be removed', async () => {
    jest.mocked(removeCalendarFeed).mockRejectedValue(new Error('database down'))

    await expect(disableCalendarFeed()).resolves.toEqual({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.disableFailure })
  })
})
