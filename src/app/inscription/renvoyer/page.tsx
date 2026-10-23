import type { Metadata } from 'next'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { ResendConfirmationForm } from '@/components/resend-confirmation-form'
import { resendSignUpConfirmation } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: "Nouveau lien d'activation · Aled" }

const ResendConfirmationPage = () => (
  <AuthPageLayout title="Recevoir un nouveau lien d'activation">
    <ResendConfirmationForm resendSignUpConfirmation={resendSignUpConfirmation} />
  </AuthPageLayout>
)

export default ResendConfirmationPage
