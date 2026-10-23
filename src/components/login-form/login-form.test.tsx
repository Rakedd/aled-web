import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './login-form'

const routerReplace = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerReplace }) }))

const fillAndSubmitCredentials = async () => {
  await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'moi@example.com')
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

beforeEach(() => {
  routerReplace.mockClear()
})

describe('LoginForm', () => {
  it('offers email and password fields, and the sign-in button', () => {
    render(<LoginForm signInWithPassword={jest.fn()} />)

    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('links to the forgot-password and sign-up pages', () => {
    render(<LoginForm signInWithPassword={jest.fn()} />)

    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/mot-de-passe-oublie')
    expect(screen.getByText('Pas encore de compte ?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription')
  })

  it('shows the pending label while signing in', async () => {
    render(<LoginForm signInWithPassword={jest.fn(() => new Promise<never>(() => undefined))} />)

    await fillAndSubmitCredentials()

    expect(screen.getByRole('button', { name: 'Connexion en cours…' })).toBeDisabled()
  })

  it('goes to the home page once signed in', async () => {
    render(<LoginForm signInWithPassword={jest.fn().mockResolvedValue({ ok: true, data: null })} />)

    await fillAndSubmitCredentials()

    expect(routerReplace).toHaveBeenCalledWith('/')
  })

  it('announces the failure on both fields when the credentials are rejected', async () => {
    render(
      <LoginForm
        signInWithPassword={jest.fn().mockResolvedValue({ ok: false, errorMessage: 'E-mail ou mot de passe incorrect.' })}
      />,
    )

    await fillAndSubmitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.')
    for (const field of [screen.getByLabelText('Adresse e-mail'), screen.getByLabelText('Mot de passe')]) {
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription('E-mail ou mot de passe incorrect.')
    }
    expect(routerReplace).not.toHaveBeenCalled()
  })
})
