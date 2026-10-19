import type { Interview } from './interviews'
import { countParisCalendarDaysBetween } from './paris-time'
import { jobApplicationRoute } from './routes'
import { UPCOMING_INTERVIEW_WINDOW_DAYS } from './todo-alerts'

export const JOB_APPLICATION_TABS = ['apercu', 'mission', 'entretiens', 'journal'] as const

export type JobApplicationTab = (typeof JOB_APPLICATION_TABS)[number]

export const JOB_APPLICATION_TAB_LABELS: Record<JobApplicationTab, string> = {
  apercu: 'Aperçu',
  mission: 'Mission',
  entretiens: 'Entretiens',
  journal: 'Journal',
}

export const JOB_APPLICATION_TAB_SEARCH_PARAMETER = 'onglet'

export const isJobApplicationTab = (candidate: unknown): candidate is JobApplicationTab =>
  typeof candidate === 'string' && JOB_APPLICATION_TABS.some((tab) => tab === candidate)

export const resolveJobApplicationTab = (
  requestedTab: string | string[] | undefined,
  interviews: Pick<Interview, 'startsAt'>[],
  now: Date,
): JobApplicationTab => {
  if (isJobApplicationTab(requestedTab)) return requestedTab
  const hasUpcomingInterview = interviews.some(
    ({ startsAt }) =>
      startsAt > now && countParisCalendarDaysBetween(now, startsAt) <= UPCOMING_INTERVIEW_WINDOW_DAYS,
  )
  return hasUpcomingInterview ? 'entretiens' : 'apercu'
}

export const jobApplicationTabRoute = (jobApplicationId: string, tab: JobApplicationTab): string =>
  `${jobApplicationRoute(jobApplicationId)}?${JOB_APPLICATION_TAB_SEARCH_PARAMETER}=${tab}`
