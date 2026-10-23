import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm } from './sign-up-form'

const TERMS_HREF = 'https://aled.work/conditions-utilisation'
const PRIVACY_HREF = 'https://aled.work/confidentialite'

const succeed = () => jest.fn().mockResolvedValue({ ok: true, data: null })

const renderForm = (signUpWithPassword = succeed(), resendSignUpConfirmation = succeed()) => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  render(
    <SignUpForm
      signUpWithPassword={signUpWithPassword}
      resendSignUpConfirmation={resendSignUpConfirmation}
      termsOfUseHref={TERMS_HREF}
      privacyPolicyHref={PRIVACY_HREF}
      oauthSignInButtons={<button type="button">Continuer avec Google</button>}
    />,
  )
  return user
}

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Prénom'), 'Camille')
  await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@example.com')
  await user.type(screen.getByLabelText('Mot de passe'), 'long-enough-password')
  await user.click(screen.getByRole('radio', { name: 'Freelance' }))
  await user.click(screen.getByRole('checkbox'))
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('SignUpForm', () => {
  it('renders the fields with their autocomplete hints', () => {
    renderForm()

    expect(screen.getByLabelText('Prénom')).toHaveAttribute('autocomplete', 'given-name')
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled()
  })

  it('groups the Freelance and CDI radios under the "Je suis" legend', () => {
    renderForm()

    const group = screen.getByRole('group', { name: 'Je suis' })
    expect(group).toContainElement(screen.getByRole('radio', { name: 'Freelance' }))
    expect(group).toContainElement(screen.getByRole('radio', { name: 'CDI' }))
  })

  it('labels the terms checkbox and opens both legal links in a new tab', () => {
    renderForm()

    expect(
      screen.getByRole('checkbox', {
        name: "J'accepte les conditions d'utilisation et la politique de confidentialité",
      }),
    ).not.toBeChecked()
    const termsLink = screen.getByRole('link', { name: "conditions d'utilisation" })
    const privacyLink = screen.getByRole('link', { name: 'politique de confidentialité' })
    expect(termsLink).toHaveAttribute('href', TERMS_HREF)
    expect(privacyLink).toHaveAttribute('href', PRIVACY_HREF)
    for (const legalLink of [termsLink, privacyLink]) {
      expect(legalLink).toHaveAttribute('target', '_blank')
      expect(legalLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })

  it('links to the login page', () => {
    renderForm()

    expect(screen.getByText('Déjà un compte ?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login')
  })

  it('shows and hides the password', async () => {
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('describes the password field with the minimum length hint', () => {
    renderForm()

    expect(screen.getByText('8 caractères minimum.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('8 caractères minimum.')
  })

  it('keeps the minimum length hint in the password description next to an error', async () => {
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('8 caractères minimum. Saisis ton prénom.')
  })

  it('announces a validation error and flags the fields as invalid', async () => {
    const signUpWithPassword = succeed()
    const user = renderForm(signUpWithPassword)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Saisis ton prénom.')
    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Prénom')).toHaveAccessibleDescription('Saisis ton prénom.')
    expect(signUpWithPassword).not.toHaveBeenCalled()
  })

  it('replaces the form with the inbox screen showing the address', async () => {
    const user = renderForm()
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText("Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.")).toBeInTheDocument()
    expect(screen.getByText('camille@example.com')).toBeInTheDocument()
    expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument()
  })

  it('shows the OAuth buttons with the form and hides them on the inbox screen', async () => {
    const user = renderForm()
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument()
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText(/Vérifie ta boîte mail/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuer avec Google' })).not.toBeInTheDocument()
  })

  it('disables the resend button with a countdown, then enables it and confirms the resend', async () => {
    const resendSignUpConfirmation = succeed()
    const user = renderForm(succeed(), resendSignUpConfirmation)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('button', { name: 'Renvoyer dans 60 s' })).toBeDisabled()

    act(() => jest.advanceTimersByTime(1000))
    expect(screen.getByRole('button', { name: 'Renvoyer dans 59 s' })).toBeDisabled()

    act(() => jest.advanceTimersByTime(59000))
    await user.click(screen.getByRole('button', { name: "Renvoyer l'e-mail" }))

    expect(resendSignUpConfirmation).toHaveBeenCalledWith('camille@example.com')
    expect(await screen.findByText('E-mail renvoyé.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renvoyer dans 60 s' })).toBeDisabled()
  })

  it('announces a resend failure', async () => {
    const user = renderForm(
      succeed(),
      jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' }),
    )
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    await screen.findByRole('button', { name: 'Renvoyer dans 60 s' })
    act(() => jest.advanceTimersByTime(60000))

    await user.click(screen.getByRole('button', { name: "Renvoyer l'e-mail" }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans quelques minutes.')
  })

  it('moves focus to the error alert after a validation error', async () => {
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('alert')).toHaveFocus()
  })

  it('moves focus to the error alert after a server error', async () => {
    const user = renderForm(jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Inscription impossible pour le moment.' }))
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Inscription impossible pour le moment.')
    expect(document.activeElement).toBe(alert)
  })

  it('moves focus to the inbox block once the account is created', async () => {
    const user = renderForm()
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    const inboxText = await screen.findByText("Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.")
    expect(document.activeElement).toBe(inboxText.parentElement)
  })

  it('keeps focus in the inbox block instead of a disabled button after a resend', async () => {
    const user = renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    const inboxBlock = (await screen.findByText("Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.")).parentElement
    act(() => jest.advanceTimersByTime(60000))

    await user.click(screen.getByRole('button', { name: "Renvoyer l'e-mail" }))

    await screen.findByText('E-mail renvoyé.')
    expect(document.activeElement).toBe(inboxBlock)
  })

  it('refocuses the alert when the same validation error happens twice in a row', async () => {
    const user = renderForm()
    const submitButton = screen.getByRole('button', { name: 'Créer mon compte' })

    await user.click(submitButton)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveFocus()

    await user.click(submitButton)

    expect(alert).toHaveTextContent('Saisis ton prénom.')
    expect(alert).toHaveFocus()
  })

  it('moves focus to the alert after a resend error', async () => {
    const user = renderForm(
      succeed(),
      jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' }),
    )
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    await screen.findByRole('button', { name: 'Renvoyer dans 60 s' })
    act(() => jest.advanceTimersByTime(60000))

    await user.click(screen.getByRole('button', { name: "Renvoyer l'e-mail" }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Trop de tentatives, réessaie dans quelques minutes.')
    expect(alert).toHaveFocus()
  })

  it('keeps focus on the inbox block, not on the disabled resend button, while a resend is running', async () => {
    const user = renderForm(succeed(), jest.fn(() => new Promise<never>(() => undefined)))
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    const inboxBlock = (await screen.findByText("Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.")).parentElement
    act(() => jest.advanceTimersByTime(60000))
    const resendButton = screen.getByRole('button', { name: "Renvoyer l'e-mail" })

    await user.click(resendButton)

    expect(resendButton).toBeDisabled()
    expect(document.activeElement).toBe(inboxBlock)
    expect(document.activeElement).not.toBe(resendButton)
  })
})
