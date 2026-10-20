import type { Metadata } from 'next'
import { InterviewsCalendar } from '@/components/interviews-calendar'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'

export const metadata: Metadata = { title: 'Calendrier · Aled' }

const CalendarPage = () => (
  <div className="flex min-w-0 flex-col gap-6">
    <h1 className={PAGE_TITLE_CLASS_NAME}>Calendrier</h1>
    <InterviewsCalendar listUpcomingInterviews={listUpcomingInterviews} />
  </div>
)

export default CalendarPage
