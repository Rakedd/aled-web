import { render, screen } from '@testing-library/react'
import { LandingClosingSection } from './landing-closing-section'

describe('LandingClosingSection', () => {
  it('shows the Aled logo', () => {
    render(<LandingClosingSection signUpUrl="https://app.aled.work/inscription" />)

    expect(screen.getByRole('img', { name: 'Aled' })).toBeInTheDocument()
  })

  it('paints the call to action in peach so it stands out from the brand green in both themes', () => {
    render(<LandingClosingSection signUpUrl="https://app.aled.work/inscription" />)

    const callToAction = screen.getByRole('link', { name: 'Aled, sauve-moi' })
    expect(callToAction).toHaveClass('bg-peach', 'text-on-peach')
    expect(callToAction).not.toHaveClass('bg-primary')
    expect(callToAction).not.toHaveClass('text-primary-foreground')
  })

  it('outlines the focused call to action in a colour that contrasts with the brand green', () => {
    render(<LandingClosingSection signUpUrl="https://app.aled.work/inscription" />)

    expect(screen.getByRole('link', { name: 'Aled, sauve-moi' })).toHaveClass(
      'focus-visible:ring-on-brand-tile',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-brand-tile',
    )
  })

  it('sends the cry for help to the sign up page', () => {
    render(<LandingClosingSection signUpUrl="https://app.aled.work/inscription" />)

    expect(screen.getByRole('link', { name: 'Aled, sauve-moi' })).toHaveAttribute(
      'href',
      'https://app.aled.work/inscription',
    )
  })
})
