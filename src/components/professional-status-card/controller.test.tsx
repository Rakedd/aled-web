import { act, renderHook } from '@testing-library/react'
import { useController } from './controller'
import type { SaveProfessionalStatus } from './interfaces'

const renderStatusCardController = (saveProfessionalStatus: SaveProfessionalStatus) => {
  const onAnswered = jest.fn()
  const { result } = renderHook(() => useController({ saveProfessionalStatus, onAnswered }))
  return { result, onAnswered }
}

describe('professional-status-card useController', () => {
  it('marks the card as answered and calls onAnswered once the choice is saved', async () => {
    const saveProfessionalStatus = jest.fn().mockResolvedValue({ ok: true, data: null })
    const { result, onAnswered } = renderStatusCardController(saveProfessionalStatus)

    await act(() => result.current.choose('employee'))

    expect(saveProfessionalStatus).toHaveBeenCalledWith('employee')
    expect(result.current.isAnswered).toBe(true)
    expect(onAnswered).toHaveBeenCalledTimes(1)
  })

  it('does not call onAnswered when the save fails', async () => {
    const { result, onAnswered } = renderStatusCardController(
      jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Service indisponible' }),
    )

    await act(() => result.current.choose('freelance'))

    expect(result.current.isAnswered).toBe(false)
    expect(result.current.errorMessage).toBe('Service indisponible')
    expect(onAnswered).not.toHaveBeenCalled()
  })

  it('does not call onAnswered when the save throws', async () => {
    const { result, onAnswered } = renderStatusCardController(jest.fn().mockRejectedValue(new Error('Network down')))

    await act(() => result.current.choose('freelance'))

    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(onAnswered).not.toHaveBeenCalled()
  })
})
