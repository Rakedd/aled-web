import { useEffect, useRef, useState } from 'react'
import { type ActionResult, GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  buildGoogleCalendarSubscriptionUrl,
  CALENDAR_FEED_MESSAGES,
  type CalendarFeedStatus,
  formatCalendarFeedActiveSince,
  toWebcalUrl,
} from '@/domain/calendar-feed'
import type {
  CalendarFeedFocusTarget,
  CalendarFeedSectionControllerParameters,
  CalendarFeedSectionState,
  CalendarFeedSectionStatus,
  RevealedCalendarFeedLinks,
} from './interfaces'

const toInitialCalendarFeedState = (
  calendarFeedStatusResult: ActionResult<CalendarFeedStatus>,
): CalendarFeedSectionState => {
  if (!calendarFeedStatusResult.ok) {
    return { view: 'unavailable', loadErrorMessage: calendarFeedStatusResult.errorMessage }
  }
  return calendarFeedStatusResult.data.isActive
    ? { view: 'active', createdAt: calendarFeedStatusResult.data.createdAt }
    : { view: 'inactive' }
}

const toRevealedCalendarFeedLinks = (calendarFeedState: CalendarFeedSectionState): RevealedCalendarFeedLinks | null =>
  calendarFeedState.view === 'justCreated'
    ? {
        calendarFeedUrl: calendarFeedState.calendarFeedUrl,
        appleCalendarUrl: toWebcalUrl(calendarFeedState.calendarFeedUrl),
        googleCalendarUrl: buildGoogleCalendarSubscriptionUrl(calendarFeedState.calendarFeedUrl),
      }
    : null

export const useController = ({
  initialCalendarFeedStatusResult,
  createCalendarFeed,
  disableCalendarFeed,
}: CalendarFeedSectionControllerParameters) => {
  const [calendarFeedState, setCalendarFeedState] = useState<CalendarFeedSectionState>(() =>
    toInitialCalendarFeedState(initialCalendarFeedStatusResult),
  )
  const [status, setStatus] = useState<CalendarFeedSectionStatus>('idle')
  const [isConfirmingDisabling, setIsConfirmingDisabling] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const calendarFeedUrlInputRef = useRef<HTMLInputElement>(null)
  const enableButtonRef = useRef<HTMLButtonElement>(null)
  const disableButtonRef = useRef<HTMLButtonElement>(null)
  const cancelDisablingButtonRef = useRef<HTMLButtonElement>(null)
  const pendingFocusTargetRef = useRef<CalendarFeedFocusTarget | null>(null)

  useEffect(() => {
    const pendingFocusTarget = pendingFocusTargetRef.current
    if (pendingFocusTarget === null) return
    pendingFocusTargetRef.current = null
    const focusTargetElementRefs = {
      calendarFeedUrl: calendarFeedUrlInputRef,
      enableButton: enableButtonRef,
      disableButton: disableButtonRef,
      cancelDisablingButton: cancelDisablingButtonRef,
    }
    focusTargetElementRefs[pendingFocusTarget].current?.focus()
  }, [calendarFeedState, isConfirmingDisabling])

  const revealedCalendarFeedLinks = toRevealedCalendarFeedLinks(calendarFeedState)
  const activeSinceLabel =
    calendarFeedState.view === 'active' ? formatCalendarFeedActiveSince(calendarFeedState.createdAt) : null

  const clearMessages = () => {
    setErrorMessage(null)
    setAnnouncement(null)
  }

  const createFeed = async () => {
    clearMessages()
    const successAnnouncement =
      calendarFeedState.view === 'inactive' ? CALENDAR_FEED_MESSAGES.enabled : CALENDAR_FEED_MESSAGES.regenerated
    setStatus('creating')
    try {
      const creationResult = await createCalendarFeed()
      if (!creationResult.ok) {
        setErrorMessage(creationResult.errorMessage)
        return
      }
      pendingFocusTargetRef.current = 'calendarFeedUrl'
      setCalendarFeedState({ view: 'justCreated', calendarFeedUrl: creationResult.data.url })
      setAnnouncement(successAnnouncement)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setStatus('idle')
    }
  }

  const copyCalendarFeedUrl = async () => {
    if (revealedCalendarFeedLinks === null) return
    clearMessages()
    try {
      await navigator.clipboard.writeText(revealedCalendarFeedLinks.calendarFeedUrl)
      setAnnouncement(CALENDAR_FEED_MESSAGES.linkCopied)
    } catch {
      setErrorMessage(CALENDAR_FEED_MESSAGES.copyFailure)
    }
  }

  const requestFeedDisabling = () => {
    clearMessages()
    pendingFocusTargetRef.current = 'cancelDisablingButton'
    setIsConfirmingDisabling(true)
  }

  const cancelFeedDisabling = () => {
    pendingFocusTargetRef.current = 'disableButton'
    setIsConfirmingDisabling(false)
  }

  const confirmFeedDisabling = async () => {
    clearMessages()
    setStatus('disabling')
    pendingFocusTargetRef.current = 'disableButton'
    try {
      const disablingResult = await disableCalendarFeed()
      if (!disablingResult.ok) {
        setErrorMessage(disablingResult.errorMessage)
        return
      }
      pendingFocusTargetRef.current = 'enableButton'
      setCalendarFeedState({ view: 'inactive' })
      setAnnouncement(CALENDAR_FEED_MESSAGES.disabled)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setStatus('idle')
      setIsConfirmingDisabling(false)
    }
  }

  return {
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
  }
}
