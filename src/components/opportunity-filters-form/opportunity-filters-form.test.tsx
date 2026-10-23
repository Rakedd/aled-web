import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CvOption } from '@/domain/cv-library'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import { OpportunityFiltersForm } from './opportunity-filters-form'
import type { OpportunityFiltersFormProps } from './interfaces'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const CV_OPTIONS: CvOption[] = [{ id: 'cv-react', label: 'CV React' }]

const renderForm = (
  knownRegions: string[] = [],
  initialFilters = EMPTY_OPPORTUNITY_FILTERS,
  overrides: Partial<OpportunityFiltersFormProps> = {},
) => {
  const saveOpportunityFilters = jest.fn().mockResolvedValue({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
  const extractSkillsFromCv = jest.fn().mockResolvedValue({ ok: true, data: ['ReactJS', 'Docker'] })
  render(
    <OpportunityFiltersForm
      initialFilters={initialFilters}
      knownRegions={knownRegions}
      cvOptions={CV_OPTIONS}
      cvLibraryErrorMessage={null}
      hasAnthropicApiKey
      saveOpportunityFilters={saveOpportunityFilters}
      extractSkillsFromCv={extractSkillsFromCv}
      {...overrides}
    />,
  )
  return { saveOpportunityFilters, extractSkillsFromCv }
}

describe('OpportunityFiltersForm', () => {
  it('tells that without any filter every mission shows', () => {
    renderForm()
    expect(screen.getByText("Sans aucun filtre, toutes les missions s'affichent.")).toBeInTheDocument()
  })

  it('shows every source switched on by default', () => {
    renderForm()
    const sourcesGroup = screen.getByRole('group', { name: 'Sources' })
    expect(within(sourcesGroup).getByRole('button', { name: 'Free-Work' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sourcesGroup).getByRole('button', { name: 'Collective' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a disabled source switched off', () => {
    renderForm([], { ...EMPTY_OPPORTUNITY_FILTERS, disabledSources: ['collective'] })
    expect(screen.getByRole('button', { name: 'Collective' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('saves a source switched off', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Collective' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ disabledSources: ['collective'] }))
  })

  it('keeps a typed but unconfirmed keyword when the user clicks Enregistrer les filtres', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Doit contenir au moins un de'), 'react')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      expect.objectContaining({ includeKeywords: ['react'] }),
    )
  })

  it('submits with Enter from a rate floor', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Hybride'), '500{Enter}')
    expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ rateFloorHybrid: 500 }))
  })

  it('renders known regions and selected unknown regions as toggles', () => {
    renderForm([], { ...EMPTY_OPPORTUNITY_FILTERS, regions: ['Belgique'] })
    expect(screen.getByRole('button', { name: 'Bretagne' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Belgique' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a region selected with a curly apostrophe as pressed on its static toggle', () => {
    renderForm([], { ...EMPTY_OPPORTUNITY_FILTERS, regions: ['Provence-Alpes-Côte d’Azur'] })
    expect(screen.getByRole('button', { name: "Provence-Alpes-Côte d'Azur" })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Provence-Alpes-Côte d’Azur' })).not.toBeInTheDocument()
  })

  it('saves a region toggled on', async () => {
    const { saveOpportunityFilters } = renderForm(['Bretagne'])
    await userEvent.click(screen.getByRole('button', { name: 'Bretagne' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ regions: ['Bretagne'] }))
  })

  it('shows the amount error under the field with aria-invalid and aria-describedby', async () => {
    renderForm()
    const onsiteInput = screen.getByLabelText('Sur site')
    await userEvent.type(onsiteInput, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(onsiteInput).toHaveAttribute('aria-invalid', 'true')
    expect(onsiteInput).toHaveAccessibleDescription('Montant invalide')
  })

  describe('my skills', () => {
    it('opens the form with the « Mes compétences » block', () => {
      renderForm()

      const skillsGroup = screen.getByRole('group', { name: 'Mes compétences' })
      expect(within(skillsGroup).getByLabelText('Tes technos, une par une')).toBeInTheDocument()
      expect(skillsGroup.compareDocumentPosition(screen.getByRole('group', { name: 'Sources' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('saves the skills typed one by one', async () => {
      const { saveOpportunityFilters } = renderForm()

      await userEvent.type(screen.getByLabelText('Tes technos, une par une'), 'React{Enter}TypeScript{Enter}')
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))

      expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ mySkills: ['React', 'TypeScript'] }))
    })

    it('merges the skills extracted from my CV without duplicates and saves nothing before « Enregistrer »', async () => {
      const { saveOpportunityFilters, extractSkillsFromCv } = renderForm([], {
        ...EMPTY_OPPORTUNITY_FILTERS,
        mySkills: ['React'],
      })

      await userEvent.click(screen.getByRole('button', { name: 'Extraire les compétences' }))

      expect(extractSkillsFromCv).toHaveBeenCalledWith('cv-react')
      const skillsGroup = screen.getByRole('group', { name: 'Mes compétences' })
      expect(within(skillsGroup).getByRole('button', { name: 'Retirer React' })).toBeInTheDocument()
      expect(within(skillsGroup).getByRole('button', { name: 'Retirer Docker' })).toBeInTheDocument()
      expect(within(skillsGroup).queryByRole('button', { name: 'Retirer ReactJS' })).not.toBeInTheDocument()
      expect(await screen.findByText('1 compétence ajoutée. Pense à enregistrer.')).toBeInTheDocument()
      expect(saveOpportunityFilters).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))

      expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ mySkills: ['React', 'Docker'] }))
      expect(await screen.findByText('Filtres enregistrés')).toBeInTheDocument()
      expect(screen.queryByText('1 compétence ajoutée. Pense à enregistrer.')).not.toBeInTheDocument()
    })

    it('deduplicates the skills typed by hand by skill name', async () => {
      const { saveOpportunityFilters } = renderForm()

      await userEvent.type(screen.getByLabelText('Tes technos, une par une'), 'React{Enter}ReactJS{Enter}Next.js{Enter}')
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))

      expect(saveOpportunityFilters).toHaveBeenCalledWith(expect.objectContaining({ mySkills: ['React', 'Next.js'] }))
    })

    it('keeps the keyword deduplication for the keyword lists', async () => {
      const { saveOpportunityFilters } = renderForm()

      await userEvent.type(screen.getByLabelText('Doit contenir au moins un de'), 'react{Enter}reactjs{Enter}')
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))

      expect(saveOpportunityFilters).toHaveBeenCalledWith(
        expect.objectContaining({ includeKeywords: ['react', 'reactjs'] }),
      )
    })

    it('invites me to add a CV when my library has none', () => {
      renderForm([], EMPTY_OPPORTUNITY_FILTERS, { cvOptions: [] })

      expect(screen.getByRole('link', { name: 'Mes CV' })).toHaveAttribute('href', '/cv')
      expect(screen.queryByRole('button', { name: 'Extraire les compétences' })).not.toBeInTheDocument()
    })

    it('asks for a Claude key when I have none', () => {
      renderForm([], EMPTY_OPPORTUNITY_FILTERS, { hasAnthropicApiKey: false })

      expect(screen.getByRole('note')).toHaveTextContent('Ajoute ta clé Claude dans tes préférences')
      expect(screen.queryByRole('button', { name: 'Extraire les compétences' })).not.toBeInTheDocument()
    })
  })
})
