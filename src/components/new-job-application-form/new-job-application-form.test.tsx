import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewJobApplicationForm } from './new-job-application-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const CV_OPTIONS = [
  { id: 'cv-1', label: 'CV Front' },
  { id: 'cv-2', label: 'CV Full-stack' },
]

const renderNewJobApplicationForm = ({
  hasAnthropicApiKey = true,
  cvOptions = CV_OPTIONS,
}: { hasAnthropicApiKey?: boolean; cvOptions?: { id: string; label: string }[] } = {}) => {
  const extractJobPosting = jest.fn().mockResolvedValue({
    ok: true,
    data: {
      title: 'Développeur React senior',
      intermediaryName: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      endClientName: null,
      postedDailyRate: null,
      location: null,
      remotePolicy: null,
      desiredStart: null,
      duration: null,
      stack: [],
    },
  })
  const createJobApplication = jest.fn().mockResolvedValue({ ok: true, data: { id: 'application-1' } })
  const searchEntities = jest.fn().mockResolvedValue({ ok: true, data: [] })
  render(
    <NewJobApplicationForm
      extractJobPosting={extractJobPosting}
      createJobApplication={createJobApplication}
      searchEntities={searchEntities}
      hasAnthropicApiKey={hasAnthropicApiKey}
      cvOptions={cvOptions}
      positionedJobApplications={[]}
    />,
  )
  return { extractJobPosting, createJobApplication }
}

describe('NewJobApplicationForm', () => {
  it('disables the prefill without a Claude key, points to the settings and keeps manual entry', async () => {
    renderNewJobApplicationForm({ hasAnthropicApiKey: false })

    expect(screen.getByRole('button', { name: "Pré-remplir avec l'IA" })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('Ajoute ta clé Claude dans tes préférences pour activer')
    expect(screen.getByRole('link', { name: 'préférences' })).toHaveAttribute('href', '/preferences')
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))
    expect(screen.getByLabelText('Titre de la mission *')).toBeInTheDocument()
  })

  it('offers the prefill without any notice when a Claude key is configured', () => {
    renderNewJobApplicationForm()

    expect(screen.getByRole('button', { name: "Pré-remplir avec l'IA" })).toBeEnabled()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('shows the two numbered columns with the placeholder before the form', () => {
    renderNewJobApplicationForm()

    expect(screen.getByRole('heading', { level: 2, name: "1 · Colle l'annonce" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '2 · Vérifie' })).toBeInTheDocument()
    expect(
      screen.getByText('Le formulaire apparaît ici après le pré-remplissage ou en saisie manuelle.'),
    ).toBeInTheDocument()
  })

  it('flags the form as prefilled by Claude after a successful extraction', async () => {
    renderNewJobApplicationForm()
    await userEvent.type(screen.getByLabelText("Texte de l'annonce"), 'Mission React à Paris')
    await userEvent.click(screen.getByRole('button', { name: "Pré-remplir avec l'IA" }))

    expect(await screen.findByText('Pré-rempli par Claude')).toBeInTheDocument()
  })

  it('does not flag the form as prefilled after the manual entry', async () => {
    renderNewJobApplicationForm()
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))

    expect(screen.queryByText('Pré-rempli par Claude')).not.toBeInTheDocument()
  })

  it('groups the fields in three fieldsets', async () => {
    renderNewJobApplicationForm()
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))

    expect(screen.getByRole('group', { name: 'La mission' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Les personnes' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Les conditions' })).toBeInTheDocument()
  })

  it('writes the clicked source pill in the editable source field', async () => {
    renderNewJobApplicationForm()
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))
    const maltPill = screen.getByRole('button', { name: 'Malt' })
    expect(maltPill).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(maltPill)

    expect(screen.getByLabelText('Source')).toHaveValue('Malt')
    expect(maltPill).toHaveAttribute('aria-pressed', 'true')
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

  it('offers Aucun then the library cvs in the CV envoyé field', async () => {
    renderNewJobApplicationForm()
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))

    const cvSelect = screen.getByLabelText('CV envoyé')
    expect(within(cvSelect).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Aucun',
      'CV Front',
      'CV Full-stack',
    ])
    expect(cvSelect).toHaveValue('')
  })

  it('hides the CV envoyé field when the library is empty', async () => {
    renderNewJobApplicationForm({ cvOptions: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Saisie manuelle' }))

    expect(screen.queryByLabelText('CV envoyé')).not.toBeInTheDocument()
  })
})
