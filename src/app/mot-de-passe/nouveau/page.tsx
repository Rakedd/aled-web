import type { Metadata } from 'next'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { NewPasswordForm } from '@/components/new-password-form'
import { updatePassword } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Nouveau mot de passe · Aled' }

const NewPasswordPage = () => (
  <AuthPageLayout title="Nouveau mot de passe">
    <NewPasswordForm updatePassword={updatePassword} />
  </AuthPageLayout>
)

export default NewPasswordPage
