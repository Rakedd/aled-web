import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { JobApplicationBlock } from './job-application-block'

const mockedRefresh = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockedRefresh }) }))

const renderMissionDetailsBlock = () => {
  const updateJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(
    <JobApplicationBlock
      title="Infos mission"
      view={<p>Lieu : Paris</p>}
      form={{ kind: 'missionDetails', props: { jobApplication: buildJobApplicationOverview(), updateJobApplication } }}
    />,
  )
  return { updateJobApplication }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('JobApplicationBlock', () => {
  it('opens the block form on the pencil and saves only the changed field', async () => {
    const { updateJobApplication } = renderMissionDetailsBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    const locationInput = screen.getByRole('textbox', { name: 'Lieu' })
    await userEvent.clear(locationInput)
    await userEvent.type(locationInput, 'Lyon')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { location: 'Lyon' })
    expect(mockedRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
  })

  it('goes back to reading without sending anything on « Annuler »', async () => {
    const { updateJobApplication } = renderMissionDetailsBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    expect(screen.getByRole('textbox', { name: 'TJM annoncé (€)' })).toHaveFocus()
    await userEvent.type(screen.getByRole('textbox', { name: 'Lieu' }), ' centre')
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Infos mission' })).toHaveFocus()
  })
})
