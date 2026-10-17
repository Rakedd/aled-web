import { useState } from 'react'
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
    const saveResult = await saveAnthropicApiKey(trimmedApiKey)
    setStatus('idle')
    if (!saveResult.ok) {
      setErrorMessage(saveResult.errorMessage)
      return
    }
    setApiKeyInput('')
    setApiKeyLastFour(saveResult.data.lastFour)
    setIsReplacingApiKey(false)
    setSuccessMessage(API_KEY_SAVED_MESSAGE)
  }

  const requestApiKeyDeletion = () => {
    clearMessages()
    setIsConfirmingDeletion(true)
  }

  const cancelApiKeyDeletion = () => setIsConfirmingDeletion(false)

  const confirmApiKeyDeletion = async () => {
    clearMessages()
    setStatus('deleting')
    const deletionResult = await deleteAnthropicApiKey()
    setStatus('idle')
    setIsConfirmingDeletion(false)
    if (!deletionResult.ok) {
      setErrorMessage(deletionResult.errorMessage)
      return
    }
    setApiKeyLastFour(null)
    setSuccessMessage(API_KEY_DELETED_MESSAGE)
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
