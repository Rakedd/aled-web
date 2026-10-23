import { addDays, subDays } from 'date-fns'
import type { NextRequest } from 'next/server'
import { buildCalendarFeed, type CalendarFeedEvent, type CalendarFeedInterview } from '@/domain/calendar-feed'
import { jobApplicationRoute } from '@/domain/routes'
import { readAppOrigin } from '@/lib/landing/landing-environment'
import { extractCalendarFeedToken, hashCalendarFeedToken } from '@/server/calendar/calendar-feed-token'
import { findCalendarFeedOwnerUserId } from '@/server/repositories/calendar-feeds-repository'
import { findInterviewsForCalendarFeed } from '@/server/repositories/interviews-repository'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'

const SUCCESS_STATUS = 200
const NOT_FOUND_STATUS = 404
const INTERNAL_ERROR_STATUS = 500
const NO_STORE_CACHE_CONTROL = 'private, no-store'
const CALENDAR_FEED_PAST_DAYS = 90
const CALENDAR_FEED_FUTURE_DAYS = 365

const CALENDAR_FEED_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Cache-Control': NO_STORE_CACHE_CONTROL,
  'Content-Disposition': 'inline; filename="aled.ics"',
}

const respondWithEmptyBody = (status: number): Response =>
  new Response(null, { status, headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL } })

const toCalendarFeedEvent = (calendarFeedInterview: CalendarFeedInterview, appOrigin: string): CalendarFeedEvent => ({
  ...calendarFeedInterview,
  jobApplicationUrl: `${appOrigin}${jobApplicationRoute(calendarFeedInterview.jobApplicationId)}`,
})

export const GET = async (
  request: NextRequest,
  routeContext: RouteContext<'/api/calendar/[token]'>,
): Promise<Response> => {
  const { token: tokenPathSegment } = await routeContext.params
  const calendarFeedToken = extractCalendarFeedToken(tokenPathSegment)
  if (calendarFeedToken === null) return respondWithEmptyBody(NOT_FOUND_STATUS)
  try {
    const serviceRoleSupabase = createServiceRoleSupabaseClient()
    const ownerUserId = await findCalendarFeedOwnerUserId(serviceRoleSupabase, hashCalendarFeedToken(calendarFeedToken))
    if (ownerUserId === null) return respondWithEmptyBody(NOT_FOUND_STATUS)
    const generatedAt = new Date()
    const calendarFeedInterviews = await findInterviewsForCalendarFeed(serviceRoleSupabase, ownerUserId, {
      from: subDays(generatedAt, CALENDAR_FEED_PAST_DAYS),
      now: generatedAt,
      to: addDays(generatedAt, CALENDAR_FEED_FUTURE_DAYS),
    })
    const appOrigin = readAppOrigin() || request.nextUrl.origin
    const calendarFeed = buildCalendarFeed(
      calendarFeedInterviews.map((calendarFeedInterview) => toCalendarFeedEvent(calendarFeedInterview, appOrigin)),
      { generatedAt },
    )
    return new Response(calendarFeed, { status: SUCCESS_STATUS, headers: CALENDAR_FEED_HEADERS })
  } catch (routeError) {
    console.error('Calendar feed route failed', {
      errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
    })
    return respondWithEmptyBody(INTERNAL_ERROR_STATUS)
  }
}
