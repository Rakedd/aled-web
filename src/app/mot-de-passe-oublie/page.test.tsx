import { render, screen } from '@testing-library/react'
import ForgotPasswordPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({ requestPasswordReset: jest.fn() }))

describe('ForgotPasswordPage', () => {
  it('shows the title, the logo and the form', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('heading', { name: 'Mot de passe oublié' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recevoir un lien' })).toBeInTheDocument()
  })
})
