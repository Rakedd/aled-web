import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteJobApplicationButton } from './delete-job-application-button'

const mockedPush = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockedPush }) }))

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const renderButton = () => {
  const deleteJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(<DeleteJobApplicationButton jobApplicationId={JOB_APPLICATION_ID} deleteJobApplication={deleteJobApplication} />)
  return { deleteJobApplication }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DeleteJobApplicationButton', () => {
  it('asks for a confirmation and deletes nothing when cancelled', async () => {
    const { deleteJobApplication } = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la candidature' }))

    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Supprimer définitivement cette candidature ?',
    })
    expect(confirmation).toHaveAccessibleDescription(
      'Son journal, ses entretiens et sa fiche métier seront supprimés.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteJobApplication).not.toHaveBeenCalled()
  })

  it('deletes the application and goes back to the applications list with the notice', async () => {
    const { deleteJobApplication } = renderButton()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la candidature' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))

    expect(deleteJobApplication).toHaveBeenCalledWith(JOB_APPLICATION_ID)
    expect(mockedPush).toHaveBeenCalledWith('/?supprimee=1')
  })
})
