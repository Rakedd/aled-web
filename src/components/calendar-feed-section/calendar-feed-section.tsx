'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CALENDAR_FEED_MESSAGES } from '@/domain/calendar-feed'
import { useController } from './controller'
import type { CalendarFeedSectionProps } from './interfaces'

const SECTION_TITLE_ELEMENT_ID = 'settings-calendar-feed-title'
const CALENDAR_FEED_URL_INPUT_ELEMENT_ID = 'calendar-feed-url-input'
const CALENDAR_FEED_WARNING_ELEMENT_ID = 'calendar-feed-secret-warning'

export const CalendarFeedSection = ({
  initialCalendarFeedStatusResult,
  createCalendarFeed,
  disableCalendarFeed,
}: CalendarFeedSectionProps) => {
  const {
    calendarFeedState,
    status,
    isConfirmingDisabling,
    errorMessage,
    announcement,
    revealedCalendarFeedLinks,
    activeSinceLabel,
    calendarFeedUrlInputRef,
    enableButtonRef,
    disableButtonRef,
    cancelDisablingButtonRef,
    createFeed,
    copyCalendarFeedUrl,
    requestFeedDisabling,
    cancelFeedDisabling,
    confirmFeedDisabling,
  } = useController({ initialCalendarFeedStatusResult, createCalendarFeed, disableCalendarFeed })
  const isBusy = status !== 'idle'
  const isFeedActive = calendarFeedState.view === 'active' || calendarFeedState.view === 'justCreated'

  return (
    <section aria-labelledby={SECTION_TITLE_ELEMENT_ID} className="flex flex-col gap-4 rounded-2xl bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id={SECTION_TITLE_ELEMENT_ID} className="text-lg font-semibold">
          {CALENDAR_FEED_MESSAGES.sectionTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{CALENDAR_FEED_MESSAGES.description}</p>
      </div>
      {calendarFeedState.view === 'unavailable' && (
        <p role="alert" className="text-sm text-destructive">
          {calendarFeedState.loadErrorMessage}
        </p>
      )}
      {calendarFeedState.view === 'inactive' && (
        <Button
          ref={enableButtonRef}
          type="button"
          size="lg"
          className="self-start"
          onClick={() => void createFeed()}
          disabled={isBusy}
        >
          {status === 'creating' ? CALENDAR_FEED_MESSAGES.enabling : CALENDAR_FEED_MESSAGES.enable}
        </Button>
      )}
      {revealedCalendarFeedLinks !== null && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={CALENDAR_FEED_URL_INPUT_ELEMENT_ID}>{CALENDAR_FEED_MESSAGES.urlLabel}</Label>
            <Input
              ref={calendarFeedUrlInputRef}
              id={CALENDAR_FEED_URL_INPUT_ELEMENT_ID}
              readOnly
              value={revealedCalendarFeedLinks.calendarFeedUrl}
              onFocus={(focusEvent) => focusEvent.currentTarget.select()}
              aria-describedby={CALENDAR_FEED_WARNING_ELEMENT_ID}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => void copyCalendarFeedUrl()}>
              {CALENDAR_FEED_MESSAGES.copyLink}
            </Button>
            <a
              href={revealedCalendarFeedLinks.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              {CALENDAR_FEED_MESSAGES.addToGoogleCalendar}
            </a>
            <a href={revealedCalendarFeedLinks.appleCalendarUrl} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {CALENDAR_FEED_MESSAGES.addToAppleCalendar}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{CALENDAR_FEED_MESSAGES.refreshDelayNotice}</p>
          <p
            id={CALENDAR_FEED_WARNING_ELEMENT_ID}
            className="rounded-2xl border border-input p-3 text-sm font-medium"
          >
            {CALENDAR_FEED_MESSAGES.secretWarning}
          </p>
        </div>
      )}
      {activeSinceLabel !== null && <p className="text-sm">{activeSinceLabel}</p>}
      {isFeedActive && !isConfirmingDisabling && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{CALENDAR_FEED_MESSAGES.regenerateHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => void createFeed()} disabled={isBusy}>
              {status === 'creating' ? CALENDAR_FEED_MESSAGES.regenerating : CALENDAR_FEED_MESSAGES.regenerate}
            </Button>
            <Button
              ref={disableButtonRef}
              type="button"
              variant="destructive"
              size="lg"
              onClick={requestFeedDisabling}
              disabled={isBusy}
            >
              {CALENDAR_FEED_MESSAGES.disable}
            </Button>
          </div>
        </div>
      )}
      {isConfirmingDisabling && (
        <div className="flex flex-col gap-2 rounded-2xl border border-input p-3">
          <p className="text-sm">{CALENDAR_FEED_MESSAGES.disableConfirmation}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" size="lg" onClick={() => void confirmFeedDisabling()} disabled={isBusy}>
              {status === 'disabling' ? CALENDAR_FEED_MESSAGES.disabling : CALENDAR_FEED_MESSAGES.confirmDisable}
            </Button>
            <Button
              ref={cancelDisablingButtonRef}
              type="button"
              variant="outline"
              size="lg"
              onClick={cancelFeedDisabling}
              disabled={isBusy}
            >
              {CALENDAR_FEED_MESSAGES.cancel}
            </Button>
          </div>
        </div>
      )}
      {errorMessage !== null && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div role="status" className="text-sm text-muted-foreground empty:sr-only">
        {announcement}
      </div>
    </section>
  )
}
