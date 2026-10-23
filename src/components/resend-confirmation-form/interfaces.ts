import type { ActionResult } from '@/domain/action-result'

export type ResendConfirmationFormStatus = 'idle' | 'submitting' | 'error' | 'sent'

export type ResendSignUpConfirmation = (email: string) => Promise<ActionResult<null>>

export type ResendConfirmationFormControllerParameters = {
  resendSignUpConfirmation: ResendSignUpConfirmation
}

export type ResendConfirmationFormProps = ResendConfirmationFormControllerParameters
