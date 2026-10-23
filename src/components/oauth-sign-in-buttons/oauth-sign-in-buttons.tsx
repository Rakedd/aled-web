'use client'

import { Button } from '@/components/ui/button'
import { LEGAL_LINK_LABELS, OAUTH_PROVIDERS, OAUTH_PROVIDER_LABELS } from '@/domain/sign-up'
import { useController } from './controller'
import type { OAuthSignInButtonsProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'oauth-sign-in-buttons-error-message'
const LEGAL_LINK_CLASS_NAME = 'text-accent-text underline underline-offset-4'

export const OAuthSignInButtons = ({ startOAuthSignIn, termsOfUseHref, privacyPolicyHref }: OAuthSignInButtonsProps) => {
  const { pendingProvider, errorMessage, signIn } = useController({ startOAuthSignIn })

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
        En continuant, tu acceptes les{' '}
        <a href={termsOfUseHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
          {LEGAL_LINK_LABELS.termsOfUse}
        </a>{' '}
        et la{' '}
        <a href={privacyPolicyHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
          {LEGAL_LINK_LABELS.privacyPolicy}
        </a>
        .
      </p>
      <div className="flex items-center gap-3 text-sm text-ink-secondary" role="separator">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>ou</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    </div>
  )
}
