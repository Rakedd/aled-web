import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPasswordForm } from './forgot-password-form'

const PASSWORD_RESET_SENT_MESSAGE =
  'Si un compte existe pour cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe.'

const succeed = () => jest.fn().mockResolvedValue({ ok: true, data: null })

const renderForm = (requestPasswordReset = succeed()) => {
  const user = userEvent.setup()
  render(<ForgotPasswordForm requestPasswordReset={requestPasswordReset} />)
  return user
}

describe('ForgotPasswordForm', () => {
  it('renders the email field, the submit button and the link back to the login', () => {
    renderForm()

    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByRole('button', { name: 'Recevoir un lien' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login')
  })

  it('sends the trimmed email and shows the generic message in a status', async () => {
    const requestPasswordReset = succeed()
    const user = renderForm(requestPasswordReset)

    await user.type(screen.getByLabelText('Adresse e-mail'), ' camille@example.com ')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    expect(requestPasswordReset).toHaveBeenCalledWith('camille@example.com')
    expect(screen.getByRole('status')).toHaveTextContent(PASSWORD_RESET_SENT_MESSAGE)
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
    const requestPasswordReset = jest
      .fn()
      .mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' })
    const user = renderForm(requestPasswordReset)

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Trop de tentatives, réessaie dans quelques minutes.')
    expect(alert).toHaveFocus()
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAccessibleDescription(
      'Trop de tentatives, réessaie dans quelques minutes.',
    )
  })

  it('shows the generic error when the action throws', async () => {
    const user = renderForm(jest.fn().mockRejectedValue(new Error('network')))

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.click(screen.getByRole('button', { name: 'Recevoir un lien' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('sends only one request on a double submit', async () => {
    let resolveRequest: (value: { ok: true; data: null }) => void = () => undefined
    const requestPasswordReset = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const user = renderForm(requestPasswordReset)

    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
    await user.type(screen.getByLabelText('Adresse e-mail'), '{Enter}{Enter}')
    await act(async () => resolveRequest({ ok: true, data: null }))

    expect(requestPasswordReset).toHaveBeenCalledTimes(1)
  })
})
