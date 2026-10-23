import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResendConfirmationForm } from './resend-confirmation-form'

const CHECK_INBOX_MESSAGE = "Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte."

const succeed = () => jest.fn().mockResolvedValue({ ok: true, data: null })

const renderForm = (resendSignUpConfirmation = succeed()) => {
  const user = userEvent.setup()
  render(<ResendConfirmationForm resendSignUpConfirmation={resendSignUpConfirmation} />)
  return user
}

describe('ResendConfirmationForm', () => {
  it('renders the email field, the submit button and the link back to the login', () => {
    renderForm()

    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByRole('button', { name: 'Recevoir un lien' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login')
  })

  it('sends the trimmed email and answers with the same neutral message as the sign-up', async () => {
    const resendSignUpConfirmation = succeed()
    const user = renderForm(resendSignUpConfirmation)

    await user.type(screen.getByLabelText('Adresse e-mail'), ' camille@example.com ')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    expect(resendSignUpConfirmation).toHaveBeenCalledWith('camille@example.com')
    expect(screen.getByRole('status')).toHaveTextContent(CHECK_INBOX_MESSAGE)
    expect(screen.queryByLabelText('Adresse e-mail')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toBeInTheDocument()
  })

  it('moves focus to the confirmation block after the send', async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    expect(screen.getByRole('status').parentElement).toHaveFocus()
  })

  it('shows the action error in an alert, focuses it and keeps the form', async () => {
    const user = renderForm(jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Adresse e-mail invalide' }))

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Adresse e-mail invalide')
    expect(alert).toHaveFocus()
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAccessibleDescription('Adresse e-mail invalide')
  })

  it('shows the generic error when the action throws', async () => {
    const user = renderForm(jest.fn().mockRejectedValue(new Error('network')))

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue, réessaie.')
  })

  it('shows the pending label and sends only one request on a double submit', async () => {
    let resolveRequest: (value: { ok: true; data: null }) => void = () => undefined
    const resendSignUpConfirmation = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const user = renderForm(resendSignUpConfirmation)

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.type(screen.getByLabelText('Adresse e-mail'), '{Enter}{Enter}')
    expect(screen.getByRole('button', { name: 'Envoi en cours…' })).toBeDisabled()
    await act(async () => resolveRequest({ ok: true, data: null }))

    expect(resendSignUpConfirmation).toHaveBeenCalledTimes(1)
  })
})
