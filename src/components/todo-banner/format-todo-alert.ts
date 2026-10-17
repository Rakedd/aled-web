import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import { JOB_APPLICATION_STATUS_LABELS } from '@/domain/job-application-status'
import { PARIS_TIME_ZONE, countParisCalendarDaysBetween, formatRelativeDaysAgo } from '@/domain/paris-time'
import type { AlertInterview, TodoAlert } from '@/domain/todo-alerts'
import type { InterviewKind } from '@/domain/types'
import type { TodoBannerJobApplicationSummary } from './interfaces'

const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  client: 'Entretien client',
  mock: 'Entretien blanc',
  other: 'Entretien',
}

export const getTodoAlertKey = (alert: TodoAlert): string =>
  `${alert.jobApplicationId}:${alert.kind}:${alert.interviewId ?? ''}`

const formatFollowUpMessage = (
  alert: TodoAlert,
  summary: TodoBannerJobApplicationSummary | undefined,
  now: Date,
): string => {
  const recipientName = summary?.contactName ?? summary?.intermediaryName ?? alert.jobApplicationTitle
  const statusLabel = summary ? JOB_APPLICATION_STATUS_LABELS[summary.status] : ''
  return `Relancer ${recipientName} : ${statusLabel} ${formatRelativeDaysAgo(alert.referenceDate, now)} sans retour`
}

const formatInterviewMessage = (alert: TodoAlert, interviews: AlertInterview[]): string => {
  const interview = interviews.find((candidateInterview) => candidateInterview.id === alert.interviewId)
  const interviewLabel = interview ? INTERVIEW_KIND_LABELS[interview.kind] : INTERVIEW_KIND_LABELS.other
  const formattedStart = formatInTimeZone(alert.referenceDate, PARIS_TIME_ZONE, "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
  return `${interviewLabel} ${formattedStart} : ${alert.jobApplicationTitle}`
}

export const formatTodoAlertMessage = (
  alert: TodoAlert,
  summary: TodoBannerJobApplicationSummary | undefined,
  interviews: AlertInterview[],
  now: Date,
): string => {
  switch (alert.kind) {
    case 'follow_up_due':
      return formatFollowUpMessage(alert, summary, now)
    case 'job_spec_missing':
      return `Pas de fiche métier pour « ${alert.jobApplicationTitle} »`
    case 'end_client_unknown':
      return `Client final inconnu pour « ${alert.jobApplicationTitle} » : demande-le avant l'entretien`
    case 'upcoming_interview':
      return formatInterviewMessage(alert, interviews)
    case 'no_news_suggestion':
      return `Sans nouvelles depuis ${countParisCalendarDaysBetween(alert.referenceDate, now)} j : ${alert.jobApplicationTitle}. La clore ?`
  }
}
