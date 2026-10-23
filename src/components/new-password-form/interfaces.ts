import type { ActionResult } from '@/domain/action-result'

export type NewPasswordFormStatus = 'idle' | 'submitting' | 'error'

export type UpdatePassword = (password: string, confirmation: string) => Promise<ActionResult<null>>

export type NewPasswordFormControllerParameters = {
  updatePassword: UpdatePassword
  onPasswordUpdated: () => void
}

export type NewPasswordFormProps = {
  updatePassword: UpdatePassword
}
