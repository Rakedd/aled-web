import { INTERVIEW_FORMAT_LABELS, INTERVIEW_KIND_LABELS, findNextInterview } from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
import type { JobApplicationSummaryProps } from './interfaces'

export const JobApplicationSummary = ({ title, interviews, now }: JobApplicationSummaryProps) => {
  const nextInterview = findNextInterview(interviews, now)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h1 className="text-2xl font-semibold break-words">{title}</h1>
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
