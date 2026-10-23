import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  RESEND_COOLDOWN_SECONDS,
  findSignUpInputError,
  type ProfessionalStatus,
  type SignUpInput,
} from '@/domain/sign-up'
import type { SignUpFormControllerParameters, SignUpFormStatus } from './interfaces'

const ONE_SECOND_IN_MILLISECONDS = 1000

export const useController = ({ signUpWithPassword, resendSignUpConfirmation }: SignUpFormControllerParameters) => {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [professionalStatus, setProfessionalStatus] = useState<ProfessionalStatus | null>(null)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const [status, setStatus] = useState<SignUpFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [secondsBeforeResend, setSecondsBeforeResend] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const [hasResent, setHasResent] = useState(false)
  const isRequestInFlightRef = useRef(false)

  const isResendCooldownActive = secondsBeforeResend > 0

  useEffect(() => {
    if (!isResendCooldownActive) return
    const countdownIntervalId = setInterval(
      () => setSecondsBeforeResend((previousSeconds) => Math.max(previousSeconds - 1, 0)),
      ONE_SECOND_IN_MILLISECONDS,
    )
    return () => clearInterval(countdownIntervalId)
  }, [isResendCooldownActive])

  const togglePasswordVisibility = () => setIsPasswordVisible((previousVisibility) => !previousVisibility)

  const showError = (message: string) => {
    setStatus('error')
    setErrorMessage(message)
  }

  const submit = async () => {
    if (isRequestInFlightRef.current) return

    const signUpInput: SignUpInput = {
      firstName: firstName.trim(),
      email: email.trim(),
      password,
      professionalStatus,
      hasAcceptedTerms,
    }
    const signUpInputError = findSignUpInputError(signUpInput)
    if (signUpInputError) {
      showError(signUpInputError)
      return
    }

    isRequestInFlightRef.current = true
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const signUpResult = await signUpWithPassword(signUpInput)
      if (!signUpResult.ok) {
        showError(signUpResult.errorMessage)
        return
      }
      setSubmittedEmail(signUpInput.email)
      setPassword('')
      setSecondsBeforeResend(RESEND_COOLDOWN_SECONDS)
      setStatus('sent')
    } catch {
      showError(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
    }
  }

  const resend = async () => {
    if (isRequestInFlightRef.current || isResendCooldownActive) return

    isRequestInFlightRef.current = true
    setIsResending(true)
    setHasResent(false)
    setErrorMessage(null)
    try {
      const resendResult = await resendSignUpConfirmation(submittedEmail)
      if (!resendResult.ok) {
        setErrorMessage(resendResult.errorMessage)
        return
      }
      setHasResent(true)
      setSecondsBeforeResend(RESEND_COOLDOWN_SECONDS)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
      setIsResending(false)
    }
  }

  return {
    firstName,
    setFirstName,
    email,
    setEmail,
    password,
    setPassword,
    isPasswordVisible,
    togglePasswordVisibility,
    professionalStatus,
    setProfessionalStatus,
    hasAcceptedTerms,
    setHasAcceptedTerms,
    status,
    errorMessage,
    submit,
    submittedEmail,
    secondsBeforeResend,
    isResending,
    hasResent,
    resend,
  }
}
