import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ActionResult } from '@/domain/action-result'
import { CALENDAR_FEED_MESSAGES, type CalendarFeedStatus } from '@/domain/calendar-feed'
import { CalendarFeedSection } from './calendar-feed-section'

const CALENDAR_FEED_URL = 'https://app.aled.work/api/calendar/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE.ics'
const WEBCAL_CALENDAR_FEED_URL = CALENDAR_FEED_URL.replace('https://', 'webcal://')

const renderSection = ({
  initialCalendarFeedStatusResult = { ok: true, data: { isActive: false, createdAt: null } },
  createCalendarFeed = jest.fn().mockResolvedValue({ ok: true, data: { url: CALENDAR_FEED_URL } }),
  disableCalendarFeed = jest.fn().mockResolvedValue({ ok: true, data: null }),
}: {
  initialCalendarFeedStatusResult?: ActionResult<CalendarFeedStatus>
  createCalendarFeed?: jest.Mock
  disableCalendarFeed?: jest.Mock
} = {}) => {
  render(
    <CalendarFeedSection
      initialCalendarFeedStatusResult={initialCalendarFeedStatusResult}
      createCalendarFeed={createCalendarFeed}
      disableCalendarFeed={disableCalendarFeed}
    />,
  )
  return { createCalendarFeed, disableCalendarFeed }
}

describe('CalendarFeedSection', () => {
  it('offers to enable the feed when there is none', () => {
    renderSection()

    expect(screen.getByRole('region', { name: 'Calendrier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activer le flux calendrier' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Désactiver le flux' })).not.toBeInTheDocument()
  })

  it('keeps an empty status region mounted from the first render, so announcements are read', () => {
    renderSection()

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows the url once, with the copy, the subscription links and the warning, right after enabling', async () => {
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Activer le flux calendrier' }))

    expect(screen.getByLabelText('Lien de ton flux calendrier')).toHaveValue(CALENDAR_FEED_URL)
    expect(screen.getByLabelText('Lien de ton flux calendrier')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Lien de ton flux calendrier')).toHaveFocus()
    expect(screen.getByText(CALENDAR_FEED_MESSAGES.refreshDelayNotice)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajouter à Google Agenda' })).toHaveAttribute(
      'href',
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(WEBCAL_CALENDAR_FEED_URL)}`,
    )
    expect(screen.getByRole('link', { name: 'Ajouter à Apple Calendrier' })).toHaveAttribute('href', WEBCAL_CALENDAR_FEED_URL)
    expect(screen.getByText(CALENDAR_FEED_MESSAGES.secretWarning)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Flux calendrier activé.')
  })

  it('announces the copy of the link', async () => {
    const user = userEvent.setup()
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    renderSection()
    await user.click(screen.getByRole('button', { name: 'Activer le flux calendrier' }))

    await user.click(screen.getByRole('button', { name: 'Copier le lien' }))

    expect(writeText).toHaveBeenCalledWith(CALENDAR_FEED_URL)
    expect(screen.getByRole('status')).toHaveTextContent('Lien copié.')
  })

  it('shows since when an existing feed is active, without its url', () => {
    renderSection({
      initialCalendarFeedStatusResult: { ok: true, data: { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') } },
    })

    expect(screen.getByText('Flux actif depuis le 20/10/2026')).toBeInTheDocument()
    expect(screen.queryByLabelText('Lien de ton flux calendrier')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Générer un nouveau lien' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Désactiver le flux' })).toBeInTheDocument()
  })

  it('reveals a new url when the user generates a new link', async () => {
    const user = userEvent.setup()
    const { createCalendarFeed } = renderSection({
      initialCalendarFeedStatusResult: { ok: true, data: { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') } },
    })

    await user.click(screen.getByRole('button', { name: 'Générer un nouveau lien' }))

    expect(createCalendarFeed).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Lien de ton flux calendrier')).toHaveValue(CALENDAR_FEED_URL)
    expect(screen.getByLabelText('Lien de ton flux calendrier')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent("Nouveau lien généré. L'ancien ne fonctionne plus.")
  })

  it('disables the feed after confirmation and offers to enable it again', async () => {
    const user = userEvent.setup()
    const { disableCalendarFeed } = renderSection({
      initialCalendarFeedStatusResult: { ok: true, data: { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') } },
    })

    await user.click(screen.getByRole('button', { name: 'Désactiver le flux' }))
    expect(disableCalendarFeed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect(disableCalendarFeed).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Activer le flux calendrier' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Flux calendrier désactivé.')
  })

  it('brings the focus back to the disable button when the user cancels', async () => {
    const user = userEvent.setup()
    renderSection({
      initialCalendarFeedStatusResult: { ok: true, data: { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') } },
    })

    await user.click(screen.getByRole('button', { name: 'Désactiver le flux' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByRole('button', { name: 'Désactiver le flux' })).toHaveFocus()
  })

  it('brings the focus back to the disable button and shows the alert when the disabling fails', async () => {
    const user = userEvent.setup()
    renderSection({
      initialCalendarFeedStatusResult: { ok: true, data: { isActive: true, createdAt: new Date('2026-10-20T08:00:00.000Z') } },
      disableCalendarFeed: jest.fn().mockResolvedValue({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.disableFailure }),
    })

    await user.click(screen.getByRole('button', { name: 'Désactiver le flux' }))
    await user.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect(screen.getByRole('button', { name: 'Désactiver le flux' })).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent(CALENDAR_FEED_MESSAGES.disableFailure)
  })

  it('shows the creation refusal as an alert', async () => {
    const user = userEvent.setup()
    renderSection({
      createCalendarFeed: jest.fn().mockResolvedValue({ ok: false, errorMessage: CALENDAR_FEED_MESSAGES.creationFailure }),
    })

    await user.click(screen.getByRole('button', { name: 'Activer le flux calendrier' }))

    expect(screen.getByRole('alert')).toHaveTextContent(CALENDAR_FEED_MESSAGES.creationFailure)
  })

  it('shows only the load failure when the feed status is unknown', () => {
    renderSection({ initialCalendarFeedStatusResult: { ok: false, errorMessage: CALENDAR_FEED_MESSAGES.loadFailure } })

    expect(screen.getByRole('alert')).toHaveTextContent(CALENDAR_FEED_MESSAGES.loadFailure)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
