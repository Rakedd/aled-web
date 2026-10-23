'use client'

import { Button } from '@/components/ui/button'
import { LEGAL_LINK_LABELS, OAUTH_PROVIDERS, OAUTH_PROVIDER_LABELS, SIGN_UP_MESSAGES } from '@/domain/sign-up'
import { useController } from './controller'
import type { NavigateToUrl, OAuthSignInButtonsProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'oauth-sign-in-buttons-error-message'
const [NOTICE_BEFORE_TERMS, NOTICE_AFTER_TERMS] = SIGN_UP_MESSAGES.termsNotice.split(LEGAL_LINK_LABELS.termsOfUse)
const [NOTICE_BETWEEN_LINKS, NOTICE_AFTER_LINKS] = NOTICE_AFTER_TERMS.split(LEGAL_LINK_LABELS.privacyPolicy)
const LEGAL_LINK_CLASS_NAME = 'text-accent-text underline underline-offset-4'

const assignWindowLocation: NavigateToUrl = (url) => window.location.assign(url)

export const OAuthSignInButtons = ({
  startOAuthSignIn,
  termsOfUseHref,
  privacyPolicyHref,
  navigateToUrl = assignWindowLocation,
}: OAuthSignInButtonsProps) => {
  const { pendingProvider, errorMessage, signIn } = useController({ startOAuthSignIn, navigateToUrl })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {OAUTH_PROVIDERS.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={pendingProvider !== null}
            aria-busy={pendingProvider === provider}
            aria-describedby={errorMessage ? ERROR_MESSAGE_ELEMENT_ID : undefined}
            onClick={() => void signIn(provider)}
          >
            {OAUTH_PROVIDER_LABELS[provider]}
          </Button>
        ))}
      </div>
      {errorMessage && (
        <p id={ERROR_MESSAGE_ELEMENT_ID} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <p className="text-sm text-ink-secondary">
        {NOTICE_BEFORE_TERMS}
        <a href={termsOfUseHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
          {LEGAL_LINK_LABELS.termsOfUse}
        </a>
        {NOTICE_BETWEEN_LINKS}
        <a href={privacyPolicyHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
          {LEGAL_LINK_LABELS.privacyPolicy}
        </a>
        {NOTICE_AFTER_LINKS}
      </p>
      <div className="flex items-center gap-3 text-sm text-ink-secondary">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>ou</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    </div>
  )
}
