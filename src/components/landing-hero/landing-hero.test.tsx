import { render, screen } from '@testing-library/react'
import { LandingHero } from './landing-hero'

describe('LandingHero', () => {
  it('opens the page with the couch headline', () => {
    render(<LandingHero signUpUrl="https://app.aled.work/inscription" />)

    const pageTitle = screen.getByRole('heading', { level: 1 })
    expect(pageTitle).toHaveTextContent('Trouver du boulot')
    expect(pageTitle).toHaveTextContent('depuis ton canapé.')
  })

  it('sends the call to action to the sign up page', () => {
    render(<LandingHero signUpUrl="https://app.aled.work/inscription" />)

    expect(screen.getByRole('link', { name: 'Je reste sur mon canapé' })).toHaveAttribute(
      'href',
      'https://app.aled.work/inscription',
    )
  })
})
