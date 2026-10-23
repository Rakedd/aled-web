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

const buildDashboard = (overrides: Partial<HomeDashboardProps> = {}) => (
  <HomeDashboard
    firstName="Rayan"
    titleElementId="home-dashboard-title"
    now={NOW}
    initialAlerts={[]}
    jobApplicationSummaries={[]}
    alertInterviews={[]}
    upcomingInterviews={[]}
    highlightedOpportunities={[]}
    highlightedOpportunitiesErrorMessage={null}
    activeJobApplicationCount={0}
    opportunitiesToProcessCount={0}
    recentOpportunityCount={0}
    snoozeAlert={jest.fn()}
    confirmCvStillGood={jest.fn()}
    changeJobApplicationStatus={jest.fn()}
    applyToOpportunity={jest.fn()}
    {...overrides}
  />
)

const renderDashboard = (overrides: Partial<HomeDashboardProps> = {}) => render(buildDashboard(overrides))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('HomeDashboard', () => {
  it('greets the user by first name', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Rayan' })).toBeInTheDocument()
  })

  it('makes the greeting a programmatic focus target with the given id', () => {
    renderDashboard()
    const greeting = screen.getByRole('heading', { level: 1, name: 'Bonjour Rayan' })
    expect(greeting).toHaveAttribute('id', 'home-dashboard-title')
    expect(greeting).toHaveAttribute('tabindex', '-1')
  })

  it('greets without a name when the first name is empty', () => {
    renderDashboard({ firstName: '' })
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour' })).toBeInTheDocument()
  })

  it('trims the first name in the greeting', () => {
    renderDashboard({ firstName: '  Rayan ' })
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Rayan' })).toBeInTheDocument()
  })

  it('greets without a name when the first name is only whitespace', () => {
    renderDashboard({ firstName: '   ' })
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour' })).toBeInTheDocument()
  })

  it('shows the long Paris date of the day', () => {
    renderDashboard()
    expect(screen.getByText('Lundi 19 octobre')).toBeInTheDocument()
  })

  it('summarises the reminders and the next interview and presents it with a countdown', () => {
    renderDashboard({
      initialAlerts: [1, 2, 3, 4].map(buildAlert),
      upcomingInterviews: [{ ...buildInterview(1), startsAt: new Date('2026-10-22T08:00:00Z') }],
    })
    expect(screen.getByText('4 choses à faire et un entretien client jeudi.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Prochain entretien · dans 3 jours' })).toBeInTheDocument()
    expect(screen.getByText('jeu. 22/10 · 10h00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir mon calendrier' })).toHaveAttribute('href', '/calendar')
  })

  it('says there is no interview and hides the following ones', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 2, name: 'Prochain entretien' })).toBeInTheDocument()
    expect(screen.getByText('Aucun entretien prévu.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir mon calendrier' })).toHaveAttribute('href', '/calendar')
    expect(screen.queryByRole('heading', { name: 'Ensuite' })).not.toBeInTheDocument()
  })

  it('lists the second and third interviews under Ensuite', () => {
    renderDashboard({ upcomingInterviews: [1, 2, 3, 4].map(buildInterview) })
    const followingSection = screen.getByRole('region', { name: 'Ensuite' })
    expect(within(followingSection).getAllByRole('listitem')).toHaveLength(2)
    expect(within(followingSection).getByText('Poste 2')).toBeInTheDocument()
    expect(within(followingSection).getByText('Poste 3')).toBeInTheDocument()
    expect(within(followingSection).queryByText('Poste 4')).not.toBeInTheDocument()
  })

  it('shows at most five reminders as tagged links to their application', () => {
    renderDashboard({ initialAlerts: [1, 2, 3, 4, 5, 6].map(buildAlert) })
    const remindersSection = screen.getByRole('region', { name: 'À faire' })
    const reminderLinks = within(remindersSection).getAllByRole('link', { name: /Relance/ })
    expect(reminderLinks).toHaveLength(5)
    expect(reminderLinks[0]).toHaveAttribute('href', '/candidatures/application-1')
    expect(within(reminderLinks[0]).getByText('Relance')).toHaveAttribute('data-tone', 'peach')
    expect(within(remindersSection).getByRole('link', { name: 'Voir mes candidatures' })).toHaveAttribute('href', '/candidatures')
  })

  it.each([
    [6, 'candidatures en cours', { activeJobApplicationCount: 6 }],
    [1, 'candidature en cours', { activeJobApplicationCount: 1 }],
    [12, 'missions à traiter', { opportunitiesToProcessCount: 12 }],
    [1, 'mission à traiter', { opportunitiesToProcessCount: 1 }],
  ])('shows the counter %s with its label %s', (count, label, overrides) => {
    renderDashboard(overrides)
    expect(screen.getByText(String(count))).toBeInTheDocument()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows the empty reminders state and the empty missions state', () => {
    renderDashboard()
    expect(within(screen.getByRole('region', { name: 'À faire' })).getByText("Rien d'urgent aujourd'hui.")).toBeInTheDocument()
    expect(screen.getByText('Pas de nouvelle mission intéressante depuis 48 h.')).toBeInTheDocument()
  })

  it('titles the missions section and links to all opportunities', () => {
    renderDashboard()
    const missionsSection = screen.getByRole('region', { name: 'Missions intéressantes · moins de 48 h' })
    expect(within(missionsSection).getByRole('link', { name: 'Voir mes opportunités' })).toHaveAttribute('href', '/opportunites')
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

  it('keeps the applied mission with its link when the refreshed data no longer contains it', async () => {
    const applyToOpportunity = jest.fn().mockResolvedValue({ ok: true, data: { jobApplicationId: 'created-1' } })
    const { rerender } = renderDashboard({
      highlightedOpportunities: [buildOpportunity(1), buildOpportunity(2)],
      applyToOpportunity,
    })
    await userEvent.click(screen.getAllByRole('button', { name: "J'ai postulé" })[0])
    await screen.findByRole('link', { name: 'Voir la candidature' })

    rerender(buildDashboard({ highlightedOpportunities: [buildOpportunity(2)], applyToOpportunity }))

    const missionTitles = screen.getAllByText(/^Mission vedette/).map((title) => title.textContent)
    expect(missionTitles).toEqual(['Mission vedette 1', 'Mission vedette 2'])
    expect(screen.getByRole('link', { name: 'Voir la candidature' })).toHaveAttribute('href', '/candidatures/created-1')
  })

  it('does not show the empty state while an applied mission is still visible', async () => {
    const applyToOpportunity = jest.fn().mockResolvedValue({ ok: true, data: { jobApplicationId: 'created-1' } })
    const { rerender } = renderDashboard({ highlightedOpportunities: [buildOpportunity(1)], applyToOpportunity })
    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))
    await screen.findByRole('link', { name: 'Voir la candidature' })

    rerender(buildDashboard({ highlightedOpportunities: [], applyToOpportunity }))

    expect(screen.getByRole('link', { name: 'Voir la candidature' })).toHaveAttribute('href', '/candidatures/created-1')
    expect(screen.queryByText('Pas de nouvelle mission intéressante depuis 48 h.')).not.toBeInTheDocument()
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
