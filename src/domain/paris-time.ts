import { differenceInCalendarDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export const PARIS_TIME_ZONE = 'Europe/Paris'

export const countParisCalendarDaysBetween = (earlier: Date, later: Date): number =>
  differenceInCalendarDays(toZonedTime(later, PARIS_TIME_ZONE), toZonedTime(earlier, PARIS_TIME_ZONE))

export const formatRelativeDaysAgo = (date: Date, now: Date): string => {
  const daysAgo = countParisCalendarDaysBetween(date, now)
  if (daysAgo <= 0) return "aujourd'hui"
  if (daysAgo === 1) return 'hier'
  return `il y a ${daysAgo} j`
}
