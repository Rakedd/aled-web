import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'
import type { NavigateToUrl, StartOAuthSignIn } from './interfaces'

const PROVIDER_URL = 'https://accounts.google.com/o/oauth2/auth?state=abc'

const renderOAuthController = (startOAuthSignIn: StartOAuthSignIn, navigateToUrl: NavigateToUrl = jest.fn()) =>
  renderHook(() => useController({ startOAuthSignIn, navigateToUrl })).result

describe('oauth-sign-in-buttons useController', () => {
  it('starts with no pending provider and no error message', () => {
    const result = renderOAuthController(jest.fn())

    expect(result.current.pendingProvider).toBeNull()
    expect(result.current.errorMessage).toBeNull()
  })

  it('opens the provider URL, shows no error and stays pending while the browser leaves', async () => {
    const startOAuthSignIn = jest.fn().mockResolvedValue({ ok: true, data: { url: PROVIDER_URL } })
    const navigateToUrl = jest.fn()
    const result = renderOAuthController(startOAuthSignIn, navigateToUrl)

    await act(() => result.current.signIn('google'))

    expect(startOAuthSignIn).toHaveBeenCalledWith('google')
    expect(navigateToUrl).toHaveBeenCalledWith(PROVIDER_URL)
    expect(result.current.pendingProvider).toBe('google')
    expect(result.current.errorMessage).toBeNull()
  })

  it('relays the failure message, frees the buttons and does not navigate when the action fails', async () => {
    const navigateToUrl = jest.fn()
    const result = renderOAuthController(
      jest.fn().mockResolvedValue({ ok: false, errorMessage: "La connexion avec ce compte n'a pas abouti." }),
      navigateToUrl,
    )

    await act(() => result.current.signIn('linkedin_oidc'))

    expect(navigateToUrl).not.toHaveBeenCalled()
    expect(result.current.pendingProvider).toBeNull()
    expect(result.current.errorMessage).toBe("La connexion avec ce compte n'a pas abouti.")
  })

  it('shows the generic error when the action throws', async () => {
    const result = renderOAuthController(jest.fn().mockRejectedValue(new Error('Network down')))

    await act(() => result.current.signIn('google'))

    expect(result.current.pendingProvider).toBeNull()
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('ignores any further click while a sign-in is pending', async () => {
    const startOAuthSignIn = jest.fn(() => new Promise<ActionResult<{ url: string }>>(() => undefined))
    const result = renderOAuthController(startOAuthSignIn)

    act(() => {
      void result.current.signIn('google')
      void result.current.signIn('google')
      void result.current.signIn('linkedin_oidc')
    })

    expect(startOAuthSignIn).toHaveBeenCalledTimes(1)
    expect(result.current.pendingProvider).toBe('google')
  })

  it('ignores any further click once the browser is leaving for the provider', async () => {
    const startOAuthSignIn = jest.fn().mockResolvedValue({ ok: true, data: { url: PROVIDER_URL } })
    const result = renderOAuthController(startOAuthSignIn)

    await act(() => result.current.signIn('google'))
    await act(() => result.current.signIn('linkedin_oidc'))

    expect(startOAuthSignIn).toHaveBeenCalledTimes(1)
  })
})
