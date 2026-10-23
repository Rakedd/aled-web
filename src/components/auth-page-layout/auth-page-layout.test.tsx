import { render, screen } from '@testing-library/react'
import { AuthPageLayout } from './auth-page-layout'

describe('AuthPageLayout', () => {
  it('shows the brand panel with the logo and the tagline', () => {
    render(
      <AuthPageLayout title="Connexion">
        <p>Contenu</p>
      </AuthPageLayout>,
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aled' })).toHaveAttribute('src', expect.stringContaining('aled-logo-on-dark.png'))
    expect(screen.getByRole('heading', { level: 1, name: 'Trouver du travail sans traverser la rue.' })).toBeInTheDocument()
  })

  it('shows the card title and its content', () => {
    render(
      <AuthPageLayout title="Mot de passe oublié">
        <p>Contenu de la carte</p>
      </AuthPageLayout>,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Mot de passe oublié' })).toBeInTheDocument()
    expect(screen.getByText('Contenu de la carte')).toBeInTheDocument()
  })
})
