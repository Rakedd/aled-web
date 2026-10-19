import { isTerminalStatus, type JobApplicationStatus } from './job-application-status'
import { countParisCalendarDaysBetween } from './paris-time'

export type LastActivityAging = 'recent' | 'aging' | 'stale'

const AGING_FROM_DAYS = 7

const STALE_FROM_DAYS = 15

export const getLastActivityAging = (
  jobApplication: { status: JobApplicationStatus; lastActivityAt: Date | null },
  now: Date,
): LastActivityAging | null => {
  if (isTerminalStatus(jobApplication.status) || jobApplication.lastActivityAt === null) return null
  const daysSinceLastActivity = countParisCalendarDaysBetween(jobApplication.lastActivityAt, now)
  if (daysSinceLastActivity >= STALE_FROM_DAYS) return 'stale'
  if (daysSinceLastActivity >= AGING_FROM_DAYS) return 'aging'
  return 'recent'
}
