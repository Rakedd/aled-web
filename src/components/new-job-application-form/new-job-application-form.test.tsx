import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewJobApplicationForm } from './new-job-application-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const renderNewJobApplicationForm = ({ hasAnthropicApiKey = true }: { hasAnthropicApiKey?: boolean } = {}) => {
  const extractJobPosting = jest.fn()
  const createJobApplication = jest.fn().mockResolvedValue({ ok: true, data: { id: 'application-1' } })
  const searchEntities = jest.fn().mockResolvedValue({ ok: true, data: [] })
  render(
    <NewJobApplicationForm
      extractJobPosting={extractJobPosting}
      createJobApplication={createJobApplication}
      searchEntities={searchEntities}
      hasAnthropicApiKey={hasAnthropicApiKey}
    />,
  )
  return { extractJobPosting, createJobApplication }
}

describe('NewJobApplicationForm', () => {
  it('disables the prefill without a Claude key, points to the settings and keeps manual entry', async () => {
    renderNewJobApplicationForm({ hasAnthropicApiKey: false })

    expect(screen.getByRole('button', { name: 'Pré-remplir' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('Ajoute ta clé Claude dans tes préférences pour activer')
    expect(screen.getByRole('link', { name: 'préférences' })).toHaveAttribute('href', '/preferences')
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))
    expect(screen.getByLabelText('Titre de la mission *')).toBeInTheDocument()
  })

  it('offers the prefill without any notice when a Claude key is configured', () => {
    renderNewJobApplicationForm()

    expect(screen.getByRole('button', { name: 'Pré-remplir' })).toBeEnabled()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

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
