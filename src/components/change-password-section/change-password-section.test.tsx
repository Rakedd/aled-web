import { render, screen } from '@testing-library/react'
import { ChangePasswordSection } from './change-password-section'

describe('ChangePasswordSection', () => {
  it('titles the section "Mot de passe" and links to the new password page', () => {
    render(<ChangePasswordSection />)

    expect(screen.getByRole('region', { name: 'Mot de passe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Changer mon mot de passe' })).toHaveAttribute(
      'href',
      '/mot-de-passe/nouveau',
    )
  })
})
