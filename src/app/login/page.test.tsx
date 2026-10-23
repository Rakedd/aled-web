import { render, screen, within } from '@testing-library/react'
import LoginPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({ signInWithPassword: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }))

const renderLoginPage = async (searchParameters: { error?: string }) =>
  render(await LoginPage({ searchParams: Promise.resolve(searchParameters) } as PageProps<'/login'>))

describe('LoginPage', () => {
  it('shows the Aled logo on the brand panel', async () => {
    await renderLoginPage({})

    expect(screen.getByRole('img', { name: 'Aled' })).toHaveAttribute('src', expect.stringContaining('aled-logo-on-dark.png'))
  })

  it('explains an invalid email link neutrally and offers a new activation link or a password reset', async () => {
    await renderLoginPage({ error: 'invalid-link' })

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Ce lien est invalide ou a expiré.')).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: "Recevoir un nouveau lien d'activation" })).toHaveAttribute(
      'href',
      '/inscription/renvoyer',
    )
    expect(within(alert).getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    )
  })

  it('explains a failed Google or LinkedIn sign-in', async () => {
    await renderLoginPage({ error: 'oauth' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "La connexion avec ce compte n'a pas abouti. Réessaie ou utilise ton e-mail.",
    )
  })

  it.each(['toString', 'unknown'])('shows no error for the unknown error parameter %s', async (error) => {
    await renderLoginPage({ error })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no error without an error parameter', async () => {
    await renderLoginPage({})

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
