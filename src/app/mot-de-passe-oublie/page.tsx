import type { Metadata } from 'next'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { ForgotPasswordForm } from '@/components/forgot-password-form'
import { requestPasswordReset } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Mot de passe oublié · Aled' }

const ForgotPasswordPage = () => (
  <AuthPageLayout title="Mot de passe oublié">
    <ForgotPasswordForm requestPasswordReset={requestPasswordReset} />
  </AuthPageLayout>
)

export default ForgotPasswordPage
