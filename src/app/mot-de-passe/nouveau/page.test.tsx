import { render, screen } from '@testing-library/react'
import NewPasswordPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({ updatePassword: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('NewPasswordPage', () => {
  it('shows the title, the logo and the form', () => {
    render(<NewPasswordPage />)

    expect(screen.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
  })
})
