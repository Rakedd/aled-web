import { render, screen } from '@testing-library/react'
import SignUpPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({
  resendSignUpConfirmation: jest.fn(),
  signUpWithPassword: jest.fn(),
  startOAuthSignIn: jest.fn(),
}))

describe('SignUpPage', () => {
  it('shows the title, the OAuth buttons and the sign-up form', () => {
    render(<SignUpPage />)

    expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuer avec LinkedIn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument()
  })
})
