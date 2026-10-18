import { formatInTimeZone } from 'date-fns-tz'
import { countParisCalendarDaysBetween, PARIS_TIME_ZONE } from '@/domain/paris-time'

export const formatOpportunityPublication = (publishedAt: Date, now: Date): string => {
  const time = formatInTimeZone(publishedAt, PARIS_TIME_ZONE, "HH'h'mm")
  if (countParisCalendarDaysBetween(publishedAt, now) <= 0) return `aujourd'hui à ${time}`
  return `${formatInTimeZone(publishedAt, PARIS_TIME_ZONE, 'dd/MM')} à ${time}`
}
