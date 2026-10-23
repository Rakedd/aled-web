import { render, screen } from '@testing-library/react'
import { LandingFooter } from './landing-footer'

describe('LandingFooter', () => {
  it('links the legal pages', () => {
    render(<LandingFooter legalNoticeHref="/vitrine/mentions-legales" privacyPolicyHref="/vitrine/confidentialite" termsOfUseHref="/vitrine/conditions-utilisation" />)

    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/vitrine/mentions-legales')
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/vitrine/confidentialite')
    expect(screen.getByRole('link', { name: "Conditions d'utilisation" })).toHaveAttribute(
      'href',
      '/vitrine/conditions-utilisation',
    )
  })

  it('signs the page', () => {
    render(<LandingFooter legalNoticeHref="/mentions-legales" privacyPolicyHref="/confidentialite" termsOfUseHref="/conditions-utilisation" />)

    expect(screen.getByText('© Aled')).toBeInTheDocument()
  })
})
