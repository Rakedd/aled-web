import type { Metadata } from 'next'
import Image from 'next/image'
import { LoginForm } from '@/components/login-form'
import { OAuthSignInButtons } from '@/components/oauth-sign-in-buttons'
import { PRIVACY_POLICY_PATHNAME, TERMS_OF_USE_PATHNAME } from '@/domain/landing-routing'
import { SIGN_UP_MESSAGES } from '@/domain/sign-up'
import { buildLandingLegalHref } from '@/lib/landing/landing-environment'
import { signInWithPassword, startOAuthSignIn } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Connexion · Aled' }

const LOGIN_ERROR_MESSAGES: Partial<Record<string, string>> = {
  'invalid-link': 'Ce lien de connexion est invalide ou a expiré. Connecte-toi avec ton mot de passe.',
  oauth: SIGN_UP_MESSAGES.oauthFailure,
}

const findLoginErrorMessage = (errorParameter: string | string[] | undefined): string | undefined =>
  typeof errorParameter === 'string' && Object.hasOwn(LOGIN_ERROR_MESSAGES, errorParameter)
    ? LOGIN_ERROR_MESSAGES[errorParameter]
    : undefined

const LoginPage = async ({ searchParams }: PageProps<'/login'>) => {
  const { error } = await searchParams
  const loginErrorMessage = findLoginErrorMessage(error)

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <section className="flex flex-col justify-center gap-4 bg-brand-tile px-6 py-10 text-on-brand-tile-secondary lg:w-1/2 lg:px-16 lg:py-20">
        <Image src="/brand/aled-logo-on-dark.png" alt="Aled" width={107} height={48} />
        <h1 className="font-heading text-3xl font-extrabold text-on-brand-tile lg:text-5xl">
          Trouver du travail sans traverser la rue.
        </h1>
        <p className="max-w-md text-base">
          Candidatures, entretiens, briefs et nouvelles missions Free-Work et Collective, sans rien oublier.
        </p>
      </section>
      <section className="flex flex-1 items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-card p-6">
          <h2 className="font-heading text-2xl font-bold text-ink">Connexion</h2>
          {loginErrorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {loginErrorMessage}
            </p>
          )}
          <OAuthSignInButtons
            startOAuthSignIn={startOAuthSignIn}
            termsOfUseHref={buildLandingLegalHref(TERMS_OF_USE_PATHNAME)}
            privacyPolicyHref={buildLandingLegalHref(PRIVACY_POLICY_PATHNAME)}
          />
          <LoginForm signInWithPassword={signInWithPassword} />
        </div>
      </section>
    </main>
  )
}

export default LoginPage
