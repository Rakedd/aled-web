import { useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  formatMaskedAnthropicApiKey,
  hasAnthropicApiKeyFormat,
  INVALID_ANTHROPIC_API_KEY_FORMAT_MESSAGE,
} from '@/domain/anthropic-api-key'
import type { AnthropicApiKeyFormControllerParameters, AnthropicApiKeyFormStatus } from './interfaces'

const API_KEY_SAVED_MESSAGE = 'Clé enregistrée'
const API_KEY_DELETED_MESSAGE = 'Clé supprimée'

export const useController = ({
  initialApiKeyLastFour,
  saveAnthropicApiKey,
  deleteAnthropicApiKey,
}: AnthropicApiKeyFormControllerParameters) => {
  const [apiKeyLastFour, setApiKeyLastFour] = useState(initialApiKeyLastFour)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isReplacingApiKey, setIsReplacingApiKey] = useState(false)
  const [isConfirmingDeletion, setIsConfirmingDeletion] = useState(false)
  const [status, setStatus] = useState<AnthropicApiKeyFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const maskedApiKey = apiKeyLastFour === null ? null : formatMaskedAnthropicApiKey(apiKeyLastFour)
  const isApiKeyInputVisible = apiKeyLastFour === null || isReplacingApiKey

  const clearMessages = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const startReplacingApiKey = () => {
    clearMessages()
    setIsConfirmingDeletion(false)
    setIsReplacingApiKey(true)
  }

  const cancelReplacingApiKey = () => {
    clearMessages()
    setApiKeyInput('')
    setIsReplacingApiKey(false)
  }

  const submitApiKey = async () => {
    clearMessages()
    const trimmedApiKey = apiKeyInput.trim()
    if (!hasAnthropicApiKeyFormat(trimmedApiKey)) {
      setErrorMessage(INVALID_ANTHROPIC_API_KEY_FORMAT_MESSAGE)
      return
    }
    setStatus('saving')
    try {
      const saveResult = await saveAnthropicApiKey(trimmedApiKey)
      if (!saveResult.ok) {
        setErrorMessage(saveResult.errorMessage)
        return
      }
      setApiKeyInput('')
      setApiKeyLastFour(saveResult.data.lastFour)
      setIsReplacingApiKey(false)
      setSuccessMessage(API_KEY_SAVED_MESSAGE)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setStatus('idle')
    }
  }

  const requestApiKeyDeletion = () => {
    clearMessages()
    setIsConfirmingDeletion(true)
  }

  const cancelApiKeyDeletion = () => setIsConfirmingDeletion(false)

  const confirmApiKeyDeletion = async () => {
    clearMessages()
    setStatus('deleting')
    try {
      const deletionResult = await deleteAnthropicApiKey()
      if (!deletionResult.ok) {
        setErrorMessage(deletionResult.errorMessage)
        return
      }
      setApiKeyLastFour(null)
      setSuccessMessage(API_KEY_DELETED_MESSAGE)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setStatus('idle')
      setIsConfirmingDeletion(false)
    }
  }

  return {
    apiKeyInput,
    setApiKeyInput,
    maskedApiKey,
    isApiKeyInputVisible,
    isReplacingApiKey,
    isConfirmingDeletion,
    status,
    errorMessage,
    successMessage,
    startReplacingApiKey,
    cancelReplacingApiKey,
    submitApiKey,
    requestApiKeyDeletion,
    cancelApiKeyDeletion,
    confirmApiKeyDeletion,
  }
}
