import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import { formatCvOutdatedMessage } from '@/domain/cv-library'
import { JOB_APPLICATION_STATUS_LABELS } from '@/domain/job-application-status'
import { pluralizeFrench } from '@/domain/french-plural'
import { PARIS_TIME_ZONE, countParisCalendarDaysBetween } from '@/domain/paris-time'
import { isJobApplicationTodoAlert, type AlertInterview, type JobApplicationTodoAlert, type TodoAlert, type TodoAlertKind } from '@/domain/todo-alerts'
import type { PillTone } from '@/components/pill/interfaces'
import type { InterviewKind } from '@/domain/types'
import type { TodoBannerJobApplicationSummary } from './interfaces'

const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  client: 'Entretien client',
  mock: 'Entretien blanc',
  other: 'Entretien',
}

export const TODO_ALERT_KIND_TAG_LABELS: Record<TodoAlertKind, string> = {
  follow_up_due: 'Relance',
  job_spec_missing: 'Fiche métier',
  end_client_unknown: 'Client inconnu',
  no_news_suggestion: 'Sans nouvelles',
  upcoming_interview: 'Entretien à venir',
  cv_outdated: 'CV à revoir',
}

export const TODO_ALERT_KIND_TONES: Record<TodoAlertKind, PillTone> = {
  follow_up_due: 'peach',
  job_spec_missing: 'lilac',
  end_client_unknown: 'lilac',
  no_news_suggestion: 'clay',
  upcoming_interview: 'sage',
  cv_outdated: 'peach-soft',
}

export const TODO_ALERT_CARD_TAG_TONES: Record<TodoAlertKind, PillTone> = {
  ...TODO_ALERT_KIND_TONES,
  upcoming_interview: 'forest',
}

export const formatTodoAlertKindCount = (kind: TodoAlertKind, count: number): string => {
  switch (kind) {
    case 'follow_up_due':
      return `${count} ${pluralizeFrench(count, 'relance', 'relances')}`
    case 'no_news_suggestion':
      return `${count} sans nouvelles`
    case 'job_spec_missing':
      return `${count} ${pluralizeFrench(count, 'fiche métier', 'fiches métier')}`
    case 'end_client_unknown':
      return `${count} ${pluralizeFrench(count, 'client inconnu', 'clients inconnus')}`
    case 'upcoming_interview':
      return `${count} ${pluralizeFrench(count, 'entretien à venir', 'entretiens à venir')}`
    case 'cv_outdated':
      return `${count} CV à revoir`
  }
}

export const getTodoAlertKey = (alert: TodoAlert): string =>
  isJobApplicationTodoAlert(alert)
    ? `${alert.jobApplicationId}:${alert.kind}:${alert.interviewId ?? ''}`
    : `cv:${alert.cvId}:${alert.kind}`

const formatFollowUpMessage = (
  alert: JobApplicationTodoAlert,
  summary: TodoBannerJobApplicationSummary | undefined,
  now: Date,
): string => {
  const recipientName = summary?.contactName ?? summary?.intermediaryName ?? alert.jobApplicationTitle
  const messageParts = [
    summary ? JOB_APPLICATION_STATUS_LABELS[summary.status] : null,
    `il y a ${countParisCalendarDaysBetween(alert.referenceDate, now)} j`,
    'sans retour',
  ].filter((messagePart) => messagePart !== null)
  return `Relancer ${recipientName} : ${messageParts.join(' ')}`
}

const formatInterviewMessage = (alert: JobApplicationTodoAlert, interviews: AlertInterview[]): string => {
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
    case 'cv_outdated':
      return formatCvOutdatedMessage(alert.cvLabel, alert.referenceDate, now)
  }
}
