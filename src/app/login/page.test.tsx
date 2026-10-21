import { render, screen } from '@testing-library/react'
import LoginPage from './page'

jest.mock('@/server/actions/auth-actions', () => ({ requestMagicLink: jest.fn() }))

const renderLoginPage = async (searchParameters: { error?: string }) =>
  render(await LoginPage({ searchParams: Promise.resolve(searchParameters) } as PageProps<'/login'>))

describe('LoginPage', () => {
  it('shows the Aled logo on the brand panel', async () => {
    await renderLoginPage({})

    expect(screen.getByRole('img', { name: 'Aled' })).toHaveAttribute('src', expect.stringContaining('aled-logo-on-dark.png'))
  })

  it('explains an invalid magic link', async () => {
    await renderLoginPage({ error: 'invalid-link' })

    expect(screen.getByRole('alert')).toHaveTextContent('Ce lien de connexion est invalide ou a expiré.')
  })

  it('shows no error without an error parameter', async () => {
    await renderLoginPage({})

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
