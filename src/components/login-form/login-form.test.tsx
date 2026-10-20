import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './login-form'

const INVITATION_ONLY_MESSAGE = 'Accès sur invitation uniquement.'

describe('LoginForm', () => {
  it('offers the magic link button and the invitation-only reminder', () => {
    render(<LoginForm requestMagicLink={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Recevoir un lien de connexion' })).toBeInTheDocument()
    expect(screen.getByText(INVITATION_ONLY_MESSAGE)).toBeInTheDocument()
  })

  it('shows the sending label while the link is being requested', async () => {
    render(<LoginForm requestMagicLink={jest.fn(() => new Promise<never>(() => undefined))} />)

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'moi@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un lien de connexion' }))

    expect(screen.getByRole('button', { name: 'Envoi en cours…' })).toBeDisabled()
  })

  it('keeps the invitation-only reminder once the link is sent', async () => {
    render(<LoginForm requestMagicLink={jest.fn().mockResolvedValue({ ok: true, data: null })} />)

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'moi@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un lien de connexion' }))

    expect(await screen.findByRole('status')).toHaveTextContent("Si ce compte existe, un lien de connexion vient d'être envoyé.")
    expect(screen.getByText(INVITATION_ONLY_MESSAGE)).toBeInTheDocument()
  })

  it('announces the failure next to the email field when the link cannot be sent', async () => {
    render(<LoginForm requestMagicLink={jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Service indisponible' })} />)

    const emailInput = screen.getByLabelText('Adresse e-mail')
    await userEvent.type(emailInput, 'moi@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un lien de connexion' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Service indisponible')
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput).toHaveAccessibleDescription('Service indisponible')
  })
})
