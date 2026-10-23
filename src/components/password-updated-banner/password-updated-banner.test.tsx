import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PasswordUpdatedBanner } from './password-updated-banner'

describe('PasswordUpdatedBanner', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mot-de-passe=modifie')
  })

  it('fills the status region with the update message once it is in place', async () => {
    render(<PasswordUpdatedBanner isPasswordUpdated />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(await screen.findByText('Mot de passe modifié.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.')
  })

  it('removes the flag from the address so a reload does not show it again', () => {
    render(<PasswordUpdatedBanner isPasswordUpdated />)

    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })

  it('keeps an empty status region mounted when the password was not updated', () => {
    render(<PasswordUpdatedBanner isPasswordUpdated={false} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(window.location.search).toBe('?mot-de-passe=modifie')
  })

  it('renders the status region empty first so the message lands in a live region already in place', () => {
    expect(renderToStaticMarkup(<PasswordUpdatedBanner isPasswordUpdated />)).toBe('<div role="status"></div>')
  })
})
