import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TodoAlert } from '@/domain/todo-alerts'
import { TodoBanner } from './todo-banner'

const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const renderTodoBanner = (
  title: string,
  initialAlerts: TodoAlert[] = [],
  addActivityLogEntry = jest.fn(),
  hasAnthropicApiKey = true,
) =>
  render(
    <TodoBanner
      title={title}
      initialAlerts={initialAlerts}
      snoozeAlert={jest.fn()}
      confirmCvStillGood={jest.fn()}
      changeJobApplicationStatus={jest.fn()}
      hasAnthropicApiKey={hasAnthropicApiKey}
      addActivityLogEntry={addActivityLogEntry}
      jobApplicationSummaries={[]}
      interviews={[]}
      now={new Date('2026-10-20T10:00:00Z')}
    />,
  )

describe('TodoBanner', () => {
  it('names its region after the title prop', () => {
    renderTodoBanner('Tous les rappels')
    expect(screen.getByRole('region', { name: 'Tous les rappels' })).toBeInTheDocument()
  })

  it('keeps the labels of two instances apart', () => {
    renderTodoBanner('À faire')
    renderTodoBanner('Tous les rappels')
    expect(screen.getByRole('region', { name: 'À faire' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tous les rappels' })).toBeInTheDocument()
  })

  it('links the cv reminder and its Mettre à jour button to Mes CV, without snooze buttons', () => {
    renderTodoBanner('À faire', [
      { kind: 'cv_outdated', cvId: 'cv-1', cvLabel: 'CV DevOps', referenceDate: new Date('2026-07-01T10:00:00Z') },
    ])
    const card = screen.getByRole('listitem')
    expect(within(card).getByRole('link', { name: /Ton CV DevOps n'a pas bougé/ })).toHaveAttribute('href', '/cv')
    expect(within(card).getByRole('link', { name: 'Mettre à jour' })).toHaveAttribute('href', '/cv')
    expect(within(card).getByRole('button', { name: 'Il est encore bon' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Reporter/ })).not.toBeInTheDocument()
  })

  it('offers to draft a follow up only on the follow up due reminders', () => {
    const referenceDate = new Date('2026-10-01T10:00:00Z')
    renderTodoBanner('À faire', [
      { kind: 'follow_up_due', jobApplicationId: 'application-1', jobApplicationTitle: 'Dev React', referenceDate },
      { kind: 'no_news_suggestion', jobApplicationId: 'application-2', jobApplicationTitle: 'Dev Node', referenceDate },
      { kind: 'job_spec_missing', jobApplicationId: 'application-3', jobApplicationTitle: 'Dev Go', referenceDate },
    ])
    const [followUpCard, noNewsCard, jobSpecCard] = screen.getAllByRole('listitem')
    const draftButton = within(followUpCard).getByRole('button', { name: 'Rédiger une relance pour « Dev React »' })
    expect(draftButton).toHaveTextContent('Rédiger')
    expect(within(followUpCard).getAllByRole('button', { name: /Reporter/ }).length).toBeGreaterThan(0)
    expect(within(noNewsCard).queryByRole('button', { name: /Rédiger/ })).not.toBeInTheDocument()
    expect(within(jobSpecCard).queryByRole('button', { name: /Rédiger/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Rédiger/ })).toHaveLength(1)
  })

  it('removes the reminder of a sent follow up, focuses the banner title and announces it', async () => {
    const user = userEvent.setup()
    const addActivityLogEntry = jest.fn().mockResolvedValue({ ok: true, data: null })
    const referenceDate = new Date('2026-10-01T10:00:00Z')
    renderTodoBanner(
      'À faire',
      [
        { kind: 'follow_up_due', jobApplicationId: 'application-1', jobApplicationTitle: 'Dev React', referenceDate },
        { kind: 'job_spec_missing', jobApplicationId: 'application-3', jobApplicationTitle: 'Dev Go', referenceDate },
      ],
      addActivityLogEntry,
      false,
    )
    await user.click(screen.getByRole('button', { name: 'Rédiger une relance pour « Dev React »' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: "J'ai envoyé la relance" }))
    expect(addActivityLogEntry).toHaveBeenCalledWith('application-1', { kind: 'message', summary: 'Relance envoyée' })
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'À faire' })).toHaveFocus()
    const banner = screen.getByRole('region', { name: 'À faire' })
    expect(within(banner).getByRole('status')).toHaveTextContent('Relance notée dans le journal.')
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
