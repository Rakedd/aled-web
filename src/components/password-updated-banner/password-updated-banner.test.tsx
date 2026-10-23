import { render, screen } from '@testing-library/react'
import { PasswordUpdatedBanner } from './password-updated-banner'

describe('PasswordUpdatedBanner', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mot-de-passe=modifie')
  })

  it('announces the update in a status', () => {
    render(<PasswordUpdatedBanner />)

    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.')
  })

  it('removes the flag from the address so a reload does not show it again', () => {
    render(<PasswordUpdatedBanner />)

    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })
})
