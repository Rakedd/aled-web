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

  it('draws the link as a bordered outline button', () => {
    render(<ChangePasswordSection />)
    const linkClassNames = screen.getByRole('link', { name: 'Changer mon mot de passe' }).className.split(' ')
    expect(linkClassNames).toEqual(expect.arrayContaining(['border-input', 'bg-card']))
    expect(linkClassNames).not.toContain('border-transparent')
  })
})
