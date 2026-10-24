import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { TodoAlert } from '@/domain/todo-alerts'
import { JobApplicationsTable } from './job-applications-table'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const NOW = new Date('2026-10-20T10:00:00Z')

const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

const buildJobApplication = (overrides: Partial<JobApplicationListItem>): JobApplicationListItem => ({
  id: 'id',
  userId: 'user',
  title: 'Dev',
  source: null,
  postingUrl: null,
  status: 'applied',
  intermediaryId: null,
  contactId: null,
  endClientId: null,
  postedDailyRate: null,
  requestedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  appliedOn: daysAgo(40),
  notes: null,
  actualStartDate: null,
  stack: [],
  createdAt: daysAgo(40),
  updatedAt: daysAgo(40),
  lastActivityAt: null,
  hasJobSpec: false,
  intermediaryName: null,
  intermediaryKind: null,
  contactName: null,
  endClientName: null,
  endClientParentName: null,
  endClientLabel: null,
  ...overrides,
})

const FOLLOW_UP_ALERT: TodoAlert = {
  kind: 'follow_up_due',
  jobApplicationId: 'a',
  jobApplicationTitle: 'Alpha',
  referenceDate: NOW,
}

const renderTable = (jobApplications: JobApplicationListItem[], alerts: TodoAlert[] = []) =>
  render(<JobApplicationsTable jobApplications={jobApplications} alerts={alerts} todoDetails={<p>Détails des rappels</p>} now={NOW} />)

describe('JobApplicationsTable', () => {
  it('colours the last exchange by aging', () => {
    renderTable([
      buildJobApplication({ id: 'a', title: 'Alpha', lastActivityAt: daysAgo(3) }),
      buildJobApplication({ id: 'b', title: 'Bravo', lastActivityAt: daysAgo(9) }),
      buildJobApplication({ id: 'c', title: 'Charlie', lastActivityAt: daysAgo(21) }),
    ])
    const toneOfRow = (title: string) => {
      const row = screen.getByRole('link', { name: title }).closest('tr') as HTMLElement
      return row.querySelector('td:last-child [data-tone]')?.getAttribute('data-tone')
    }
    expect(toneOfRow('Alpha')).toBe('forest-soft')
    expect(toneOfRow('Bravo')).toBe('peach-soft')
    expect(toneOfRow('Charlie')).toBe('clay')
  })

  it('keeps plain text for a finished application', async () => {
    renderTable([buildJobApplication({ id: 'k', title: 'Kilo', status: 'ko_cv', lastActivityAt: daysAgo(30) })])
    await userEvent.click(screen.getByLabelText('Afficher les candidatures terminées'))
    const row = screen.getByRole('link', { name: 'Kilo' }).closest('tr') as HTMLElement
    expect(row.querySelector('td:last-child [data-tone]')).toBeNull()
  })

  it('shows the aging legend', () => {
    renderTable([buildJobApplication({})])
    expect(screen.getByText('Dernier échange :')).toBeInTheDocument()
    const legend = screen.getByText('Dernier échange :').parentElement as HTMLElement
    const expectedTones = { 'moins de 7 j': 'forest-soft', '7 à 14 j': 'peach-soft', 'plus de 14 j': 'clay' }
    for (const [label, tone] of Object.entries(expectedTones)) {
      expect(within(legend).getByText(label)).toHaveAttribute('data-tone', tone)
    }
  })

  it('reveals the to-do details once expanded', async () => {
    renderTable([buildJobApplication({ id: 'a' })], [FOLLOW_UP_ALERT])
    const expandButton = screen.getByRole('button', { name: 'Tout déplier' })
    const detailsRegion = screen.getByText('Détails des rappels').parentElement as HTMLElement
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(expandButton).toHaveAttribute('aria-controls', detailsRegion.id)
    expect(detailsRegion).toHaveAttribute('hidden')
    await userEvent.click(expandButton)
    expect(screen.getByRole('button', { name: 'Tout replier' })).toHaveAttribute('aria-expanded', 'true')
    expect(detailsRegion).not.toHaveAttribute('hidden')
    expect(screen.getByText('Détails des rappels')).toBeVisible()
  })

  it('keeps only the applications with a follow-up alert when the pill is clicked', async () => {
    renderTable(
      [buildJobApplication({ id: 'a', title: 'Alpha' }), buildJobApplication({ id: 'b', title: 'Bravo' })],
      [FOLLOW_UP_ALERT],
    )
    await userEvent.click(screen.getByRole('button', { name: '1 relance' }))
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bravo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '1 relance' }))
    expect(screen.getByRole('link', { name: 'Bravo' })).toBeInTheDocument()
  })

  it('hides the contact, source and application date columns under md and keeps the others', () => {
    renderTable([buildJobApplication({ id: 'a', title: 'Alpha', contactName: 'Jeanne', source: 'Malt' })])
    for (const hiddenColumnName of ['Contact', 'Source', 'Candidature']) {
      expect(screen.getByRole('columnheader', { name: hiddenColumnName })).toHaveClass('hidden', 'md:table-cell')
    }
    for (const visibleColumnName of ['Mission', 'Intermédiaire', 'Client final', 'Statut', 'Dernier échange']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(`^${visibleColumnName}`) })).not.toHaveClass('hidden')
    }
    const row = screen.getByRole('link', { name: 'Alpha' }).closest('tr') as HTMLElement
    expect(within(row).getByText('Jeanne')).toHaveClass('hidden', 'md:table-cell')
    expect(within(row).getByText('Malt')).toHaveClass('hidden', 'md:table-cell')
    expect(within(row).getByText('10/09/2026')).toHaveClass('hidden', 'md:table-cell')
    expect(screen.getByRole('table')).toHaveClass('md:min-w-[56rem]')
  })

  it('styles the status filter like an outline button at the search field height', () => {
    renderTable([buildJobApplication({})])
    const statusSummary = screen.getByText('Statut', { selector: 'summary' })
    expect(statusSummary).toHaveClass('h-11', 'border-input', 'bg-card', 'list-none')
    expect(statusSummary.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('tints every filter checkbox with the primary token at a comfortable size', () => {
    renderTable([buildJobApplication({})])
    const showTerminalCheckbox = screen.getByLabelText('Afficher les candidatures terminées')
    expect(showTerminalCheckbox).toHaveClass('size-4', 'accent-primary')
    expect(showTerminalCheckbox.closest('label')).toHaveClass('min-h-11', 'items-center')
    expect(screen.getByRole('checkbox', { name: 'Postulé' })).toHaveClass('size-4', 'accent-primary')
  })
})
