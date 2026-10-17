import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { useController } from './controller'

const renderAnthropicApiKeyFormController = ({
  initialApiKeyLastFour = null,
  saveAnthropicApiKeyResult = { ok: true, data: { lastFour: '4f2a' } },
  deleteAnthropicApiKeyResult = { ok: true, data: null },
}: {
  initialApiKeyLastFour?: string | null
  saveAnthropicApiKeyResult?: ActionResult<{ lastFour: string }>
  deleteAnthropicApiKeyResult?: ActionResult<null>
} = {}) => {
  const saveAnthropicApiKey = jest.fn().mockResolvedValue(saveAnthropicApiKeyResult)
  const deleteAnthropicApiKey = jest.fn().mockResolvedValue(deleteAnthropicApiKeyResult)
  const { result } = renderHook(() =>
    useController({ initialApiKeyLastFour, saveAnthropicApiKey, deleteAnthropicApiKey }),
  )
  return { result, saveAnthropicApiKey, deleteAnthropicApiKey }
}

describe('anthropic-api-key-form useController', () => {
  it('shows the key input when the user has no key yet', () => {
    const { result } = renderAnthropicApiKeyFormController()
    expect(result.current.maskedApiKey).toBeNull()
    expect(result.current.isApiKeyInputVisible).toBe(true)
  })

  it('shows only the masked key when the user already has one', () => {
    const { result } = renderAnthropicApiKeyFormController({ initialApiKeyLastFour: '9b1c' })
    expect(result.current.maskedApiKey).toBe('sk-ant-…9b1c')
    expect(result.current.isApiKeyInputVisible).toBe(false)
  })

  it('refuses a value that does not start with sk-ant- without calling the server', async () => {
    const { result, saveAnthropicApiKey } = renderAnthropicApiKeyFormController()
    act(() => result.current.setApiKeyInput('sk-proj-abc'))
    await act(() => result.current.submitApiKey())
    expect(saveAnthropicApiKey).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Une clé Claude commence par sk-ant-')
  })

  it('clears the field and shows the masked key once the key is saved', async () => {
    const { result, saveAnthropicApiKey } = renderAnthropicApiKeyFormController()
    act(() => result.current.setApiKeyInput(' sk-ant-api03-abcd4f2a '))
    await act(() => result.current.submitApiKey())
    expect(saveAnthropicApiKey).toHaveBeenCalledWith('sk-ant-api03-abcd4f2a')
    expect(result.current.apiKeyInput).toBe('')
    expect(result.current.maskedApiKey).toBe('sk-ant-…4f2a')
    expect(result.current.isApiKeyInputVisible).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('shows the refusal when Claude rejects the key', async () => {
    const { result } = renderAnthropicApiKeyFormController({
      saveAnthropicApiKeyResult: { ok: false, errorMessage: 'Clé refusée par Claude : vérifie-la ou ton crédit' },
    })
    act(() => result.current.setApiKeyInput('sk-ant-revoked'))
    await act(() => result.current.submitApiKey())
    expect(result.current.errorMessage).toBe('Clé refusée par Claude : vérifie-la ou ton crédit')
    expect(result.current.maskedApiKey).toBeNull()
  })

  it('lets the user replace an existing key and cancel the replacement', () => {
    const { result } = renderAnthropicApiKeyFormController({ initialApiKeyLastFour: '9b1c' })
    act(() => result.current.startReplacingApiKey())
    expect(result.current.isApiKeyInputVisible).toBe(true)
    act(() => result.current.setApiKeyInput('sk-ant-typed'))
    act(() => result.current.cancelReplacingApiKey())
    expect(result.current.isApiKeyInputVisible).toBe(false)
    expect(result.current.apiKeyInput).toBe('')
  })

  it('deletes the key only after confirmation', async () => {
    const { result, deleteAnthropicApiKey } = renderAnthropicApiKeyFormController({ initialApiKeyLastFour: '9b1c' })
    act(() => result.current.requestApiKeyDeletion())
    expect(result.current.isConfirmingDeletion).toBe(true)
    expect(deleteAnthropicApiKey).not.toHaveBeenCalled()
    await act(() => result.current.confirmApiKeyDeletion())
    expect(deleteAnthropicApiKey).toHaveBeenCalled()
    expect(result.current.maskedApiKey).toBeNull()
    expect(result.current.isConfirmingDeletion).toBe(false)
  })

  it('keeps the key and shows the error when the deletion fails', async () => {
    const { result } = renderAnthropicApiKeyFormController({
      initialApiKeyLastFour: '9b1c',
      deleteAnthropicApiKeyResult: { ok: false, errorMessage: 'Impossible de supprimer la clé' },
    })
    act(() => result.current.requestApiKeyDeletion())
    await act(() => result.current.confirmApiKeyDeletion())
    expect(result.current.maskedApiKey).toBe('sk-ant-…9b1c')
    expect(result.current.errorMessage).toBe('Impossible de supprimer la clé')
  })

  it('leaves the saving state and shows the generic error when saving throws', async () => {
    const saveAnthropicApiKey = jest.fn().mockRejectedValue(new Error('Network down'))
    const deleteAnthropicApiKey = jest.fn()
    const { result } = renderHook(() =>
      useController({ initialApiKeyLastFour: null, saveAnthropicApiKey, deleteAnthropicApiKey }),
    )
    act(() => result.current.setApiKeyInput('sk-ant-api03-abcd4f2a'))
    await act(() => result.current.submitApiKey())
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.maskedApiKey).toBeNull()
  })

  it('leaves the deleting state and keeps the key when the deletion throws', async () => {
    const saveAnthropicApiKey = jest.fn()
    const deleteAnthropicApiKey = jest.fn().mockRejectedValue(new Error('Network down'))
    const { result } = renderHook(() =>
      useController({ initialApiKeyLastFour: '9b1c', saveAnthropicApiKey, deleteAnthropicApiKey }),
    )
    act(() => result.current.requestApiKeyDeletion())
    await act(() => result.current.confirmApiKeyDeletion())
    expect(result.current.status).toBe('idle')
    expect(result.current.isConfirmingDeletion).toBe(false)
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.maskedApiKey).toBe('sk-ant-…9b1c')
  })
})
