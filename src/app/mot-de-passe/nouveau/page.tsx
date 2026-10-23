import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { NewPasswordForm } from '@/components/new-password-form'
import { HOME_ROUTE } from '@/domain/routes'
import { updatePassword } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Nouveau mot de passe · Aled' }

const NewPasswordPage = () => (
  <AuthPageLayout title="Nouveau mot de passe">
    <NewPasswordForm updatePassword={updatePassword} />
    <Link href={HOME_ROUTE} className="text-sm font-semibold text-accent-text underline underline-offset-4">
      Retour
    </Link>
  </AuthPageLayout>
)

export default NewPasswordPage
