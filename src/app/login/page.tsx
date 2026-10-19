import type { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'
import { requestMagicLink } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Connexion · Aled' }

const INVALID_LINK_MESSAGE = 'Ce lien de connexion est invalide ou a expiré. Demande un nouveau lien.'

const LoginPage = async ({ searchParams }: PageProps<'/login'>) => {
  const { error } = await searchParams
  const hasInvalidLinkError = error === 'invalid-link'

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Aled</h1>
          <p className="text-sm text-muted-foreground">Connecte-toi avec ton adresse e-mail.</p>
        </div>
        {hasInvalidLinkError && (
          <p role="alert" className="text-sm text-destructive">
            {INVALID_LINK_MESSAGE}
          </p>
        )}
        <LoginForm requestMagicLink={requestMagicLink} />
      </div>
    </main>
  )
}

export default LoginPage
