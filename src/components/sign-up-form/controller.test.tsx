import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { RESEND_COOLDOWN_SECONDS } from '@/domain/sign-up'
import { useController } from './controller'
import type { ResendSignUpConfirmation, SignUpWithPassword } from './interfaces'

const succeed = () => jest.fn().mockResolvedValue({ ok: true, data: null })

const renderSignUpController = (
  signUpWithPassword: SignUpWithPassword = succeed(),
  resendSignUpConfirmation: ResendSignUpConfirmation = succeed(),
) => renderHook(() => useController({ signUpWithPassword, resendSignUpConfirmation })).result

type Controller = ReturnType<typeof renderSignUpController>

const fillValidSignUp = (result: Controller) => {
  act(() => result.current.setFirstName('  Camille '))
  act(() => result.current.setEmail(' camille@example.com '))
  act(() => result.current.setPassword('long-enough-password'))
  act(() => result.current.setProfessionalStatus('freelance'))
  act(() => result.current.setHasAcceptedTerms(true))
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('sign-up-form useController', () => {
  it('starts idle, empty, with the password hidden and no status chosen', () => {
    const result = renderSignUpController()

    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.firstName).toBe('')
    expect(result.current.professionalStatus).toBeNull()
    expect(result.current.hasAcceptedTerms).toBe(false)
    expect(result.current.isPasswordVisible).toBe(false)
  })

  it('toggles the password visibility', () => {
    const result = renderSignUpController()

    act(() => result.current.togglePasswordVisibility())
    expect(result.current.isPasswordVisible).toBe(true)
    act(() => result.current.togglePasswordVisibility())
    expect(result.current.isPasswordVisible).toBe(false)
  })

  it('does not call the action without a first name', async () => {
    const signUpWithPassword = succeed()
    const result = renderSignUpController(signUpWithPassword)

    await act(() => result.current.submit())

    expect(signUpWithPassword).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Saisis ton prénom.')
  })

  it('rejects an invalid email, a short password, a missing status and unaccepted terms in turn', async () => {
    const signUpWithPassword = succeed()
    const result = renderSignUpController(signUpWithPassword)
    fillValidSignUp(result)

    act(() => result.current.setEmail('not-an-email'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Adresse e-mail invalide')

    act(() => result.current.setEmail('camille@example.com'))
    act(() => result.current.setPassword('short'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Ton mot de passe doit faire au moins 8 caractères.')

    act(() => result.current.setPassword('long-enough-password'))
    act(() => result.current.setHasAcceptedTerms(false))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe(
      "Accepte les conditions d'utilisation et la politique de confidentialité pour continuer.",
    )

    expect(signUpWithPassword).not.toHaveBeenCalled()
  })

  it('sends the trimmed values and moves to the inbox screen on success', async () => {
    const signUpWithPassword = succeed()
    const result = renderSignUpController(signUpWithPassword)
    fillValidSignUp(result)

    await act(() => result.current.submit())

    expect(signUpWithPassword).toHaveBeenCalledWith({
      firstName: 'Camille',
      email: 'camille@example.com',
      password: 'long-enough-password',
      professionalStatus: 'freelance',
      hasAcceptedTerms: true,
    })
    expect(result.current.status).toBe('sent')
    expect(result.current.submittedEmail).toBe('camille@example.com')
    expect(result.current.password).toBe('')
    expect(result.current.secondsBeforeResend).toBe(RESEND_COOLDOWN_SECONDS)
  })

  it('relays the message of a failed sign-up and lets the user retry', async () => {
    const signUpWithPassword = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorMessage: 'Ce mot de passe est trop facile à deviner.' })
      .mockResolvedValueOnce({ ok: true, data: null })
    const result = renderSignUpController(signUpWithPassword)
    fillValidSignUp(result)

    await act(() => result.current.submit())
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Ce mot de passe est trop facile à deviner.')

    await act(() => result.current.submit())
    expect(result.current.status).toBe('sent')
    expect(result.current.errorMessage).toBeNull()
  })

  it('shows the generic error when the action throws', async () => {
    const result = renderSignUpController(jest.fn().mockRejectedValue(new Error('Network down')))
    fillValidSignUp(result)

    await act(() => result.current.submit())

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('sends only one request when the submission is triggered twice in a row', async () => {
    const signUpWithPassword = jest.fn(() => new Promise<ActionResult<null>>(() => undefined))
    const result = renderSignUpController(signUpWithPassword)
    fillValidSignUp(result)

    act(() => {
      void result.current.submit()
      void result.current.submit()
    })

    expect(signUpWithPassword).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('submitting')
  })

  it('counts the resend cooldown down every second until the resend is allowed', async () => {
    const result = renderSignUpController()
    fillValidSignUp(result)
    await act(() => result.current.submit())

    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.secondsBeforeResend).toBe(RESEND_COOLDOWN_SECONDS - 1)

    act(() => jest.advanceTimersByTime((RESEND_COOLDOWN_SECONDS - 1) * 1000))
    expect(result.current.secondsBeforeResend).toBe(0)

    act(() => jest.advanceTimersByTime(5000))
    expect(result.current.secondsBeforeResend).toBe(0)
  })

  it('does not resend during the cooldown', async () => {
    const resendSignUpConfirmation = succeed()
    const result = renderSignUpController(succeed(), resendSignUpConfirmation)
    fillValidSignUp(result)
    await act(() => result.current.submit())

    await act(() => result.current.resend())

    expect(resendSignUpConfirmation).not.toHaveBeenCalled()
  })

  it('resends to the submitted email after the cooldown, confirms it and restarts the cooldown', async () => {
    const resendSignUpConfirmation = succeed()
    const result = renderSignUpController(succeed(), resendSignUpConfirmation)
    fillValidSignUp(result)
    await act(() => result.current.submit())
    act(() => jest.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000))

    await act(() => result.current.resend())

    expect(resendSignUpConfirmation).toHaveBeenCalledWith('camille@example.com')
    expect(result.current.hasResent).toBe(true)
    expect(result.current.secondsBeforeResend).toBe(RESEND_COOLDOWN_SECONDS)
  })

  it('sends a single resend request when the button is triggered twice in a row', async () => {
    const resendSignUpConfirmation = jest.fn(() => new Promise<ActionResult<null>>(() => undefined))
    const result = renderSignUpController(succeed(), resendSignUpConfirmation)
    fillValidSignUp(result)
    await act(() => result.current.submit())
    act(() => jest.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000))

    act(() => {
      void result.current.resend()
      void result.current.resend()
    })

    expect(resendSignUpConfirmation).toHaveBeenCalledTimes(1)
    expect(result.current.isResending).toBe(true)
  })

  it('relays a resend failure without restarting the cooldown', async () => {
    const result = renderSignUpController(
      succeed(),
      jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' }),
    )
    fillValidSignUp(result)
    await act(() => result.current.submit())
    act(() => jest.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000))

    await act(() => result.current.resend())

    expect(result.current.errorMessage).toBe('Trop de tentatives, réessaie dans quelques minutes.')
    expect(result.current.hasResent).toBe(false)
    expect(result.current.secondsBeforeResend).toBe(0)
    expect(result.current.isResending).toBe(false)
  })
})
