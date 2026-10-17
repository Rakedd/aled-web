import { useState } from 'react'
import { INVALID_EMAIL_ADDRESS_MESSAGE, isValidEmailAddress } from '@/domain/email-address'
import type { LoginFormControllerParameters, LoginFormStatus } from './interfaces'

export const useController = ({ requestMagicLink }: LoginFormControllerParameters) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<LoginFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
  }

  const submit = async () => {
    const trimmedEmail = email.trim()
    if (!isValidEmailAddress(trimmedEmail)) {
      showError(INVALID_EMAIL_ADDRESS_MESSAGE)
      return
    }

    setStatus('sending')
    setErrorMessage(null)
    const requestMagicLinkResult = await requestMagicLink(trimmedEmail)
    if (!requestMagicLinkResult.ok) {
      showError(requestMagicLinkResult.errorMessage)
      return
    }

    setStatus('sent')
  }

  return { email, setEmail, submit, status, errorMessage }
}
