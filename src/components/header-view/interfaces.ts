import type { JobApplicationOverview } from '@/domain/job-application'

export type HeaderViewData = Pick<
  JobApplicationOverview,
  'endClientLabel' | 'intermediaryName' | 'intermediaryKind' | 'source' | 'appliedOn' | 'lastActivityAt' | 'postingUrl'
>

export type HeaderViewProps = {
  jobApplication: HeaderViewData
  now: Date
}
