import type { ActionResult } from '@/domain/action-result'
import type { OAuthProvider } from '@/domain/sign-up'

export type StartOAuthSignIn = (provider: OAuthProvider) => Promise<ActionResult<{ url: string }>>

export type NavigateToUrl = (url: string) => void

export type OAuthSignInButtonsControllerParameters = {
  startOAuthSignIn: StartOAuthSignIn
  navigateToUrl: NavigateToUrl
}

export type OAuthSeparatorPlacement = 'top' | 'bottom'

export type OAuthSignInButtonsProps = {
  startOAuthSignIn: StartOAuthSignIn
  termsOfUseHref: string
  privacyPolicyHref: string
  separatorPlacement: OAuthSeparatorPlacement
  navigateToUrl?: NavigateToUrl
}
