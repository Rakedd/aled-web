import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'

export type ListUpcomingInterviews = (from: Date, to: Date) => Promise<ActionResult<InterviewWithJobApplication[]>>

export type InterviewsCalendarProps = {
  listUpcomingInterviews: ListUpcomingInterviews
}

export type InterviewsCalendarView = 'dayGridMonth' | 'timeGridWeek' | 'listWeek'

export type InterviewCalendarEvent = {
  id: string
  title: string
  start: string
  className: string
  color: string
  contrastColor: string
}
