import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'
import type { StartOAuthSignIn } from './interfaces'

const renderOAuthController = (startOAuthSignIn: StartOAuthSignIn) =>
  renderHook(() => useController({ startOAuthSignIn })).result

describe('oauth-sign-in-buttons useController', () => {
  it('starts with no pending provider and no error message', () => {
    const result = renderOAuthController(jest.fn())

    expect(result.current.pendingProvider).toBeNull()
    expect(result.current.errorMessage).toBeNull()
  })

  it('starts the sign-in with the chosen provider and stays pending while the browser leaves', async () => {
    const startOAuthSignIn = jest.fn().mockResolvedValue({ ok: true, data: null })
    const result = renderOAuthController(startOAuthSignIn)

    await act(() => result.current.signIn('google'))

    expect(startOAuthSignIn).toHaveBeenCalledWith('google')
    expect(result.current.pendingProvider).toBe('google')
    expect(result.current.errorMessage).toBeNull()
  })

  it('relays the failure message and frees the buttons when the action fails', async () => {
    const result = renderOAuthController(
      jest.fn().mockResolvedValue({ ok: false, errorMessage: "La connexion avec ce compte n'a pas abouti." }),
    )

    await act(() => result.current.signIn('linkedin_oidc'))

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
    const startOAuthSignIn = jest.fn(() => new Promise<ActionResult<null>>(() => undefined))
    const result = renderOAuthController(startOAuthSignIn)

    act(() => {
      void result.current.signIn('google')
      void result.current.signIn('google')
      void result.current.signIn('linkedin_oidc')
    })

    expect(startOAuthSignIn).toHaveBeenCalledTimes(1)
    expect(result.current.pendingProvider).toBe('google')
  })
})
