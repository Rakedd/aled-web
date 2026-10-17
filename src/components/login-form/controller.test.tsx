import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'

const renderLoginFormController = (requestMagicLinkResult: ActionResult<null>) => {
  const requestMagicLink = jest.fn().mockResolvedValue(requestMagicLinkResult)
  const { result } = renderHook(() => useController({ requestMagicLink }))
  return { result, requestMagicLink }
}

describe('login-form useController', () => {
  it('starts idle with an empty email and no error message', () => {
    const { result } = renderLoginFormController({ ok: true, data: null })

    expect(result.current.email).toBe('')
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeNull()
  })

  it('does not call requestMagicLink for an invalid email and shows an error message', async () => {
    const { result, requestMagicLink } = renderLoginFormController({ ok: true, data: null })

    act(() => result.current.setEmail('not-an-email'))
    await act(() => result.current.submit())

    expect(requestMagicLink).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Adresse e-mail invalide')
  })

  it('sends the trimmed email and switches to sent on success', async () => {
    const { result, requestMagicLink } = renderLoginFormController({ ok: true, data: null })

    act(() => result.current.setEmail('  freelance@example.com '))
    await act(() => result.current.submit())

    expect(requestMagicLink).toHaveBeenCalledWith('freelance@example.com')
    expect(result.current.status).toBe('sent')
    expect(result.current.errorMessage).toBeNull()
  })

  it('switches to error and relays the message when the action fails', async () => {
    const { result } = renderLoginFormController({ ok: false, errorMessage: 'Service indisponible' })

    act(() => result.current.setEmail('freelance@example.com'))
    await act(() => result.current.submit())

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Service indisponible')
  })

  it('leaves the sending state and shows the generic error when the action throws', async () => {
    const requestMagicLink = jest.fn().mockRejectedValue(new Error('Network down'))
    const { result } = renderHook(() => useController({ requestMagicLink }))

    act(() => result.current.setEmail('freelance@example.com'))
    await act(() => result.current.submit())

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
  })

  it('is sending while the action is pending', async () => {
    let resolveRequestMagicLink: (actionResult: ActionResult<null>) => void = () => undefined
    const requestMagicLink = jest.fn(
      () => new Promise<ActionResult<null>>((resolve) => {
        resolveRequestMagicLink = resolve
      }),
    )
    const { result } = renderHook(() => useController({ requestMagicLink }))

    act(() => result.current.setEmail('freelance@example.com'))
    let pendingSubmission: Promise<void> = Promise.resolve()
    act(() => {
      pendingSubmission = result.current.submit()
    })

    expect(result.current.status).toBe('sending')

    await act(async () => {
      resolveRequestMagicLink({ ok: true, data: null })
      await pendingSubmission
    })

    expect(result.current.status).toBe('sent')
  })
})
