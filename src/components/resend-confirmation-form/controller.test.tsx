import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'
import type { ResendSignUpConfirmation } from './interfaces'

const renderResendController = (resendSignUpConfirmation: ResendSignUpConfirmation) =>
  renderHook(() => useController({ resendSignUpConfirmation })).result

describe('resend-confirmation-form useController', () => {
  it('starts idle with an empty email and no error', () => {
    const result = renderResendController(jest.fn())

    expect(result.current.email).toBe('')
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeNull()
  })

  it('sends the trimmed email and switches to sent on success', async () => {
    const resendSignUpConfirmation = jest.fn().mockResolvedValue({ ok: true, data: null })
    const result = renderResendController(resendSignUpConfirmation)

    act(() => result.current.setEmail('  camille@example.com '))
    await act(() => result.current.submit())

    expect(resendSignUpConfirmation).toHaveBeenCalledWith('camille@example.com')
    expect(result.current.status).toBe('sent')
  })

  it('relays the failure message and lets the user try again', async () => {
    const resendSignUpConfirmation = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorMessage: 'Trop de tentatives, réessaie dans quelques minutes.' })
      .mockResolvedValueOnce({ ok: true, data: null })
    const result = renderResendController(resendSignUpConfirmation)

    act(() => result.current.setEmail('camille@example.com'))
    await act(() => result.current.submit())
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Trop de tentatives, réessaie dans quelques minutes.')

    await act(() => result.current.submit())
    expect(result.current.status).toBe('sent')
    expect(result.current.errorMessage).toBeNull()
  })

  it('shows the generic error when the action throws', async () => {
    const result = renderResendController(jest.fn().mockRejectedValue(new Error('Network down')))

    act(() => result.current.setEmail('camille@example.com'))
    await act(() => result.current.submit())

    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('ignores a second submission while the first one is pending', () => {
    const resendSignUpConfirmation = jest.fn(() => new Promise<ActionResult<null>>(() => undefined))
    const result = renderResendController(resendSignUpConfirmation)

    act(() => result.current.setEmail('camille@example.com'))
    act(() => {
      void result.current.submit()
      void result.current.submit()
    })

    expect(resendSignUpConfirmation).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('submitting')
  })
})
