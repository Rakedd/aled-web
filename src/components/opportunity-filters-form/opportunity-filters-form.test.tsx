import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import { OpportunityFiltersForm } from './opportunity-filters-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderForm = (knownRegions: string[] = [], initialFilters = EMPTY_OPPORTUNITY_FILTERS) => {
  const saveOpportunityFilters = jest.fn().mockResolvedValue({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
  render(
    <OpportunityFiltersForm
      source="free-work"
      initialFilters={initialFilters}
      knownRegions={knownRegions}
      saveOpportunityFilters={saveOpportunityFilters}
    />,
  )
  return { saveOpportunityFilters }
}

describe('OpportunityFiltersForm', () => {
  it('keeps a typed but unconfirmed keyword when the user clicks Enregistrer les filtres', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Doit contenir au moins un de'), 'react')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      'free-work',
      expect.objectContaining({ includeKeywords: ['react'] }),
    )
  })

  it('submits with Enter from a rate floor', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Hybride'), '500{Enter}')
    expect(saveOpportunityFilters).toHaveBeenCalledWith('free-work', expect.objectContaining({ rateFloorHybrid: 500 }))
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
    expect(saveOpportunityFilters).toHaveBeenCalledWith('free-work', expect.objectContaining({ regions: ['Bretagne'] }))
  })

  it('shows the amount error under the field with aria-invalid and aria-describedby', async () => {
    renderForm()
    const onsiteInput = screen.getByLabelText('Sur site')
    await userEvent.type(onsiteInput, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les filtres' }))
    expect(onsiteInput).toHaveAttribute('aria-invalid', 'true')
    expect(onsiteInput).toHaveAccessibleDescription('Montant invalide')
  })
})
