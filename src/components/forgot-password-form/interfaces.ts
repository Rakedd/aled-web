import type { ActionResult } from '@/domain/action-result'

export type ForgotPasswordFormStatus = 'idle' | 'submitting' | 'error' | 'sent'

export type RequestPasswordReset = (email: string) => Promise<ActionResult<null>>

export type ForgotPasswordFormControllerParameters = {
  requestPasswordReset: RequestPasswordReset
}

export type ForgotPasswordFormProps = ForgotPasswordFormControllerParameters
