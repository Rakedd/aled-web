import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { saveProfessionalStatus } from '@/server/actions/settings-actions'
import { loadTodoReminders } from '@/server/todo-reminders/load-todo-reminders'
import HomePage from './page'

jest.mock('@/components/home-dashboard', () => ({
  HomeDashboard: ({ titleElementId }: { titleElementId: string }) => (
    <h1 id={titleElementId} tabIndex={-1}>
      Tableau de bord
    </h1>
  ),
}))
jest.mock('@/server/actions/settings-actions', () => ({ saveProfessionalStatus: jest.fn() }))
jest.mock('@/server/actions/cv-actions', () => ({ confirmCvStillGood: jest.fn() }))
jest.mock('@/server/actions/job-application-actions', () => ({
  changeJobApplicationStatus: jest.fn(),
  snoozeAlert: jest.fn(),
}))
jest.mock('@/server/actions/opportunity-actions', () => ({
  applyToOpportunity: jest.fn(),
  countOpportunitiesToProcess: jest.fn().mockResolvedValue({ ok: true, data: 0 }),
  listHighlightedOpportunities: jest.fn().mockResolvedValue({ ok: true, data: { opportunities: [], recentOpportunityCount: 0 } }),
}))
jest.mock('@/server/todo-reminders/load-todo-reminders', () => ({
  loadTodoReminders: jest.fn().mockResolvedValue({
    ok: true,
    data: { jobApplications: [], profileSettings: { firstName: 'Camille', professionalStatus: 'freelance' }, upcomingInterviews: [], alertInterviews: [], alerts: [] },
  }),
}))

const renderHomePage = async (searchParameters: { 'mot-de-passe'?: string | string[] }) =>
  render(await HomePage({ searchParams: Promise.resolve(searchParameters) } as PageProps<'/'>))

describe('HomePage', () => {
  it('shows the password-updated banner for the flag', async () => {
    await renderHomePage({ 'mot-de-passe': 'modifie' })

    expect(await screen.findByText('Mot de passe modifié.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.')
  })

  it.each([{}, { 'mot-de-passe': 'autre' }, { 'mot-de-passe': ['modifie', 'x'] }])(
    'keeps the banner status region mounted but empty for %j',
    async (searchParameters) => {
      await renderHomePage(searchParameters)

      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    },
  )

  it('keeps the banner status region mounted when the page fails to load', async () => {
    jest.mocked(loadTodoReminders).mockResolvedValueOnce({ ok: false, errorMessage: 'Service indisponible' })

    await renderHomePage({ 'mot-de-passe': 'modifie' })

    expect(await screen.findByText('Mot de passe modifié.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.')
    expect(screen.getByRole('alert')).toHaveTextContent('Service indisponible')
  })

  const mockMissingProfessionalStatus = () =>
    jest.mocked(loadTodoReminders).mockResolvedValueOnce({
      ok: true,
      data: {
        jobApplications: [],
        profileSettings: { firstName: 'Camille', professionalStatus: null },
        upcomingInterviews: [],
        alertInterviews: [],
        alerts: [],
      },
    } as never)

  it('asks for the professional status when it is missing', async () => {
    mockMissingProfessionalStatus()

    await renderHomePage({})

    expect(screen.getByRole('button', { name: 'Freelance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CDI' })).toBeInTheDocument()
  })

  it('moves focus to the dashboard title once the professional status is chosen', async () => {
    mockMissingProfessionalStatus()
    jest.mocked(saveProfessionalStatus).mockResolvedValueOnce({ ok: true, data: null })

    await renderHomePage({})
    await userEvent.click(screen.getByRole('button', { name: 'Freelance' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toHaveFocus()
  })

  it('does not ask when the professional status is known', async () => {
    await renderHomePage({})

    expect(screen.queryByText('Tu es…')).not.toBeInTheDocument()
  })
})
