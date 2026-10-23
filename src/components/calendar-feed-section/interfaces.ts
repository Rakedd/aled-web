import type { ActionResult } from '@/domain/action-result'
import type { CalendarFeedStatus } from '@/domain/calendar-feed'

export type CreateCalendarFeed = () => Promise<ActionResult<{ url: string }>>
export type DisableCalendarFeed = () => Promise<ActionResult<null>>

export type CalendarFeedSectionStatus = 'idle' | 'creating' | 'disabling'

export type CalendarFeedSectionState =
  | { view: 'unavailable'; loadErrorMessage: string }
  | { view: 'inactive' }
  | { view: 'active'; createdAt: Date }
  | { view: 'justCreated'; calendarFeedUrl: string }

export type CalendarFeedSectionControllerParameters = {
  initialCalendarFeedStatusResult: ActionResult<CalendarFeedStatus>
  createCalendarFeed: CreateCalendarFeed
  disableCalendarFeed: DisableCalendarFeed
}

export type CalendarFeedSectionProps = CalendarFeedSectionControllerParameters

export type RevealedCalendarFeedLinks = {
  calendarFeedUrl: string
  appleCalendarUrl: string
  googleCalendarUrl: string
}

export type CalendarFeedFocusTarget = 'calendarFeedUrl' | 'enableButton' | 'disableButton' | 'cancelDisablingButton'
