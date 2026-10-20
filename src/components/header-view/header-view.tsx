import { Fragment } from 'react'
import { isExternalLinkUrl } from '@/domain/client-brief'
import { INTERMEDIARY_KIND_LABELS } from '@/domain/entities'
import { toNullableText } from '@/domain/form-values'
import { UNKNOWN_END_CLIENT_LABEL } from '@/domain/job-application-display'
import { formatParisDate } from '@/domain/paris-time'
import type { HeaderViewData, HeaderViewProps, SummaryPart } from './interfaces'

const formatIntermediary = ({ intermediaryName, intermediaryKind }: HeaderViewData): string | null => {
  if (intermediaryName === null) return null
  return intermediaryKind === null
    ? `via ${intermediaryName}`
    : `via ${intermediaryName} (${INTERMEDIARY_KIND_LABELS[intermediaryKind]})`
}

const buildSummaryParts = (jobApplication: HeaderViewData): SummaryPart[] => {
  const intermediaryDisplay = formatIntermediary(jobApplication)
  const sourceDisplay = jobApplication.source === null ? null : toNullableText(jobApplication.source)
  const externalPostingUrl =
    jobApplication.postingUrl !== null && isExternalLinkUrl(jobApplication.postingUrl) ? jobApplication.postingUrl : null
  const summaryParts: (SummaryPart | null)[] = [
    { key: 'end-client', content: jobApplication.endClientLabel ?? UNKNOWN_END_CLIENT_LABEL },
    intermediaryDisplay === null ? null : { key: 'intermediary', content: intermediaryDisplay },
    sourceDisplay === null ? null : { key: 'source', content: sourceDisplay },
    { key: 'applied-on', content: formatParisDate(jobApplication.appliedOn) },
    externalPostingUrl === null
      ? null
      : {
          key: 'posting',
          content: (
            <a
              href={externalPostingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              Voir l&apos;annonce
            </a>
          ),
        },
  ]
  return summaryParts.filter((summaryPart): summaryPart is SummaryPart => summaryPart !== null)
}

export const HeaderView = ({ jobApplication }: HeaderViewProps) => (
  <p className="min-w-0 text-base break-words text-ink-secondary">
    {buildSummaryParts(jobApplication).map((summaryPart, index) => (
      <Fragment key={summaryPart.key}>
        {index > 0 && ' · '}
        {summaryPart.content}
      </Fragment>
    ))}
  </p>
)
