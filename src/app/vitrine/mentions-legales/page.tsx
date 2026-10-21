import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'
import { LEGAL_NOTICE_DOCUMENT } from '@/domain/legal-copy'
import { LEGAL_NOTICE_PATHNAME } from '@/domain/landing-routing'

export const metadata: Metadata = {
  title: 'Mentions légales · Aled',
  alternates: { canonical: LEGAL_NOTICE_PATHNAME },
}

const LegalNoticePage = () => <LegalDocument document={LEGAL_NOTICE_DOCUMENT} />

export default LegalNoticePage
