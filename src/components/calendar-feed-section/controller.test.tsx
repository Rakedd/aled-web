import { act, renderHook } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { CALENDAR_FEED_MESSAGES, type CalendarFeedStatus } from '@/domain/calendar-feed'
import { useController } from './controller'

const CALENDAR_FEED_URL = 'https://app.aled.work/api/calendar/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE.ics'
const NEW_CALENDAR_FEED_URL = 'https://app.aled.work/api/calendar/ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210-_ZyXwV.ics'
const ACTIVE_STATUS: CalendarFeedStatus = { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') }
const INACTIVE_STATUS: CalendarFeedStatus = { isActive: false, createdAt: null }

const renderCalendarFeedSectionController = ({
  initialCalendarFeedStatusResult = { ok: true, data: INACTIVE_STATUS },
  createCalendarFeed = jest.fn().mockResolvedValue({ ok: true, data: { url: CALENDAR_FEED_URL } }),
  disableCalendarFeed = jest.fn().mockResolvedValue({ ok: true, data: null }),
}: {
  initialCalendarFeedStatusResult?: ActionResult<CalendarFeedStatus>
  createCalendarFeed?: jest.Mock
  disableCalendarFeed?: jest.Mock
} = {}) => {
  const { result } = renderHook(() =>
    useController({ initialCalendarFeedStatusResult, createCalendarFeed, disableCalendarFeed }),
  )
  return { result, createCalendarFeed, disableCalendarFeed }
}

const mockClipboardWriteText = (writeText: jest.Mock | undefined) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText === undefined ? undefined : { writeText },
  })
}

describe('calendar-feed-section useController', () => {
  it('starts without a feed when the user never enabled it', () => {
    const { result } = renderCalendarFeedSectionController()
    expect(result.current.calendarFeedState).toEqual({ view: 'inactive' })
    expect(result.current.revealedCalendarFeedLinks).toBeNull()
  })

  it('shows since when the feed has been active, without knowing its url', () => {
    const { result } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
    })
    expect(result.current.calendarFeedState).toEqual({ view: 'active', createdAt: ACTIVE_STATUS.createdAt })
    expect(result.current.activeSinceLabel).toBe('Flux actif depuis le 20/10/2026')
  })

  it('reports the load failure instead of guessing the feed state', () => {
    const { result } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: false, errorMessage: CALENDAR_FEED_MESSAGES.loadFailure },
    })
    expect(result.current.calendarFeedState).toEqual({
      view: 'unavailable',
      loadErrorMessage: CALENDAR_FEED_MESSAGES.loadFailure,
    })
  })

  it('reveals the url and the subscription links once the feed is enabled', async () => {
    const { result, createCalendarFeed } = renderCalendarFeedSectionController()

    await act(() => result.current.createFeed())

    expect(createCalendarFeed).toHaveBeenCalledTimes(1)
    expect(result.current.calendarFeedState).toEqual({ view: 'justCreated', calendarFeedUrl: CALENDAR_FEED_URL })
    expect(result.current.revealedCalendarFeedLinks).toEqual({
      calendarFeedUrl: CALENDAR_FEED_URL,
      appleCalendarUrl: CALENDAR_FEED_URL.replace('https://', 'webcal://'),
      googleCalendarUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_FEED_URL.replace('https://', 'webcal://'))}`,
    })
    expect(result.current.announcement).toBe(CALENDAR_FEED_MESSAGES.enabled)
    expect(result.current.status).toBe('idle')
  })

  it('replaces the url and says the previous one stopped working when a new link is generated', async () => {
    const { result } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
      createCalendarFeed: jest.fn().mockResolvedValue({ ok: true, data: { url: NEW_CALENDAR_FEED_URL } }),
    })

    await act(() => result.current.createFeed())

    expect(result.current.calendarFeedState).toEqual({ view: 'justCreated', calendarFeedUrl: NEW_CALENDAR_FEED_URL })
    expect(result.current.announcement).toBe(CALENDAR_FEED_MESSAGES.regenerated)
  })

  it('keeps the current state and shows the refusal when the feed cannot be created', async () => {
    const { result } = renderCalendarFeedSectionController({
      createCalendarFeed: jest.fn().mockResolvedValue({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.creationFailure }),
    })

    await act(() => result.current.createFeed())

    expect(result.current.calendarFeedState).toEqual({ view: 'inactive' })
    expect(result.current.errorMessage).toBe(CALENDAR_FEED_MESSAGES.creationFailure)
    expect(result.current.status).toBe('idle')
  })

  it('shows the generic error when the creation call throws', async () => {
    const { result } = renderCalendarFeedSectionController({
      createCalendarFeed: jest.fn().mockRejectedValue(new Error('network down')),
    })

    await act(() => result.current.createFeed())

    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
  })

  it('copies the url to the clipboard and announces it', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    mockClipboardWriteText(writeText)
    const { result } = renderCalendarFeedSectionController()
    await act(() => result.current.createFeed())

    await act(() => result.current.copyCalendarFeedUrl())

    expect(writeText).toHaveBeenCalledWith(CALENDAR_FEED_URL)
    expect(result.current.announcement).toBe(CALENDAR_FEED_MESSAGES.linkCopied)
  })

  it.each([
    ['the clipboard refuses the copy', jest.fn().mockRejectedValue(new Error('denied'))],
    ['the clipboard is not available', undefined],
  ])('asks for a manual copy when %s', async (_caseName, writeText) => {
    mockClipboardWriteText(writeText)
    const { result } = renderCalendarFeedSectionController()
    await act(() => result.current.createFeed())

    await act(() => result.current.copyCalendarFeedUrl())

    expect(result.current.errorMessage).toBe(CALENDAR_FEED_MESSAGES.copyFailure)
    expect(result.current.announcement).toBeNull()
  })

  it('disables the feed only after confirmation', async () => {
    const { result, disableCalendarFeed } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
    })

    act(() => result.current.requestFeedDisabling())
    expect(result.current.isConfirmingDisabling).toBe(true)
    expect(disableCalendarFeed).not.toHaveBeenCalled()
    await act(() => result.current.confirmFeedDisabling())

    expect(disableCalendarFeed).toHaveBeenCalledTimes(1)
    expect(result.current.calendarFeedState).toEqual({ view: 'inactive' })
    expect(result.current.isConfirmingDisabling).toBe(false)
    expect(result.current.announcement).toBe(CALENDAR_FEED_MESSAGES.disabled)
  })

  it('lets the user cancel the disabling', () => {
    const { result, disableCalendarFeed } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
    })

    act(() => result.current.requestFeedDisabling())
    act(() => result.current.cancelFeedDisabling())

    expect(result.current.isConfirmingDisabling).toBe(false)
    expect(disableCalendarFeed).not.toHaveBeenCalled()
  })

  it('keeps the feed and shows the refusal when it cannot be disabled', async () => {
    const { result } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
      disableCalendarFeed: jest.fn().mockResolvedValue({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.disableFailure }),
    })

    act(() => result.current.requestFeedDisabling())
    await act(() => result.current.confirmFeedDisabling())

    expect(result.current.calendarFeedState).toEqual({ view: 'active', createdAt: ACTIVE_STATUS.createdAt })
    expect(result.current.errorMessage).toBe(CALENDAR_FEED_MESSAGES.disableFailure)
  })

  it('shows the generic error when the disabling call throws', async () => {
    const { result } = renderCalendarFeedSectionController({
      initialCalendarFeedStatusResult: { ok: true, data: ACTIVE_STATUS },
      disableCalendarFeed: jest.fn().mockRejectedValue(new Error('network down')),
    })

    act(() => result.current.requestFeedDisabling())
    await act(() => result.current.confirmFeedDisabling())

    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    expect(result.current.status).toBe('idle')
  })
})
