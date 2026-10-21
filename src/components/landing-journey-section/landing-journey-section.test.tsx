import { render, screen } from '@testing-library/react'
import { LandingJourneySection } from './landing-journey-section'

describe('LandingJourneySection', () => {
  it('lists the seven steps of the journey', () => {
    render(<LandingJourneySection />)

    expect(screen.getAllByRole('listitem')).toHaveLength(7)
  })

  it('presents the contract review like every other step', () => {
    render(<LandingJourneySection />)

    expect(screen.getByText('Relire le contrat')).toBeInTheDocument()
    expect(screen.queryByText(/bientôt/i)).not.toBeInTheDocument()
  })
})
