import { render, screen } from '@testing-library/react'
import HomePage from './page'

jest.mock('@/components/home-dashboard', () => ({ HomeDashboard: () => <h1>Tableau de bord</h1> }))
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
    data: { jobApplications: [], profileSettings: { firstName: 'Camille' }, upcomingInterviews: [], alertInterviews: [], alerts: [] },
  }),
}))

const renderHomePage = async (searchParameters: { 'mot-de-passe'?: string | string[] }) =>
  render(await HomePage({ searchParams: Promise.resolve(searchParameters) } as PageProps<'/'>))

describe('HomePage', () => {
  it('shows the password-updated banner for the flag', async () => {
    await renderHomePage({ 'mot-de-passe': 'modifie' })

    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.')
  })

  it.each([{}, { 'mot-de-passe': 'autre' }, { 'mot-de-passe': ['modifie', 'x'] }])(
    'shows no banner for %j',
    async (searchParameters) => {
      await renderHomePage(searchParameters)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    },
  )
})
