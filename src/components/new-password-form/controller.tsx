import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { findNewPasswordError } from '@/domain/sign-up'
import type { NewPasswordFormControllerParameters, NewPasswordFormStatus } from './interfaces'

export const useController = ({ updatePassword, onPasswordUpdated }: NewPasswordFormControllerParameters) => {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [status, setStatus] = useState<NewPasswordFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorOccurrenceCount, setErrorOccurrenceCount] = useState(0)
  const isRequestInFlightRef = useRef(false)
  const errorAlertReference = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (errorOccurrenceCount > 0) errorAlertReference.current?.focus()
  }, [errorOccurrenceCount])

  const togglePasswordVisibility = () => setIsPasswordVisible((previousVisibility) => !previousVisibility)

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
    setErrorOccurrenceCount((previousCount) => previousCount + 1)
  }

  const submit = async () => {
    if (isRequestInFlightRef.current) return

    const newPasswordError = findNewPasswordError(password, confirmation)
    if (newPasswordError) {
      showError(newPasswordError)
      return
    }

    isRequestInFlightRef.current = true
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const updateResult = await updatePassword(password, confirmation)
      if (!updateResult.ok) {
        showError(updateResult.errorMessage)
        isRequestInFlightRef.current = false
        return
      }
      onPasswordUpdated()
    } catch {
      showError(GENERIC_ACTION_ERROR_MESSAGE)
      isRequestInFlightRef.current = false
    }
  }

  return {
    password,
    setPassword,
    confirmation,
    setConfirmation,
    isPasswordVisible,
    togglePasswordVisibility,
    status,
    errorMessage,
    submit,
    errorAlertReference,
  }
}
