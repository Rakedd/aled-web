import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewJobApplicationForm } from './new-job-application-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const renderNewJobApplicationForm = () => {
  const extractJobPosting = jest.fn()
  const createJobApplication = jest.fn().mockResolvedValue({ ok: true, data: { id: 'application-1' } })
  const searchEntities = jest.fn().mockResolvedValue({ ok: true, data: [] })
  render(
    <NewJobApplicationForm
      extractJobPosting={extractJobPosting}
      createJobApplication={createJobApplication}
      searchEntities={searchEntities}
    />,
  )
  return { extractJobPosting, createJobApplication }
}

describe('NewJobApplicationForm', () => {
  it('keeps a malformed daily rate as typed and refuses it with TJM invalide', async () => {
    const { createJobApplication } = renderNewJobApplicationForm()
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))
    await userEvent.type(screen.getByLabelText('Titre de la mission *'), 'Développeur React')

    const dailyRateInput = screen.getByLabelText('TJM annoncé (€)')
    await userEvent.type(dailyRateInput, '6OO')

    expect(dailyRateInput).toHaveProperty('type', 'text')
    expect(dailyRateInput).toHaveAttribute('inputmode', 'numeric')
    expect(dailyRateInput).toHaveValue('6OO')
    await userEvent.click(screen.getByRole('button', { name: 'Créer la candidature' }))
    expect(screen.getByRole('alert')).toHaveTextContent('TJM invalide')
    expect(createJobApplication).not.toHaveBeenCalled()
  })
})
