import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import type { ResendConfirmationFormControllerParameters, ResendConfirmationFormStatus } from './interfaces'

export const useController = ({ resendSignUpConfirmation }: ResendConfirmationFormControllerParameters) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<ResendConfirmationFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorOccurrenceCount, setErrorOccurrenceCount] = useState(0)
  const isRequestInFlightRef = useRef(false)
  const errorAlertReference = useRef<HTMLParagraphElement>(null)
  const confirmationReference = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (errorOccurrenceCount > 0) errorAlertReference.current?.focus()
  }, [errorOccurrenceCount])

  useEffect(() => {
    if (status === 'sent') confirmationReference.current?.focus()
  }, [status])

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
    setErrorOccurrenceCount((previousCount) => previousCount + 1)
  }

  const submit = async () => {
    if (isRequestInFlightRef.current) return

    isRequestInFlightRef.current = true
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const resendResult = await resendSignUpConfirmation(email.trim())
      if (!resendResult.ok) {
        showError(resendResult.errorMessage)
        return
      }
      setStatus('sent')
    } catch {
      showError(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
    }
  }

  return { email, setEmail, status, errorMessage, submit, errorAlertReference, confirmationReference }
}
