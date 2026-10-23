import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import type { OAuthProvider } from '@/domain/sign-up'
import type { OAuthSignInButtonsControllerParameters } from './interfaces'

export const useController = ({ startOAuthSignIn }: OAuthSignInButtonsControllerParameters) => {
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isSignInInFlightRef = useRef(false)

  const releaseWithError = (message: string) => {
    isSignInInFlightRef.current = false
    setPendingProvider(null)
    setErrorMessage(message)
  }

  const signIn = async (provider: OAuthProvider) => {
    if (isSignInInFlightRef.current) return

    isSignInInFlightRef.current = true
    setPendingProvider(provider)
    setErrorMessage(null)
    try {
      const signInResult = await startOAuthSignIn(provider)
      if (!signInResult.ok) releaseWithError(signInResult.errorMessage)
    } catch {
      releaseWithError(GENERIC_ACTION_ERROR_MESSAGE)
    }
  }

  return { pendingProvider, errorMessage, signIn }
}
