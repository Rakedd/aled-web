import { isExternalLinkUrl } from '@/domain/client-brief'
import { INTERMEDIARY_KIND_LABELS } from '@/domain/entities'
import { INTERVIEW_FORMAT_LABELS, INTERVIEW_KIND_LABELS, findNextInterview } from '@/domain/interviews'
import { MISSING_VALUE_LABEL, UNKNOWN_END_CLIENT_LABEL, toDisplayText } from '@/domain/job-application-display'
import { formatParisDate, formatParisInterviewDateTime, formatRelativeDaysAgo } from '@/domain/paris-time'
import type { JobApplicationSummaryData, JobApplicationSummaryProps } from './interfaces'

const formatIntermediary = ({ intermediaryName, intermediaryKind }: JobApplicationSummaryData): string | null => {
  if (intermediaryName === null) return null
  return intermediaryKind === null
    ? `via ${intermediaryName}`
    : `via ${intermediaryName} (${INTERMEDIARY_KIND_LABELS[intermediaryKind]})`
}

export const JobApplicationSummary = ({ jobApplication, interviews, now }: JobApplicationSummaryProps) => {
  const intermediaryDisplay = formatIntermediary(jobApplication)
  const nextInterview = findNextInterview(interviews, now)
  const externalPostingUrl =
    jobApplication.postingUrl !== null && isExternalLinkUrl(jobApplication.postingUrl) ? jobApplication.postingUrl : null

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold break-words">{jobApplication.title}</h1>
        <p className="text-sm text-muted-foreground">
          <span>{jobApplication.endClientLabel ?? UNKNOWN_END_CLIENT_LABEL}</span>
          {intermediaryDisplay !== null && (
            <>
              {' · '}
              <span>{intermediaryDisplay}</span>
            </>
          )}
        </p>
      </div>
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
      {nextInterview !== null && (
        <dl className="flex flex-wrap gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <dt className="font-medium">Prochain entretien</dt>
          <dd>
            {formatParisInterviewDateTime(nextInterview.startsAt)} · {INTERVIEW_KIND_LABELS[nextInterview.kind]} ·{' '}
            {INTERVIEW_FORMAT_LABELS[nextInterview.format]}
          </dd>
        </dl>
      )}
    </div>
  )
}
