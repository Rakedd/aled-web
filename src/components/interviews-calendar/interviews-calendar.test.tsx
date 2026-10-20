import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef } from 'react'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import { InterviewsCalendar } from './interviews-calendar'

type CalendarStubEvent = { id: string; title: string }

type CalendarStubProps = {
  events: CalendarStubEvent[]
  datesSet: (range: { start: Date; end: Date }) => void
  eventClick: (clickInfo: { event: CalendarStubEvent; el: HTMLElement }) => void
}

const MockFullCalendar = ({ events, datesSet, eventClick }: CalendarStubProps) => {
  const initialDatesSetRef = useRef(datesSet)

  useEffect(() => {
    initialDatesSetRef.current({ start: new Date('2026-09-28T00:00:00Z'), end: new Date('2026-11-09T00:00:00Z') })
  }, [])

  return (
    <ul>
      {events.map((event) => (
        <li key={event.id}>
          <a tabIndex={0} onClick={(clickEvent) => eventClick({ event, el: clickEvent.currentTarget })}>
            {event.title}
          </a>
        </li>
      ))}
    </ul>
  )
}

jest.mock('@fullcalendar/react', () => ({
  __esModule: true,
  default: (props: CalendarStubProps) => MockFullCalendar(props),
}))
jest.mock('@fullcalendar/react/daygrid', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/react/list', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/react/locales/fr', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/react/themes/classic', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/react/timegrid', () => ({ __esModule: true, default: {} }))

const interview: InterviewWithJobApplication = {
  id: 'interview-1',
  jobApplicationId: '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00',
  startsAt: new Date('2026-10-28T13:00:00Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
  jobApplicationTitle: 'Développeur React senior',
  endClientLabel: 'Acme',
  stack: [],
  location: null,
  remotePolicy: null,
  postedDailyRate: null,
  requestedDailyRate: null,
  desiredStart: null,
  duration: null,
  postingRawText: null,
}

const renderCalendar = async () => {
  const listUpcomingInterviews = jest.fn().mockResolvedValue({ ok: true, data: [interview] })
  render(<InterviewsCalendar listUpcomingInterviews={listUpcomingInterviews} />)
  const eventLink = await screen.findByText('Développeur React senior')
  const calendarLayout = eventLink.closest('.interviews-calendar')?.parentElement
  return { eventLink, calendarLayout }
}

describe('InterviewsCalendar', () => {
  it('gives the whole width to the calendar while no interview is open', async () => {
    const { calendarLayout } = await renderCalendar()

    expect(calendarLayout).not.toHaveClass('lg:grid-cols-[1fr_22rem]')
  })

  it('makes room for the revision panel once an interview is open', async () => {
    const { eventLink, calendarLayout } = await renderCalendar()

    await userEvent.click(eventLink)

    expect(screen.getByRole('complementary', { name: 'Développeur React senior' })).toBeInTheDocument()
    expect(calendarLayout).toHaveClass('lg:grid-cols-[1fr_22rem]')
  })

  it('gives focus back to the clicked interview when the panel closes', async () => {
    const { eventLink, calendarLayout } = await renderCalendar()

    await userEvent.click(eventLink)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(calendarLayout).not.toHaveClass('lg:grid-cols-[1fr_22rem]')
    expect(eventLink).toHaveFocus()
  })
})
