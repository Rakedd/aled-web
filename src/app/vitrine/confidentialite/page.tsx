import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'
import { PRIVACY_POLICY_DOCUMENT } from '@/domain/legal-copy'
import { PRIVACY_POLICY_PATHNAME } from '@/domain/landing-routing'

export const metadata: Metadata = {
  title: 'Confidentialité · Aled',
  alternates: { canonical: PRIVACY_POLICY_PATHNAME },
}

const PrivacyPolicyPage = () => <LegalDocument document={PRIVACY_POLICY_DOCUMENT} />

export default PrivacyPolicyPage
