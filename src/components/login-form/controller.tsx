import { useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { findSignInCredentialsError } from '@/domain/password-sign-in'
import type { LoginFormControllerParameters, LoginFormStatus } from './interfaces'

export const useController = ({ signInWithPassword, onSignedIn }: LoginFormControllerParameters) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<LoginFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
  }

  const submit = async () => {
    if (status === 'signing-in') return

    const trimmedEmail = email.trim()
    const credentialsError = findSignInCredentialsError(trimmedEmail, password)
    if (credentialsError) {
      showError(credentialsError)
      return
    }

    setStatus('signing-in')
    setErrorMessage(null)
    try {
      const signInResult = await signInWithPassword(trimmedEmail, password)
      if (!signInResult.ok) {
        showError(signInResult.errorMessage)
        return
      }
      onSignedIn()
    } catch {
      showError(GENERIC_ACTION_ERROR_MESSAGE)
    }
  }

  return { email, setEmail, password, setPassword, submit, status, errorMessage }
}
