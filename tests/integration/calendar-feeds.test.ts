import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/calendar/[token]/route'
import { createCalendarFeed, disableCalendarFeed, getCalendarFeedStatus } from '@/server/actions/calendar-feed-actions'
import { saveNewInterview } from '@/server/repositories/interviews-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createAnonymousTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const APP_ORIGIN = 'https://app.aled.work'
const INSUFFICIENT_PRIVILEGE_CODE = '42501'
const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000
const CALENDAR_FEED_MAXIMUM_INTERVIEWS = 500
const originalAppOrigin = process.env.APP_ORIGIN

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`calendar-feeds-${randomUUID()}@test.local`)

const actAs = (user: TestUser) => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const createCalendarFeedUrlAs = async (user: TestUser): Promise<string> => {
  actAs(user)
  const creationResult = await createCalendarFeed()
  if (!creationResult.ok) throw new Error(creationResult.errorMessage)
  return creationResult.data.url
}

const requestCalendarFeedUrl = (calendarFeedUrl: string) => {
  const pathSegment = calendarFeedUrl.split('/').at(-1) ?? ''
  return GET(new NextRequest(calendarFeedUrl), { params: Promise.resolve({ token: pathSegment }) })
}

const createInterviewOrFail = async (
  user: TestUser,
  jobApplicationTitle: string,
  participants: string,
): Promise<string> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
    title: jobApplicationTitle,
    endClientName: 'BNP Paribas',
    intermediaryName: 'Hays',
  })
  const savingResult = await saveNewInterview(user.client, user.userId, jobApplicationId, {
    startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    kind: 'client',
    format: 'video',
    participants,
    notes: 'Note privée à ne jamais exporter',
  })
  if (!savingResult.ok) throw new Error(savingResult.errorMessage)
  return savingResult.data.id
}

beforeAll(() => {
  process.env.APP_ORIGIN = APP_ORIGIN
})

afterAll(() => {
  process.env.APP_ORIGIN = originalAppOrigin
})

describe('calendar feeds', () => {
  it('lets a user read and write only their own calendar feed', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const ownerCalendarFeedUrl = await createCalendarFeedUrlAs(owner)

    const { data: feedsReadByIntruder } = await intruder.client
      .from('calendar_feeds')
      .select('user_id')
      .eq('user_id', owner.userId)
    const { error: impersonationError } = await intruder.client
      .from('calendar_feeds')
      .insert({ user_id: owner.userId, token_hash: randomUUID() })
    const { data: updatedByIntruder } = await intruder.client
      .from('calendar_feeds')
      .update({ token_hash: 'hash-of-a-token-known-by-the-intruder' })
      .eq('user_id', owner.userId)
      .select('user_id')
    const { data: deletedByIntruder } = await intruder.client
      .from('calendar_feeds')
      .delete()
      .eq('user_id', owner.userId)
      .select('user_id')

    expect(feedsReadByIntruder).toEqual([])
    expect(impersonationError?.code).toBe(INSUFFICIENT_PRIVILEGE_CODE)
    expect(updatedByIntruder).toEqual([])
    expect(deletedByIntruder).toEqual([])
    expect((await requestCalendarFeedUrl(ownerCalendarFeedUrl)).status).toBe(200)
    actAs(owner)
    await expect(getCalendarFeedStatus()).resolves.toMatchObject({ ok: true, data: { isActive: true } })
  })

  it('serves only the interviews of the token owner, without their private notes', async () => {
    const owner = await createTestUser()
    const otherUser = await createTestUser()
    const ownerInterviewId = await createInterviewOrFail(owner, 'Mission du propriétaire', 'Marie Dupont')
    const otherInterviewId = await createInterviewOrFail(otherUser, 'Mission de quelqu’un d’autre', 'Paul Martin')
    const calendarFeedUrl = await createCalendarFeedUrlAs(owner)
    await createCalendarFeedUrlAs(otherUser)

    const response = await requestCalendarFeedUrl(calendarFeedUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    const unfoldedCalendarFeed = (await response.text()).replace(/\r\n /g, '')
    expect(unfoldedCalendarFeed).toContain(`UID:${ownerInterviewId}@aled.work`)
    expect(unfoldedCalendarFeed).toContain('SUMMARY:Entretien client · Mission du propriétaire · BNP Paribas')
    expect(unfoldedCalendarFeed).toContain('Interlocuteurs : Marie Dupont\\nIntermédiaire : Hays')
    expect(unfoldedCalendarFeed).not.toContain(otherInterviewId)
    expect(unfoldedCalendarFeed).not.toContain('Paul Martin')
    expect(unfoldedCalendarFeed).not.toContain('Note privée')
  })

  it('refuses any access to the calendar feeds without a session', async () => {
    const { error: anonymousReadError } = await createAnonymousTestClient().from('calendar_feeds').select('user_id')

    expect(anonymousReadError?.code).toBe(INSUFFICIENT_PRIVILEGE_CODE)
  })

  it('lists past and upcoming interviews chronologically, and keeps the upcoming ones when the cap is reached', async () => {
    const owner = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId, { title: 'Mission chargée' })
    const buildInterviewRow = (startsAt: Date) => ({
      user_id: owner.userId,
      job_application_id: jobApplicationId,
      starts_at: startsAt.toISOString(),
      kind: 'client' as const,
      format: 'video' as const,
    })
    const pastInterviewStartsAt = new Date(Date.now() - 10 * ONE_DAY_MILLISECONDS)
    const { data: pastInterviewRows, error: pastInsertionError } = await owner.client
      .from('interviews')
      .insert(buildInterviewRow(pastInterviewStartsAt))
      .select('id')
    if (pastInsertionError) throw pastInsertionError
    const { error: upcomingInsertionError } = await owner.client
      .from('interviews')
      .insert(
        Array.from({ length: CALENDAR_FEED_MAXIMUM_INTERVIEWS }, (_unused, interviewIndex) =>
          buildInterviewRow(new Date(Date.now() + (interviewIndex + 1) * 60 * 60 * 1000)),
        ),
      )
    if (upcomingInsertionError) throw upcomingInsertionError
    const calendarFeedUrl = await createCalendarFeedUrlAs(owner)

    const calendarFeed = await (await requestCalendarFeedUrl(calendarFeedUrl)).text()

    expect(calendarFeed.match(/\r\nBEGIN:VEVENT\r\n/g)).toHaveLength(CALENDAR_FEED_MAXIMUM_INTERVIEWS)
    expect(calendarFeed).not.toContain(pastInterviewRows[0].id)
  })

  it('places a past interview before an upcoming one', async () => {
    const owner = await createTestUser()
    const upcomingInterviewId = await createInterviewOrFail(owner, 'Mission à venir', 'Marie Dupont')
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId, { title: 'Mission passée' })
    const pastSavingResult = await saveNewInterview(owner.client, owner.userId, jobApplicationId, {
      startsAt: new Date(Date.now() - 10 * ONE_DAY_MILLISECONDS),
      kind: 'mock',
      format: 'phone',
      participants: null,
      notes: null,
    })
    if (!pastSavingResult.ok) throw new Error(pastSavingResult.errorMessage)
    const calendarFeedUrl = await createCalendarFeedUrlAs(owner)

    const calendarFeed = await (await requestCalendarFeedUrl(calendarFeedUrl)).text()

    const pastInterviewPosition = calendarFeed.indexOf(pastSavingResult.data.id)
    expect(pastInterviewPosition).toBeGreaterThan(-1)
    expect(pastInterviewPosition).toBeLessThan(calendarFeed.indexOf(upcomingInterviewId))
  })

  it('cuts the previous link when a new one is generated, and every link once the feed is disabled', async () => {
    const owner = await createTestUser()
    const firstCalendarFeedUrl = await createCalendarFeedUrlAs(owner)
    const secondCalendarFeedUrl = await createCalendarFeedUrlAs(owner)

    expect(secondCalendarFeedUrl).not.toBe(firstCalendarFeedUrl)
    expect((await requestCalendarFeedUrl(firstCalendarFeedUrl)).status).toBe(404)
    expect((await requestCalendarFeedUrl(secondCalendarFeedUrl)).status).toBe(200)

    actAs(owner)
    await expect(disableCalendarFeed()).resolves.toEqual({ ok: true, data: null })
    await expect(getCalendarFeedStatus()).resolves.toEqual({ ok: true, data: { isActive: false, createdAt: null } })
    expect((await requestCalendarFeedUrl(secondCalendarFeedUrl)).status).toBe(404)
  })
})
