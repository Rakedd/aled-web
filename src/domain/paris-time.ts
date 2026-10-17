import { addDays, differenceInCalendarDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime, getTimezoneOffset, toZonedTime } from 'date-fns-tz'

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

const PARIS_LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const OFFSET_SAMPLING_DISTANCE_IN_MILLISECONDS = 14 * 60 * 60 * 1000

export const formatParisLocalDateTime = (date: Date): string =>
  formatInTimeZone(date, PARIS_TIME_ZONE, "yyyy-MM-dd'T'HH:mm")

const readWallClockTimeAsUtcMilliseconds = (parisLocalDateTime: string): number | null => {
  const dateTimeParts = PARIS_LOCAL_DATE_TIME_PATTERN.exec(parisLocalDateTime)
  if (dateTimeParts === null) return null
  const [, year, month, day, hours, minutes] = dateTimeParts.map(Number)
  return Date.UTC(year, month - 1, day, hours, minutes)
}

export const parisLocalDateTimeToUtc = (parisLocalDateTime: string): Date => {
  const wallClockTimeAsUtcMilliseconds = readWallClockTimeAsUtcMilliseconds(parisLocalDateTime)
  if (wallClockTimeAsUtcMilliseconds === null) return new Date(Number.NaN)
  const candidateInstants = [-OFFSET_SAMPLING_DISTANCE_IN_MILLISECONDS, OFFSET_SAMPLING_DISTANCE_IN_MILLISECONDS]
    .map((samplingDistance) =>
      getTimezoneOffset(PARIS_TIME_ZONE, new Date(wallClockTimeAsUtcMilliseconds + samplingDistance)),
    )
    .map((parisOffsetInMilliseconds) => new Date(wallClockTimeAsUtcMilliseconds - parisOffsetInMilliseconds))
    .filter((candidateInstant) => formatParisLocalDateTime(candidateInstant) === parisLocalDateTime)
    .sort((firstInstant, secondInstant) => firstInstant.getTime() - secondInstant.getTime())
  return candidateInstants[0] ?? new Date(Number.NaN)
}

export const formatParisInterviewDateTime = (date: Date): string =>
  formatInTimeZone(date, PARIS_TIME_ZONE, "EEE dd/MM '·' HH'h'mm", { locale: fr })
