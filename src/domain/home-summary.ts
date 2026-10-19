import type { Interview } from './interviews'
import { pluralizeFrench } from './french-plural'
import { formatInterviewCountdown, countParisCalendarDaysBetween, formatParisWeekdayName } from './paris-time'
import { UPCOMING_INTERVIEW_WINDOW_DAYS } from './todo-alerts'
import type { InterviewKind } from './types'

export type HomeSummaryInput = {
  reminderCount: number
  nextInterview: Pick<Interview, 'startsAt' | 'kind'> | null
  recentOpportunityCount: number
  now: Date
}

const INTERVIEW_PHRASE_BY_KIND: Record<InterviewKind, string> = {
  client: 'un entretien client',
  mock: 'un entretien blanc',
  other: 'un entretien',
}

const NOTHING_URGENT_SENTENCE = "Rien d'urgent aujourd'hui."

const describeInterviewDay = (startsAt: Date, now: Date, daysUntilInterview: number): string => {
  if (daysUntilInterview <= 1) return formatInterviewCountdown(startsAt, now)
  const weekdayName = formatParisWeekdayName(startsAt)
  return daysUntilInterview >= UPCOMING_INTERVIEW_WINDOW_DAYS ? `${weekdayName} prochain` : weekdayName
}

const buildInterviewPart = (nextInterview: HomeSummaryInput['nextInterview'], now: Date): string | null => {
  if (nextInterview === null || nextInterview.startsAt.getTime() <= now.getTime()) return null
  const daysUntilInterview = countParisCalendarDaysBetween(now, nextInterview.startsAt)
  if (daysUntilInterview > UPCOMING_INTERVIEW_WINDOW_DAYS) return null
  return `${INTERVIEW_PHRASE_BY_KIND[nextInterview.kind]} ${describeInterviewDay(nextInterview.startsAt, now, daysUntilInterview)}`
}

export const buildHomeSummarySentence = ({
  reminderCount,
  nextInterview,
  recentOpportunityCount,
  now,
}: HomeSummaryInput): string => {
  const reminderPart = reminderCount > 0 ? `${reminderCount} ${pluralizeFrench(reminderCount, 'chose', 'choses')} à faire` : null
  const secondPart =
    buildInterviewPart(nextInterview, now) ??
    (recentOpportunityCount > 0
      ? `${recentOpportunityCount} ${pluralizeFrench(recentOpportunityCount, 'mission intéressante', 'missions intéressantes')} de moins de 48 h`
      : null)
  const parts = [reminderPart, secondPart].filter((part): part is string => part !== null)
  if (parts.length === 0) return NOTHING_URGENT_SENTENCE
  const joinedParts = parts.join(' et ')
  return `${joinedParts.charAt(0).toUpperCase()}${joinedParts.slice(1)}.`
}
