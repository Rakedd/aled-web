import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OAuthSignInButtons } from './oauth-sign-in-buttons'

const TERMS_HREF = 'https://aled.work/conditions-utilisation'
const PRIVACY_HREF = 'https://aled.work/confidentialite'

const renderButtons = (startOAuthSignIn = jest.fn(), navigateToUrl = jest.fn()) =>
  render(
    <OAuthSignInButtons
      startOAuthSignIn={startOAuthSignIn}
      termsOfUseHref={TERMS_HREF}
      privacyPolicyHref={PRIVACY_HREF}
      navigateToUrl={navigateToUrl}
    />,
  )

describe('OAuthSignInButtons', () => {
  it('offers the Google and LinkedIn buttons', () => {
    renderButtons()

    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Continuer avec LinkedIn' })).toBeEnabled()
  })

  it('shows the terms notice with both legal links opening in a new tab', () => {
    renderButtons()

    expect(
      screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === "En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité."),
    ).toBeInTheDocument()
    const termsLink = screen.getByRole('link', { name: "conditions d'utilisation" })
    const privacyLink = screen.getByRole('link', { name: 'politique de confidentialité' })
    expect(termsLink).toHaveAttribute('href', TERMS_HREF)
    expect(privacyLink).toHaveAttribute('href', PRIVACY_HREF)
    for (const legalLink of [termsLink, privacyLink]) {
      expect(legalLink).toHaveAttribute('target', '_blank')
      expect(legalLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })

  it('shows "ou" as plain text between two decorative lines hidden from assistive technologies', () => {
    const { container } = renderButtons()

    expect(screen.getByText('ou')).toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    expect(container.querySelector('[role="separator"]')).toBeNull()
    const decorativeLines = container.querySelectorAll('span.h-px')
    expect(decorativeLines).toHaveLength(2)
    for (const decorativeLine of decorativeLines) expect(decorativeLine).toHaveAttribute('aria-hidden', 'true')
  })

  it('starts the sign-in with the provider of the clicked button and disables both buttons', async () => {
    const startOAuthSignIn = jest.fn(() => new Promise<never>(() => undefined))
    renderButtons(startOAuthSignIn)

    await userEvent.click(screen.getByRole('button', { name: 'Continuer avec LinkedIn' }))

    expect(startOAuthSignIn).toHaveBeenCalledWith('linkedin_oidc')
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continuer avec LinkedIn' })).toBeDisabled()
  })

  it('opens the provider page without any alert and keeps both buttons disabled on success', async () => {
    const providerUrl = 'https://accounts.google.com/o/oauth2/auth?state=abc'
    const navigateToUrl = jest.fn()
    renderButtons(jest.fn().mockResolvedValue({ ok: true, data: { url: providerUrl } }), navigateToUrl)

    await userEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }))

    expect(navigateToUrl).toHaveBeenCalledWith(providerUrl)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continuer avec LinkedIn' })).toBeDisabled()
  })

  it('announces the failure message', async () => {
    renderButtons(jest.fn().mockResolvedValue({ ok: false, errorMessage: "La connexion avec ce compte n'a pas abouti." }))

    await userEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("La connexion avec ce compte n'a pas abouti.")
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeEnabled()
  })
})
