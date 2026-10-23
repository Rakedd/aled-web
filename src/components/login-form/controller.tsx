import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { UNCONFIRMED_ACCOUNT_MESSAGE, findSignInCredentialsError } from '@/domain/password-sign-in'
import { RESEND_COOLDOWN_SECONDS } from '@/domain/sign-up'
import type { LoginFormControllerParameters, LoginFormStatus } from './interfaces'

const ONE_SECOND_IN_MILLISECONDS = 1000

export const useController = ({ signInWithPassword, resendSignUpConfirmation, onSignedIn }: LoginFormControllerParameters) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<LoginFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isActivationResendOffered, setIsActivationResendOffered] = useState(false)
  const [secondsBeforeActivationResend, setSecondsBeforeActivationResend] = useState(0)
  const [isResendingActivationEmail, setIsResendingActivationEmail] = useState(false)
  const [hasResentActivationEmail, setHasResentActivationEmail] = useState(false)
  const [activationResendErrorMessage, setActivationResendErrorMessage] = useState<string | null>(null)
  const isActivationResendInFlightRef = useRef(false)

  const isActivationResendCooldownActive = secondsBeforeActivationResend > 0

  useEffect(() => {
    if (!isActivationResendCooldownActive) return
    const countdownIntervalId = setInterval(
      () => setSecondsBeforeActivationResend((previousSeconds) => Math.max(previousSeconds - 1, 0)),
      ONE_SECOND_IN_MILLISECONDS,
    )
    return () => clearInterval(countdownIntervalId)
  }, [isActivationResendCooldownActive])

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
    setIsActivationResendOffered(message === UNCONFIRMED_ACCOUNT_MESSAGE)
  }

  const submit = async () => {
    if (status === 'signing-in') return

    setHasResentActivationEmail(false)
    setActivationResendErrorMessage(null)
    const trimmedEmail = email.trim()
    const credentialsError = findSignInCredentialsError(trimmedEmail, password)
    if (credentialsError) {
      showError(credentialsError)
      return
    }

    setStatus('signing-in')
    setErrorMessage(null)
    setIsActivationResendOffered(false)
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

  const resendActivationEmail = async () => {
    if (isActivationResendInFlightRef.current || isActivationResendCooldownActive) return

    isActivationResendInFlightRef.current = true
    setIsResendingActivationEmail(true)
    setHasResentActivationEmail(false)
    setActivationResendErrorMessage(null)
    try {
      const resendResult = await resendSignUpConfirmation(email.trim())
      if (!resendResult.ok) {
        setActivationResendErrorMessage(resendResult.errorMessage)
        return
      }
      setHasResentActivationEmail(true)
      setSecondsBeforeActivationResend(RESEND_COOLDOWN_SECONDS)
    } catch {
      setActivationResendErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isActivationResendInFlightRef.current = false
      setIsResendingActivationEmail(false)
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    submit,
    status,
    errorMessage,
    isActivationResendOffered,
    secondsBeforeActivationResend,
    isResendingActivationEmail,
    hasResentActivationEmail,
    activationResendErrorMessage,
    resendActivationEmail,
  }
}
