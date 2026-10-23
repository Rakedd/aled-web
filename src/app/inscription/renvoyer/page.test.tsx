import { render, screen } from '@testing-library/react'
import ResendConfirmationPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({ resendSignUpConfirmation: jest.fn() }))

describe('ResendConfirmationPage', () => {
  it('shows the title, the logo and the resend form', () => {
    render(<ResendConfirmationPage />)

    expect(screen.getByRole('heading', { name: "Recevoir un nouveau lien d'activation" })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aled' })).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recevoir un lien' })).toBeInTheDocument()
  })
})
