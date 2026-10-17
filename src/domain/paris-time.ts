import { addDays, differenceInCalendarDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

export const PARIS_TIME_ZONE = 'Europe/Paris'

export const countParisCalendarDaysBetween = (earlier: Date, later: Date): number =>
  differenceInCalendarDays(toZonedTime(later, PARIS_TIME_ZONE), toZonedTime(earlier, PARIS_TIME_ZONE))

export const formatRelativeDaysAgo = (date: Date, now: Date): string => {
  const daysAgo = countParisCalendarDaysBetween(date, now)
  if (daysAgo <= 0) return "aujourd'hui"
  if (daysAgo === 1) return 'hier'
  return `il y a ${daysAgo} j`
}

export const parseParisCalendarDate = (calendarDate: string): Date =>
  fromZonedTime(`${calendarDate}T00:00:00`, PARIS_TIME_ZONE)

export const formatParisCalendarDate = (date: Date): string => formatInTimeZone(date, PARIS_TIME_ZONE, 'yyyy-MM-dd')

export const addParisCalendarDays = (date: Date, days: number): Date =>
  fromZonedTime(addDays(toZonedTime(date, PARIS_TIME_ZONE), days), PARIS_TIME_ZONE)

export const formatParisDateTime = (date: Date): string => formatInTimeZone(date, PARIS_TIME_ZONE, 'dd/MM/yyyy HH:mm')

export const formatParisDate = (date: Date): string => formatInTimeZone(date, PARIS_TIME_ZONE, 'dd/MM/yyyy')

export const parisLocalDateTimeToUtc = (parisLocalDateTime: string): Date =>
  fromZonedTime(`${parisLocalDateTime}:00`, PARIS_TIME_ZONE)

export const formatParisLocalDateTime = (date: Date): string =>
  formatInTimeZone(date, PARIS_TIME_ZONE, "yyyy-MM-dd'T'HH:mm")

export const formatParisInterviewDateTime = (date: Date): string =>
  formatInTimeZone(date, PARIS_TIME_ZONE, "EEE dd/MM '·' HH'h'mm", { locale: fr })
