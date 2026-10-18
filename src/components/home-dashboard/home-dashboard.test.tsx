import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InterviewWithJobApplication } from '@/domain/interviews'
import type { OpportunityListItem } from '@/domain/opportunities'
import type { TodoAlert } from '@/domain/todo-alerts'
import { HomeDashboard } from './home-dashboard'
import type { HomeDashboardProps } from './interfaces'

const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

const NOW = new Date('2026-10-19T08:00:00Z')

const buildAlert = (index: number): TodoAlert => ({
  kind: 'follow_up_due',
  jobApplicationId: `application-${index}`,
  jobApplicationTitle: `Mission ${index}`,
  referenceDate: new Date('2026-10-01T10:00:00Z'),
})

const buildInterview = (index: number): InterviewWithJobApplication => ({
  id: `interview-${index}`,
  jobApplicationId: `application-${index}`,
  startsAt: new Date(`2026-10-2${index}T08:00:00Z`),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
  jobApplicationTitle: `Poste ${index}`,
  endClientLabel: null,
  stack: [],
  location: null,
  remotePolicy: null,
  postedDailyRate: null,
  requestedDailyRate: null,
  desiredStart: null,
  duration: null,
  postingRawText: null,
})

const buildOpportunity = (index: number): OpportunityListItem => ({
  id: `opportunity-${index}`,
  source: 'free-work',
  externalId: `external-${index}`,
  url: `https://www.free-work.com/fr/tech-it/job-mission/${index}`,
  title: `Mission vedette ${index}`,
  company: null,
  description: 'Description longue',
  rateMin: null,
  rateMax: 600,
  rateLabel: null,
  currency: null,
  remoteMode: null,
  locationLabel: null,
  region: null,
  country: null,
  durationMonths: null,
  publishedAt: new Date('2026-10-19T06:00:00Z'),
  skills: [],
  receivedAt: new Date('2026-10-19T06:30:00Z'),
  decision: null,
  jobApplicationId: null,
})

const renderDashboard = (overrides: Partial<HomeDashboardProps> = {}) =>
  render(
    <HomeDashboard
      firstName="Rayan"
      now={NOW}
      initialAlerts={[]}
      jobApplicationSummaries={[]}
      alertInterviews={[]}
      upcomingInterviews={[]}
      highlightedOpportunities={[]}
      highlightedOpportunitiesErrorMessage={null}
      snoozeAlert={jest.fn()}
      changeJobApplicationStatus={jest.fn()}
      applyToOpportunity={jest.fn()}
      {...overrides}
    />,
  )

beforeEach(() => {
  jest.clearAllMocks()
})

describe('HomeDashboard', () => {
  it('greets the user by first name', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Rayan' })).toBeInTheDocument()
  })

  it('greets without a name when the first name is empty', () => {
    renderDashboard({ firstName: '' })
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour' })).toBeInTheDocument()
  })

  it('shows at most five reminders and a link to see them all', () => {
    renderDashboard({ initialAlerts: [1, 2, 3, 4, 5, 6].map(buildAlert) })
    const banner = screen.getByRole('region', { name: 'À faire' })
    expect(within(banner).getAllByRole('listitem')).toHaveLength(5)
    expect(within(banner).getByRole('link', { name: 'Voir tout' })).toHaveAttribute('href', '/candidatures')
  })

  it('does not offer to see all reminders when there are five or fewer', () => {
    renderDashboard({ initialAlerts: [1, 2, 3, 4, 5].map(buildAlert) })
    expect(screen.queryByRole('link', { name: 'Voir tout' })).not.toBeInTheDocument()
  })

  it('shows at most three upcoming interviews linking to their application', () => {
    renderDashboard({ upcomingInterviews: [1, 2, 3, 4].map(buildInterview) })
    const section = screen.getByRole('region', { name: 'Prochains entretiens' })
    const links = within(section).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '/candidatures/application-1')
    expect(links[0]).toHaveTextContent('Entretien client · Poste 1')
  })

  it('shows the three empty states', () => {
    renderDashboard()
    expect(screen.getByText("Rien d'urgent aujourd'hui.")).toBeInTheDocument()
    expect(screen.getByText('Aucun entretien prévu.')).toBeInTheDocument()
    expect(screen.getByText('Pas de nouvelle mission intéressante depuis 48 h.')).toBeInTheDocument()
  })

  it('shows the three shortcuts with their destinations', () => {
    renderDashboard()
    const shortcuts = screen.getByRole('navigation', { name: 'Raccourcis' })
    expect(within(shortcuts).getByRole('link', { name: 'Voir mes candidatures' })).toHaveAttribute('href', '/candidatures')
    expect(within(shortcuts).getByRole('link', { name: 'Voir mon calendrier' })).toHaveAttribute('href', '/calendar')
    expect(within(shortcuts).getByRole('link', { name: 'Voir mes opportunités' })).toHaveAttribute('href', '/opportunites')
  })

  it('shows highlighted missions in compact mode without the dismiss button', () => {
    renderDashboard({ highlightedOpportunities: [buildOpportunity(1)] })
    expect(screen.getByText('Mission vedette 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir sur Free-Work' })).toBeInTheDocument()
    expect(screen.queryByText('Description longue')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pas intéressé' })).not.toBeInTheDocument()
  })

  it('applies to a highlighted mission and refreshes the page', async () => {
    const applyToOpportunity = jest.fn().mockResolvedValue({ ok: true, data: { jobApplicationId: 'created-1' } })
    renderDashboard({ highlightedOpportunities: [buildOpportunity(1)], applyToOpportunity })
    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))
    expect(applyToOpportunity).toHaveBeenCalledWith('opportunity-1')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('link', { name: 'Voir la candidature' })).toHaveAttribute('href', '/candidatures/created-1')
  })

  it('shows the error and does not refresh when applying fails', async () => {
    const applyToOpportunity = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Échec de création' })
    renderDashboard({ highlightedOpportunities: [buildOpportunity(1)], applyToOpportunity })
    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec de création')
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows a generic error when applying throws', async () => {
    const applyToOpportunity = jest.fn().mockRejectedValue(new Error('network'))
    renderDashboard({ highlightedOpportunities: [buildOpportunity(1)], applyToOpportunity })
    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue, réessaie.')
  })

  it('shows the loading error instead of the empty state when missions cannot be loaded', () => {
    renderDashboard({ highlightedOpportunitiesErrorMessage: 'Impossible de charger les opportunités' })
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger les opportunités')
    expect(screen.queryByText('Pas de nouvelle mission intéressante depuis 48 h.')).not.toBeInTheDocument()
  })
})
