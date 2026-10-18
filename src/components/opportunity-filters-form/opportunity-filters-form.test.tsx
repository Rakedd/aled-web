import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import { OpportunityFiltersForm } from './opportunity-filters-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderForm = () => {
  const saveOpportunityFilters = jest.fn().mockResolvedValue({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
  render(
    <OpportunityFiltersForm
      source="free-work"
      initialFilters={EMPTY_OPPORTUNITY_FILTERS}
      knownRegions={[]}
      saveOpportunityFilters={saveOpportunityFilters}
    />,
  )
  return { saveOpportunityFilters }
}

describe('OpportunityFiltersForm', () => {
  it('keeps a typed but unconfirmed keyword when the user clicks Enregistrer', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Doit contenir au moins un de'), 'react')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      'free-work',
      expect.objectContaining({ includeKeywords: ['react'] }),
    )
  })

  it('keeps an unconfirmed region when the form is submitted with Enter from a rate floor', async () => {
    const { saveOpportunityFilters } = renderForm()
    await userEvent.type(screen.getByLabelText('Régions'), 'Paris')
    await userEvent.type(screen.getByLabelText('Hybride'), '500{Enter}')
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      'free-work',
      expect.objectContaining({ regions: ['Paris'], rateFloorHybrid: 500 }),
    )
  })

  it('shows the amount error under the field with aria-invalid and aria-describedby', async () => {
    renderForm()
    const onsiteInput = screen.getByLabelText('Sur site')
    await userEvent.type(onsiteInput, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onsiteInput).toHaveAttribute('aria-invalid', 'true')
    expect(onsiteInput).toHaveAccessibleDescription('Montant invalide')
  })
})
