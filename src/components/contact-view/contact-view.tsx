import Link from 'next/link'
import type { ReactNode } from 'react'
import { isExternalLinkUrl } from '@/domain/client-brief'
import { LinkedinLink } from '@/components/linkedin-link'
import { contactRoute } from '@/domain/routes'
import { MISSING_VALUE_LABEL, toDisplayText, toPhoneHref } from '@/domain/job-application-display'
import type { ContactViewProps } from './interfaces'

const LINK_CLASS_NAME = 'text-accent-text underline underline-offset-2 break-all'

const renderPhone = (phone: string | null): ReactNode =>
  phone === null ? (
    MISSING_VALUE_LABEL
  ) : (
    <a href={toPhoneHref(phone)} className={LINK_CLASS_NAME}>
      {phone}
    </a>
  )

const renderEmail = (email: string | null): ReactNode =>
  email === null ? (
    MISSING_VALUE_LABEL
  ) : (
    <a href={`mailto:${email}`} className={LINK_CLASS_NAME}>
      {email}
    </a>
  )

const renderLinkedinUrl = (linkedinUrl: string | null): ReactNode =>
  linkedinUrl === null || !isExternalLinkUrl(linkedinUrl) ? (
    MISSING_VALUE_LABEL
  ) : (
    <LinkedinLink url={linkedinUrl} />
  )

export const ContactView = ({ contactName, contactDetails, loadErrorMessage, contactId }: ContactViewProps) => {
  const contactEntries = [
    { term: 'Nom', value: toDisplayText(contactName) },
    { term: 'Téléphone', value: renderPhone(contactDetails?.phone ?? null) },
    { term: 'E-mail', value: renderEmail(contactDetails?.email ?? null) },
    { term: 'LinkedIn', value: renderLinkedinUrl(contactDetails?.linkedinUrl ?? null) },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {contactEntries.map(({ term, value }) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {contactId !== null && (
        <Link href={contactRoute(contactId)} className={`text-sm ${LINK_CLASS_NAME}`}>
          Voir la fiche du contact
        </Link>
      )}
      {loadErrorMessage !== null && (
        <p role="alert" className="text-sm text-destructive">
          {loadErrorMessage}
        </p>
      )}
    </div>
  )
}
