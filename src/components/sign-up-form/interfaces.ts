import type { ReactNode } from 'react'
import type { ActionResult } from '@/domain/action-result'
import type { SignUpInput } from '@/domain/sign-up'

export type SignUpFormStatus = 'idle' | 'submitting' | 'error' | 'sent'

export type SignUpWithPassword = (input: SignUpInput) => Promise<ActionResult<null>>

export type ResendSignUpConfirmation = (email: string) => Promise<ActionResult<null>>

export type SignUpFormControllerParameters = {
  signUpWithPassword: SignUpWithPassword
  resendSignUpConfirmation: ResendSignUpConfirmation
}

export type SignUpFormProps = {
  signUpWithPassword: SignUpWithPassword
  resendSignUpConfirmation: ResendSignUpConfirmation
  termsOfUseHref: string
  privacyPolicyHref: string
  oauthSignInButtons: ReactNode
}
