'use server'

import 'server-only'
import { headers } from 'next/headers'
import type { ActionResult } from '@/domain/action-result'
import { buildCalendarFeedPathname, CALENDAR_FEED_MESSAGES, type CalendarFeedStatus } from '@/domain/calendar-feed'
import { readAppOrigin } from '@/lib/landing/landing-environment'
import { generateCalendarFeedToken, hashCalendarFeedToken } from '@/server/calendar/calendar-feed-token'
import {
  findCalendarFeedStatus,
  removeCalendarFeed,
  saveCalendarFeedTokenHash,
} from '@/server/repositories/calendar-feeds-repository'
import { NO_ARGUMENTS, runAuthenticatedOperation } from './run-authenticated-operation'

const findPublishedAppOrigin = async (): Promise<string | null> => {
  const appOrigin = readAppOrigin()
  if (appOrigin) return appOrigin
  const requestHeaders = await headers()
  return requestHeaders.get('origin')
}

export const getCalendarFeedStatus = async (): Promise<ActionResult<CalendarFeedStatus>> =>
  runAuthenticatedOperation({
    operationName: 'getCalendarFeedStatus',
    failureMessage: CALENDAR_FEED_MESSAGES.loadFailure,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({ ok: true, data: await findCalendarFeedStatus(supabase, userId) }),
  })

export const createCalendarFeed = async (): Promise<ActionResult<{ url: string }>> =>
  runAuthenticatedOperation({
    operationName: 'createCalendarFeed',
    failureMessage: CALENDAR_FEED_MESSAGES.creationFailure,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => {
      const publishedAppOrigin = await findPublishedAppOrigin()
      if (publishedAppOrigin === null) throw new Error('Calendar feed origin missing')
      const calendarFeedToken = generateCalendarFeedToken()
      await saveCalendarFeedTokenHash(supabase, userId, hashCalendarFeedToken(calendarFeedToken), new Date())
      return { ok: true, data: { url: `${publishedAppOrigin}${buildCalendarFeedPathname(calendarFeedToken)}` } }
    },
  })

export const disableCalendarFeed = async (): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'disableCalendarFeed',
    failureMessage: CALENDAR_FEED_MESSAGES.disableFailure,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => {
      await removeCalendarFeed(supabase, userId)
      return { ok: true, data: null }
    },
  })
