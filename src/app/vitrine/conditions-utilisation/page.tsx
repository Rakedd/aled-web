import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'
import { TERMS_OF_USE_DOCUMENT } from '@/domain/legal-copy'
import { TERMS_OF_USE_PATHNAME } from '@/domain/landing-routing'

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Aled",
  alternates: { canonical: TERMS_OF_USE_PATHNAME },
}

const TermsOfUsePage = () => <LegalDocument document={TERMS_OF_USE_DOCUMENT} />

export default TermsOfUsePage
