import type { ActionResult } from '@/domain/action-result'

export type LoginFormStatus = 'idle' | 'sending' | 'sent' | 'error'

export type RequestMagicLink = (email: string) => Promise<ActionResult<null>>

export type LoginFormControllerParameters = {
  requestMagicLink: RequestMagicLink
}

export type LoginFormProps = LoginFormControllerParameters
