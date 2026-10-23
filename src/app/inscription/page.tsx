import type { Metadata } from 'next'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { OAuthSignInButtons } from '@/components/oauth-sign-in-buttons'
import { SignUpForm } from '@/components/sign-up-form'
import { PRIVACY_POLICY_PATHNAME, TERMS_OF_USE_PATHNAME } from '@/domain/landing-routing'
import { buildLandingLegalHref } from '@/lib/landing/landing-environment'
import { resendSignUpConfirmation, signUpWithPassword, startOAuthSignIn } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Créer un compte · Aled' }

const SignUpPage = () => {
  const termsOfUseHref = buildLandingLegalHref(TERMS_OF_USE_PATHNAME)
  const privacyPolicyHref = buildLandingLegalHref(PRIVACY_POLICY_PATHNAME)

  return (
    <AuthPageLayout title="Créer un compte">
      <SignUpForm
        signUpWithPassword={signUpWithPassword}
        resendSignUpConfirmation={resendSignUpConfirmation}
        termsOfUseHref={termsOfUseHref}
        privacyPolicyHref={privacyPolicyHref}
        oauthSignInButtons={
          <OAuthSignInButtons
            startOAuthSignIn={startOAuthSignIn}
            termsOfUseHref={termsOfUseHref}
            privacyPolicyHref={privacyPolicyHref}
          />
        }
      />
    </AuthPageLayout>
  )
}

export default SignUpPage
