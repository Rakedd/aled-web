import { isExternalLinkUrl } from '@/domain/client-brief'
import { INTERMEDIARY_KIND_LABELS } from '@/domain/entities'
import { MISSING_VALUE_LABEL, UNKNOWN_END_CLIENT_LABEL, toDisplayText } from '@/domain/job-application-display'
import { formatParisDate, formatRelativeDaysAgo } from '@/domain/paris-time'
import type { HeaderViewData, HeaderViewProps } from './interfaces'

const formatIntermediary = ({ intermediaryName, intermediaryKind }: HeaderViewData): string | null => {
  if (intermediaryName === null) return null
  return intermediaryKind === null
    ? `via ${intermediaryName}`
    : `via ${intermediaryName} (${INTERMEDIARY_KIND_LABELS[intermediaryKind]})`
}

export const HeaderView = ({ jobApplication, now }: HeaderViewProps) => {
  const intermediaryDisplay = formatIntermediary(jobApplication)
  const externalPostingUrl =
    jobApplication.postingUrl !== null && isExternalLinkUrl(jobApplication.postingUrl) ? jobApplication.postingUrl : null

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        <span>{jobApplication.endClientLabel ?? UNKNOWN_END_CLIENT_LABEL}</span>
        {intermediaryDisplay !== null && (
          <>
            {' · '}
            <span>{intermediaryDisplay}</span>
          </>
        )}
      </p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Source</dt>
          <dd>{toDisplayText(jobApplication.source)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Candidature du</dt>
          <dd>{formatParisDate(jobApplication.appliedOn)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Dernier échange</dt>
          <dd>
            {jobApplication.lastActivityAt === null
              ? MISSING_VALUE_LABEL
              : formatRelativeDaysAgo(jobApplication.lastActivityAt, now)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Annonce</dt>
          <dd>
            {externalPostingUrl === null ? (
              MISSING_VALUE_LABEL
            ) : (
              <a
                href={externalPostingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Voir l&apos;annonce
              </a>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
