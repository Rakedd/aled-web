import type { Metadata } from 'next'
import { InterviewsCalendar } from '@/components/interviews-calendar'
import { listUpcomingInterviews } from '@/server/actions/interview-actions'

export const metadata: Metadata = { title: 'Calendrier · Freeclutch' }

const CalendarPage = () => (
  <div className="flex min-w-0 flex-col gap-6">
    <h1 className="text-2xl font-semibold">Calendrier</h1>
    <InterviewsCalendar listUpcomingInterviews={listUpcomingInterviews} />
  </div>
)

export default CalendarPage
