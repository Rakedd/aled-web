import { render, screen } from '@testing-library/react'
import { LandingPainSection } from './landing-pain-section'

describe('LandingPainSection', () => {
  it('names the pain of the scattered inbox', () => {
    render(<LandingPainSection />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('0 idée')
  })

  it('hides the decorative pile of emails from screen readers', () => {
    render(<LandingPainSection />)

    expect(screen.getByText('Re: Re: Fwd:').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
