import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'
import type { ResendSignUpConfirmation, SignInWithPassword } from './interfaces'

const UNCONFIRMED_ACCOUNT_MESSAGE = "Ton compte n'est pas encore activé."

const renderLoginFormController = (
  signInWithPassword: SignInWithPassword,
  resendSignUpConfirmation: ResendSignUpConfirmation = jest.fn(),
) => {
  const onSignedIn = jest.fn()
  const { result } = renderHook(() => useController({ signInWithPassword, resendSignUpConfirmation, onSignedIn }))
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

  describe('activation email resend', () => {
    const failWithUnconfirmedAccount = () =>
      jest.fn().mockResolvedValue({ ok: false, errorMessage: UNCONFIRMED_ACCOUNT_MESSAGE })

    const renderUnconfirmedAccount = async (resendSignUpConfirmation: ResendSignUpConfirmation) => {
      const rendered = renderLoginFormController(failWithUnconfirmedAccount(), resendSignUpConfirmation)
      fillCredentials(rendered.result, ' camille@example.com ', 'secret')
      await act(() => rendered.result.current.submit())
      return rendered
    }

    afterEach(() => {
      jest.useRealTimers()
    })

    it('does not offer the resend for any other sign-in failure', async () => {
      const { result } = renderLoginFormController(
        jest.fn().mockResolvedValue({ ok: false, errorMessage: 'E-mail ou mot de passe incorrect.' }),
      )

      fillCredentials(result, 'camille@example.com', 'wrong')
      await act(() => result.current.submit())

      expect(result.current.isActivationResendOffered).toBe(false)
    })

    it('offers the resend once the account is reported as not activated', async () => {
      const { result } = await renderUnconfirmedAccount(jest.fn())

      expect(result.current.isActivationResendOffered).toBe(true)
      expect(result.current.secondsBeforeActivationResend).toBe(0)
      expect(result.current.hasResentActivationEmail).toBe(false)
    })

    it('resends to the trimmed typed email, confirms neutrally and starts the 60 s cooldown', async () => {
      const resendSignUpConfirmation = jest.fn().mockResolvedValue({ ok: true, data: null })
      const { result } = await renderUnconfirmedAccount(resendSignUpConfirmation)

      await act(() => result.current.resendActivationEmail())

      expect(resendSignUpConfirmation).toHaveBeenCalledWith('camille@example.com')
      expect(result.current.hasResentActivationEmail).toBe(true)
      expect(result.current.activationResendErrorMessage).toBeNull()
      expect(result.current.secondsBeforeActivationResend).toBe(60)
    })

    it('counts the cooldown down and ignores a resend before it ends', async () => {
      jest.useFakeTimers()
      const resendSignUpConfirmation = jest.fn().mockResolvedValue({ ok: true, data: null })
      const { result } = await renderUnconfirmedAccount(resendSignUpConfirmation)

      await act(() => result.current.resendActivationEmail())
      act(() => jest.advanceTimersByTime(59_000))
      expect(result.current.secondsBeforeActivationResend).toBe(1)

      await act(() => result.current.resendActivationEmail())
      expect(resendSignUpConfirmation).toHaveBeenCalledTimes(1)

      act(() => jest.advanceTimersByTime(1_000))
      expect(result.current.secondsBeforeActivationResend).toBe(0)
      await act(() => result.current.resendActivationEmail())
      expect(resendSignUpConfirmation).toHaveBeenCalledTimes(2)
    })

    it('sends a single resend request on a double click', async () => {
      const resendSignUpConfirmation = jest.fn(() => new Promise<ActionResult<null>>(() => undefined))
      const { result } = await renderUnconfirmedAccount(resendSignUpConfirmation)

      act(() => {
        void result.current.resendActivationEmail()
        void result.current.resendActivationEmail()
      })

      expect(resendSignUpConfirmation).toHaveBeenCalledTimes(1)
      expect(result.current.isResendingActivationEmail).toBe(true)
    })

    it('relays the resend failure without starting the cooldown', async () => {
      const resendSignUpConfirmation = jest
        .fn()
        .mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' })
      const { result } = await renderUnconfirmedAccount(resendSignUpConfirmation)

      await act(() => result.current.resendActivationEmail())

      expect(result.current.activationResendErrorMessage).toBe('Trop de tentatives, réessaie dans quelques minutes.')
      expect(result.current.hasResentActivationEmail).toBe(false)
      expect(result.current.secondsBeforeActivationResend).toBe(0)
      expect(result.current.isResendingActivationEmail).toBe(false)
    })

    it('shows the generic error when the resend throws', async () => {
      const { result } = await renderUnconfirmedAccount(jest.fn().mockRejectedValue(new Error('Network down')))

      await act(() => result.current.resendActivationEmail())

      expect(result.current.activationResendErrorMessage).toBe('Une erreur est survenue, réessaie.')
    })

    it('withdraws the resend offer on the next sign-in attempt', async () => {
      const { result } = await renderUnconfirmedAccount(jest.fn().mockResolvedValue({ ok: true, data: null }))
      await act(() => result.current.resendActivationEmail())

      act(() => result.current.setEmail('other@example.com'))
      await act(() => result.current.submit())

      expect(result.current.hasResentActivationEmail).toBe(false)
      expect(result.current.activationResendErrorMessage).toBeNull()
    })
  })
})
