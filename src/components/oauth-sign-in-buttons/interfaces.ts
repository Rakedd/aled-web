import type { ActionResult } from '@/domain/action-result'
import type { OAuthProvider } from '@/domain/sign-up'

export type StartOAuthSignIn = (provider: OAuthProvider) => Promise<ActionResult<null>>

export type OAuthSignInButtonsControllerParameters = {
  startOAuthSignIn: StartOAuthSignIn
}

export type OAuthSignInButtonsProps = {
  startOAuthSignIn: StartOAuthSignIn
  termsOfUseHref: string
  privacyPolicyHref: string
}
