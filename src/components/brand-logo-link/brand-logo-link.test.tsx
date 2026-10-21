import { render, screen } from '@testing-library/react'
import { BrandLogoLink } from './brand-logo-link'

describe('BrandLogoLink', () => {
  it('names the logo link Aled and points it to the given home', () => {
    render(<BrandLogoLink href="/vitrine" />)

    expect(screen.getByRole('link', { name: 'Aled' })).toHaveAttribute('href', '/vitrine')
  })
})
