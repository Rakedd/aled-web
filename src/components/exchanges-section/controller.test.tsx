import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'

const NOW = new Date('2026-10-17T10:00:00Z')
const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const CONTACT_ID = '9a1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const renderExchangeController = (addResult: ActionResult<null> = { ok: true, data: null }) => {
  const addContactExchange = jest.fn().mockResolvedValue(addResult)
  const onDataChanged = jest.fn()
  const renderedHook = renderHook(() =>
    useController({ contactId: CONTACT_ID, addContactExchange, now: NOW, onDataChanged }),
  )
  return { ...renderedHook, addContactExchange, onDataChanged }
}

describe('exchanges-section useController', () => {
  it('defaults to a call happening now', async () => {
    const { result, addContactExchange, onDataChanged } = renderExchangeController()
    expect(result.current.kind).toBe('call')
    expect(result.current.occurredAtLocalDateTime).toBe('2026-10-17T12:00')
    act(() => result.current.setSummary('Point sur la mission'))
    await act(() => result.current.addExchange())
    expect(addContactExchange).toHaveBeenCalledWith(CONTACT_ID, {
      kind: 'call',
      summary: 'Point sur la mission',
      jobApplicationId: null,
    })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(result.current.summary).toBe('')
  })

  it('requires a summary', async () => {
    const { result, addContactExchange } = renderExchangeController()
    await act(() => result.current.addExchange())
    expect(addContactExchange).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Le résumé est obligatoire')
  })

  it('sends the chosen job application', async () => {
    const { result, addContactExchange } = renderExchangeController()
    act(() => result.current.setSummary('Relance'))
    act(() => result.current.setJobApplicationId(JOB_APPLICATION_ID))
    await act(() => result.current.addExchange())
    expect(addContactExchange).toHaveBeenCalledWith(
      CONTACT_ID,
      expect.objectContaining({ jobApplicationId: JOB_APPLICATION_ID }),
    )
  })

  it('sends null when no job application is chosen', async () => {
    const { result, addContactExchange } = renderExchangeController()
    act(() => result.current.setSummary('Relance'))
    act(() => result.current.setJobApplicationId(JOB_APPLICATION_ID))
    act(() => result.current.setJobApplicationId(''))
    await act(() => result.current.addExchange())
    expect(addContactExchange).toHaveBeenCalledWith(CONTACT_ID, expect.objectContaining({ jobApplicationId: null }))
  })

  it('sends the edited date and time', async () => {
    const { result, addContactExchange } = renderExchangeController()
    act(() => result.current.setSummary('Relance'))
    act(() => result.current.setOccurredAtLocalDateTime('2026-10-16T09:30'))
    await act(() => result.current.addExchange())
    expect(addContactExchange).toHaveBeenCalledWith(
      CONTACT_ID,
      expect.objectContaining({ occurredAt: new Date('2026-10-16T07:30:00Z') }),
    )
  })

  it('shows the server error and keeps the summary', async () => {
    const { result, onDataChanged } = renderExchangeController({ ok: false, errorMessage: 'Échec' })
    act(() => result.current.setSummary('Relance'))
    await act(() => result.current.addExchange())
    expect(result.current.errorMessage).toBe('Échec')
    expect(result.current.summary).toBe('Relance')
    expect(onDataChanged).not.toHaveBeenCalled()
  })
})
