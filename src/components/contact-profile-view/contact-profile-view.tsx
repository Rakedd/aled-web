import Link from 'next/link'
import { isExternalLinkUrl } from '@/domain/client-brief'
import { MISSING_VALUE_LABEL, toDisplayText, toPhoneHref } from '@/domain/job-application-display'
import { intermediaryRoute } from '@/domain/routes'
import type { ContactProfileViewProps } from './interfaces'

const ACTION_LINK_CLASS_NAME =
  'inline-flex items-center rounded-full border border-hairline px-3 py-1 text-sm font-medium text-ink hover:bg-muted focus-visible:bg-muted'

export const ContactProfileView = ({ profile }: ContactProfileViewProps) => {
  const detailEntries = [
    { term: 'Téléphone', value: toDisplayText(profile.phone) },
    { term: 'E-mail', value: toDisplayText(profile.email) },
    { term: 'LinkedIn', value: toDisplayText(profile.linkedinUrl) },
    { term: 'Recommandé par', value: toDisplayText(profile.referredBy) },
  ]
  const hasLinkedinAction = profile.linkedinUrl !== null && isExternalLinkUrl(profile.linkedinUrl)
  const hasAnyAction = profile.phone !== null || profile.email !== null || hasLinkedinAction

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {profile.intermediaryId !== null && profile.intermediaryName !== null ? (
          <Link href={intermediaryRoute(profile.intermediaryId)} className="text-accent-text underline underline-offset-2">
            {profile.intermediaryName}
          </Link>
        ) : (
          'Aucune agence'
        )}
      </p>
      {hasAnyAction && (
        <div className="flex flex-wrap gap-2">
          {profile.phone !== null && (
            <a href={toPhoneHref(profile.phone)} className={ACTION_LINK_CLASS_NAME}>
              Appeler
            </a>
          )}
          {profile.email !== null && (
            <a href={`mailto:${profile.email}`} className={ACTION_LINK_CLASS_NAME}>
              E-mail
            </a>
          )}
          {hasLinkedinAction && (
            <a href={profile.linkedinUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={ACTION_LINK_CLASS_NAME}>
              LinkedIn
            </a>
          )}
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {detailEntries.map(({ term, value }) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="break-words whitespace-pre-wrap">
            {profile.notes === null ? MISSING_VALUE_LABEL : profile.notes}
          </dd>
        </div>
      </dl>
    </div>
  )
}
