import { findCvLastChangeDate, isCvDueForReview, type CvReviewDates } from './cv-library'
import { isActiveStatus, type JobApplicationStatus } from './job-application-status'
import { countParisCalendarDaysBetween } from './paris-time'
import type { AlertKind, InterviewKind } from './types'

export const NO_NEWS_SUGGESTION_DAYS = 21

export const UPCOMING_INTERVIEW_WINDOW_DAYS = 7

export type AlertJobApplication = {
  id: string
  title: string
  status: JobApplicationStatus
  appliedOn: Date
  lastActivityAt: Date | null
  hasJobSpec: boolean
  hasEndClient: boolean
}

export type AlertInterview = {
  id: string
  jobApplicationId: string
  startsAt: Date
  kind: InterviewKind
}

export type AlertSnooze = {
  jobApplicationId: string
  alertKind: AlertKind
  snoozedUntil: Date
}

export type AlertCv = CvReviewDates & {
  id: string
  label: string
}

export type TodoAlertInput = {
  jobApplications: AlertJobApplication[]
  interviews: AlertInterview[]
  snoozes: AlertSnooze[]
  cvs: AlertCv[]
  now: Date
  followUpDelayDays: number
}

export type CvOutdatedAlertKind = 'cv_outdated'

export type TodoAlertKind = AlertKind | CvOutdatedAlertKind

export type JobApplicationTodoAlert = {
  kind: AlertKind
  jobApplicationId: string
  jobApplicationTitle: string
  referenceDate: Date
  interviewId?: string
}

export type CvOutdatedTodoAlert = {
  kind: CvOutdatedAlertKind
  cvId: string
  cvLabel: string
  referenceDate: Date
}

export type TodoAlert = JobApplicationTodoAlert | CvOutdatedTodoAlert

export const isJobApplicationTodoAlert = (alert: TodoAlert): alert is JobApplicationTodoAlert =>
  alert.kind !== 'cv_outdated'

const ALERT_KIND_DISPLAY_ORDER: readonly TodoAlertKind[] = [
  'upcoming_interview',
  'follow_up_due',
  'job_spec_missing',
  'end_client_unknown',
  'no_news_suggestion',
  'cv_outdated',
]

export const TODO_SUMMARY_KIND_ORDER: readonly TodoAlertKind[] = [
  'follow_up_due',
  'no_news_suggestion',
  'job_spec_missing',
  'end_client_unknown',
  'upcoming_interview',
  'cv_outdated',
]

export type TodoAlertKindCount = {
  kind: TodoAlertKind
  count: number
}

export const countTodoAlertsByKind = (alerts: TodoAlert[]): TodoAlertKindCount[] =>
  TODO_SUMMARY_KIND_ORDER.map((kind) => ({
    kind,
    count: alerts.filter((alert) => alert.kind === kind).length,
  })).filter(({ count }) => count > 0)

const FOLLOW_UP_STATUSES: readonly JobApplicationStatus[] = ['intermediary_contact', 'cv_submitted']

const JOB_SPEC_EXPECTED_STATUSES: readonly JobApplicationStatus[] = [
  'cv_submitted',
  'interview_scheduled',
  'interview_done',
  'contract_received',
]

const getReferenceDate = (jobApplication: AlertJobApplication): Date =>
  jobApplication.lastActivityAt ?? jobApplication.appliedOn

const computeJobApplicationAlertKinds = (
  jobApplication: AlertJobApplication,
  now: Date,
  followUpDelayDays: number,
): AlertKind[] => {
  const daysSinceReferenceDate = countParisCalendarDaysBetween(getReferenceDate(jobApplication), now)
  const isNoNewsSuggested = daysSinceReferenceDate >= NO_NEWS_SUGGESTION_DAYS
  const isFollowUpDue =
    !isNoNewsSuggested &&
    FOLLOW_UP_STATUSES.includes(jobApplication.status) &&
    daysSinceReferenceDate >= followUpDelayDays
  const isJobSpecMissing = JOB_SPEC_EXPECTED_STATUSES.includes(jobApplication.status) && !jobApplication.hasJobSpec
  const isEndClientUnknown = jobApplication.status === 'interview_scheduled' && !jobApplication.hasEndClient

  const alertKindsWithConditions: [AlertKind, boolean][] = [
    ['follow_up_due', isFollowUpDue],
    ['job_spec_missing', isJobSpecMissing],
    ['end_client_unknown', isEndClientUnknown],
    ['no_news_suggestion', isNoNewsSuggested],
  ]
  return alertKindsWithConditions.filter(([, isRaised]) => isRaised).map(([alertKind]) => alertKind)
}

const isSnoozed = (alert: JobApplicationTodoAlert, snoozes: AlertSnooze[], now: Date): boolean =>
  snoozes.some(
    (snooze) =>
      snooze.jobApplicationId === alert.jobApplicationId &&
      snooze.alertKind === alert.kind &&
      snooze.snoozedUntil > now,
  )

const compareTodoAlerts = (firstAlert: TodoAlert, secondAlert: TodoAlert): number =>
  ALERT_KIND_DISPLAY_ORDER.indexOf(firstAlert.kind) - ALERT_KIND_DISPLAY_ORDER.indexOf(secondAlert.kind) ||
  firstAlert.referenceDate.getTime() - secondAlert.referenceDate.getTime()

export const computeTodoAlerts = ({
  jobApplications,
  interviews,
  snoozes,
  cvs,
  now,
  followUpDelayDays,
}: TodoAlertInput): TodoAlert[] => {
  const activeJobApplications = jobApplications.filter((jobApplication) => isActiveStatus(jobApplication.status))
  const activeJobApplicationsById = new Map(
    activeJobApplications.map((jobApplication) => [jobApplication.id, jobApplication]),
  )
  const upcomingInterviewAlerts = interviews.flatMap((interview): JobApplicationTodoAlert[] => {
    const jobApplication = activeJobApplicationsById.get(interview.jobApplicationId)
    const isWithinWindow =
      interview.startsAt >= now &&
      countParisCalendarDaysBetween(now, interview.startsAt) <= UPCOMING_INTERVIEW_WINDOW_DAYS
    if (!jobApplication || !isWithinWindow) return []
    return [
      {
        kind: 'upcoming_interview',
        jobApplicationId: jobApplication.id,
        jobApplicationTitle: jobApplication.title,
        referenceDate: interview.startsAt,
        interviewId: interview.id,
      },
    ]
  })

  const snoozableAlerts = activeJobApplications
    .flatMap((jobApplication) =>
      computeJobApplicationAlertKinds(jobApplication, now, followUpDelayDays).map(
        (alertKind): JobApplicationTodoAlert => ({
          kind: alertKind,
          jobApplicationId: jobApplication.id,
          jobApplicationTitle: jobApplication.title,
          referenceDate: getReferenceDate(jobApplication),
        }),
      ),
    )
    .filter((alert) => !isSnoozed(alert, snoozes, now))

  const cvOutdatedAlerts: CvOutdatedTodoAlert[] =
    activeJobApplications.length === 0
      ? []
      : cvs
          .filter((cv) => isCvDueForReview(cv, now))
          .map((cv) => ({ kind: 'cv_outdated', cvId: cv.id, cvLabel: cv.label, referenceDate: findCvLastChangeDate(cv) }))

  return [...upcomingInterviewAlerts, ...snoozableAlerts, ...cvOutdatedAlerts].sort(compareTodoAlerts)
}
