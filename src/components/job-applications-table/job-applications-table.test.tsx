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
    for (const label of ['moins de 7 j', '7 à 14 j', 'plus de 14 j']) {
      expect(within(legend).getByText(label)).toBeInTheDocument()
    }
  })

  it('reveals the to-do details once expanded', async () => {
    renderTable([buildJobApplication({ id: 'a' })], [FOLLOW_UP_ALERT])
    expect(screen.getByText('Détails des rappels')).not.toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Tout déplier' }))
    expect(screen.getByText('Détails des rappels')).toBeVisible()
  })
})
