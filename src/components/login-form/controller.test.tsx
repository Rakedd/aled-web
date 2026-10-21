import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'
import type { SignInWithPassword } from './interfaces'

const renderLoginFormController = (signInWithPassword: SignInWithPassword) => {
  const onSignedIn = jest.fn()
  const { result } = renderHook(() => useController({ signInWithPassword, onSignedIn }))
  return { result, onSignedIn }
}

const fillCredentials = (
  result: ReturnType<typeof renderLoginFormController>['result'],
  email: string,
  password: string,
) => {
  act(() => result.current.setEmail(email))
  act(() => result.current.setPassword(password))
}

describe('login-form useController', () => {
  it('starts idle with empty credentials and no error message', () => {
    const { result } = renderLoginFormController(jest.fn())

    expect(result.current.email).toBe('')
    expect(result.current.password).toBe('')
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeNull()
  })

  it('does not call signInWithPassword for an invalid email and shows an error message', async () => {
    const signInWithPassword = jest.fn()
    const { result } = renderLoginFormController(signInWithPassword)

    fillCredentials(result, 'not-an-email', 'secret')
    await act(() => result.current.submit())

    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Adresse e-mail invalide')
  })

  it('does not call signInWithPassword without a password and asks for it', async () => {
    const signInWithPassword = jest.fn()
    const { result } = renderLoginFormController(signInWithPassword)

    fillCredentials(result, 'freelance@example.com', '')
    await act(() => result.current.submit())

    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Saisis ton mot de passe.')
  })

  it('sends the trimmed email with the untouched password and hands over to onSignedIn on success', async () => {
    const signInWithPassword = jest.fn().mockResolvedValue({ ok: true, data: null })
    const { result, onSignedIn } = renderLoginFormController(signInWithPassword)

    fillCredentials(result, '  freelance@example.com ', ' secret ')
    await act(() => result.current.submit())

    expect(signInWithPassword).toHaveBeenCalledWith('freelance@example.com', ' secret ')
    expect(onSignedIn).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('signing-in')
    expect(result.current.errorMessage).toBeNull()
  })

  it('switches to error and relays the message when the action fails', async () => {
    const signInWithPassword = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'E-mail ou mot de passe incorrect.' })
    const { result, onSignedIn } = renderLoginFormController(signInWithPassword)

    fillCredentials(result, 'freelance@example.com', 'wrong')
    await act(() => result.current.submit())

    expect(onSignedIn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('E-mail ou mot de passe incorrect.')
  })

  it('leaves the signing-in state and shows the generic error when the action throws', async () => {
    const { result } = renderLoginFormController(jest.fn().mockRejectedValue(new Error('Network down')))

    fillCredentials(result, 'freelance@example.com', 'secret')
    await act(() => result.current.submit())

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('is signing in while the action is pending and ignores a second submission', async () => {
    let resolveSignIn: (actionResult: ActionResult<null>) => void = () => undefined
    const signInWithPassword = jest.fn(
      () =>
        new Promise<ActionResult<null>>((resolve) => {
          resolveSignIn = resolve
        }),
    )
    const { result, onSignedIn } = renderLoginFormController(signInWithPassword)

    fillCredentials(result, 'freelance@example.com', 'secret')
    let pendingSubmission: Promise<void> = Promise.resolve()
    act(() => {
      pendingSubmission = result.current.submit()
    })

    expect(result.current.status).toBe('signing-in')

    await act(() => result.current.submit())
    expect(signInWithPassword).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSignIn({ ok: true, data: null })
      await pendingSubmission
    })

    expect(onSignedIn).toHaveBeenCalledTimes(1)
  })
})
