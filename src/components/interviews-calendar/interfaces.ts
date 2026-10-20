import type { PillTone } from '@/components/pill/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { InterviewWithJobApplication } from '@/domain/interviews'

export type ListUpcomingInterviews = (from: Date, to: Date) => Promise<ActionResult<InterviewWithJobApplication[]>>

export type InterviewsCalendarProps = {
  listUpcomingInterviews: ListUpcomingInterviews
}

export type InterviewsCalendarView = 'dayGridMonth' | 'timeGridWeek' | 'listWeek'

export type InterviewKindTone = Extract<PillTone, 'peach' | 'lilac' | 'sage'>

export type InterviewCalendarEventStyle = {
  className: string
  color: string
  contrastColor: string
}

export type InterviewCalendarEvent = InterviewCalendarEventStyle & {
  id: string
  title: string
  start: string
}
