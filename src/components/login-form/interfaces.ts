import type { ActionResult } from '@/domain/action-result'

export type LoginFormStatus = 'idle' | 'signing-in' | 'error'

export type SignInWithPassword = (email: string, password: string) => Promise<ActionResult<null>>

export type LoginFormControllerParameters = {
  signInWithPassword: SignInWithPassword
  onSignedIn: () => void
}

export type LoginFormProps = {
  signInWithPassword: SignInWithPassword
}
