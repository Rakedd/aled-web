'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import listPlugin from '@fullcalendar/react/list'
import frenchLocale from '@fullcalendar/react/locales/fr'
import themePlugin from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { InterviewRevisionPanel } from '@/components/interview-revision-panel'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { useController } from './controller'
import type { InterviewsCalendarProps } from './interfaces'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'

const CALENDAR_PLUGINS = [themePlugin, dayGridPlugin, timeGridPlugin, listPlugin]

export const InterviewsCalendar = ({ listUpcomingInterviews }: InterviewsCalendarProps) => {
  const { calendarEvents, revisionPanelContent, errorMessage, initialView, onDatesSet, selectInterview, closePanel } =
    useController({ listUpcomingInterviews })

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {errorMessage !== null && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <ul aria-label="Légende" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-[#1d4ed8]" />
          Entretien client
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-[#7e22ce]" />
          Entretien blanc
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-[#475569]" />
          Autre
        </li>
      </ul>
      {initialView !== null && (
        <FullCalendar
          plugins={CALENDAR_PLUGINS}
          initialView={initialView}
          locale={frenchLocale}
          timeZone={PARIS_TIME_ZONE}
          headerToolbar={{ start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,listWeek' }}
          buttons={{ listWeek: { text: 'Liste' } }}
          events={calendarEvents}
          datesSet={({ start, end }) => {
            void onDatesSet(start, end)
          }}
          eventClick={({ event }) => selectInterview(event.id)}
        />
      )}
      <InterviewRevisionPanel content={revisionPanelContent} onClose={closePanel} />
    </div>
  )
}
