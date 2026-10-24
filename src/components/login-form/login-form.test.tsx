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
  it('posts the credentials so they never land in the URL before hydration', () => {
    render(<LoginForm signInWithPassword={jest.fn()} resendSignUpConfirmation={jest.fn()} />)

    expect(screen.getByLabelText('Mot de passe').closest('form')).toHaveAttribute('method', 'post')
  })

  it('offers email and password fields, and the sign-in button', () => {
    render(<LoginForm signInWithPassword={jest.fn()} resendSignUpConfirmation={jest.fn()} />)

    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('links to the forgot-password and sign-up pages', () => {
    render(<LoginForm signInWithPassword={jest.fn()} resendSignUpConfirmation={jest.fn()} />)

    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/mot-de-passe-oublie')
    expect(screen.getByText('Pas encore de compte ?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription')
  })

  it('shows the pending label while signing in', async () => {
    render(
      <LoginForm
        signInWithPassword={jest.fn(() => new Promise<never>(() => undefined))}
        resendSignUpConfirmation={jest.fn()}
      />,
    )

    await fillAndSubmitCredentials()

    expect(screen.getByRole('button', { name: 'Connexion en cours…' })).toBeDisabled()
  })

  it('goes to the home page once signed in', async () => {
    render(
      <LoginForm
        signInWithPassword={jest.fn().mockResolvedValue({ ok: true, data: null })}
        resendSignUpConfirmation={jest.fn()}
      />,
    )

    await fillAndSubmitCredentials()

    expect(routerReplace).toHaveBeenCalledWith('/')
  })

  it('announces the failure on both fields when the credentials are rejected', async () => {
    render(
      <LoginForm
        signInWithPassword={jest.fn().mockResolvedValue({ ok: false, errorMessage: 'E-mail ou mot de passe incorrect.' })}
        resendSignUpConfirmation={jest.fn()}
      />,
    )

    await fillAndSubmitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.')
    for (const field of [screen.getByLabelText('Adresse e-mail'), screen.getByLabelText('Mot de passe')]) {
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription('E-mail ou mot de passe incorrect.')
    }
    expect(routerReplace).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: "Renvoyer l'e-mail d'activation" })).not.toBeInTheDocument()
  })

  it('offers to resend the activation email when the account is not activated yet', async () => {
    const resendSignUpConfirmation = jest.fn().mockResolvedValue({ ok: true, data: null })
    render(
      <LoginForm
        signInWithPassword={jest.fn().mockResolvedValue({ ok: false, errorMessage: "Ton compte n'est pas encore activé." })}
        resendSignUpConfirmation={resendSignUpConfirmation}
      />,
    )

    await fillAndSubmitCredentials()
    await userEvent.click(await screen.findByRole('button', { name: "Renvoyer l'e-mail d'activation" }))

    expect(resendSignUpConfirmation).toHaveBeenCalledWith('moi@example.com')
    expect(screen.getByRole('status')).toHaveTextContent(
      "Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.",
    )
    expect(screen.getByRole('button', { name: 'Renvoyer dans 60 s' })).toBeDisabled()
  })

  it('announces a failed activation email resend', async () => {
    render(
      <LoginForm
        signInWithPassword={jest.fn().mockResolvedValue({ ok: false, errorMessage: "Ton compte n'est pas encore activé." })}
        resendSignUpConfirmation={jest
          .fn()
          .mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' })}
      />,
    )

    await fillAndSubmitCredentials()
    await userEvent.click(await screen.findByRole('button', { name: "Renvoyer l'e-mail d'activation" }))

    expect(
      screen.getAllByRole('alert').some((alert) => alert.textContent === 'Trop de tentatives, réessaie dans quelques minutes.'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: "Renvoyer l'e-mail d'activation" })).toBeEnabled()
  })
})
