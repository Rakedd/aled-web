'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import listPlugin from '@fullcalendar/react/list'
import frenchLocale from '@fullcalendar/react/locales/fr'
import themePlugin from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { InterviewRevisionPanel } from '@/components/interview-revision-panel'
import { Pill } from '@/components/pill'
import { INTERVIEW_KIND_LABELS, INTERVIEW_KINDS } from '@/domain/interviews'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { cn } from '@/lib/utils'
import { INTERVIEW_KIND_TONES, useController } from './controller'
import type { InterviewsCalendarProps } from './interfaces'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import './interviews-calendar.css'

const CALENDAR_PLUGINS = [themePlugin, dayGridPlugin, timeGridPlugin, listPlugin]

export const InterviewsCalendar = ({ listUpcomingInterviews }: InterviewsCalendarProps) => {
  const {
    calendarContainerRef,
    calendarEvents,
    revisionPanelContent,
    errorMessage,
    initialView,
    onDatesSet,
    selectInterview,
    closePanel,
  } = useController({ listUpcomingInterviews })

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {errorMessage !== null && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <ul aria-label="Légende" className="flex flex-wrap gap-2">
        {INTERVIEW_KINDS.map((interviewKind) => (
          <li key={interviewKind}>
            <Pill tone={INTERVIEW_KIND_TONES[interviewKind]} className="select-none">{INTERVIEW_KIND_LABELS[interviewKind]}</Pill>
          </li>
        ))}
      </ul>
      <div className={cn('grid min-w-0 gap-4 lg:items-start', revisionPanelContent !== null && 'lg:grid-cols-[1fr_22rem]')}>
        <div ref={calendarContainerRef} tabIndex={-1} className="interviews-calendar min-w-0 rounded-2xl bg-card p-4 outline-none">
          {initialView !== null && (
            <FullCalendar
              plugins={CALENDAR_PLUGINS}
              initialView={initialView}
              locale={frenchLocale}
              timeZone={PARIS_TIME_ZONE}
              headerToolbar={{ start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,listWeek' }}
              buttons={{ listWeek: { text: 'Liste' } }}
              buttonClass={({ isSelected }) =>
                isSelected ? 'fc-atelier-button fc-atelier-button-active' : 'fc-atelier-button'
              }
              buttonGroupClass="fc-atelier-button-group"
              toolbarSectionClass="fc-atelier-toolbar-section"
              dayCellClass="fc-atelier-day-cell"
              dayCellTopInnerClass={({ isToday }) => (isToday ? 'fc-atelier-today' : '')}
              eventClass="fc-atelier-event"
              blockEventInnerClass="fc-atelier-block-event-inner"
              blockEventTimeClass="fc-atelier-block-event-time"
              blockEventTitleClass="fc-atelier-block-event-title"
              listItemEventClass="fc-atelier-event"
              events={calendarEvents}
              datesSet={({ start, end }) => {
                void onDatesSet(start, end)
              }}
              eventClick={({ event, el }) => selectInterview(event.id, el)}
            />
          )}
        </div>
        <InterviewRevisionPanel content={revisionPanelContent} onClose={closePanel} />
      </div>
    </div>
  )
}
