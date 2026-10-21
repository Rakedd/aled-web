import { render, screen } from '@testing-library/react'
import { LandingHeader } from './landing-header'

const renderHeader = () => render(<LandingHeader homeHref="/vitrine" signInUrl="https://app.aled.work/login" />)

describe('LandingHeader', () => {
  it('points the logo to the landing home', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'Aled' })).toHaveAttribute('href', '/vitrine')
  })

  it('sends returning users to the app login', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', 'https://app.aled.work/login')
  })

  it('lets the visitor choose the theme', () => {
    renderHeader()

    expect(screen.getByRole('button', { name: 'Thème' })).toBeInTheDocument()
  })
})
