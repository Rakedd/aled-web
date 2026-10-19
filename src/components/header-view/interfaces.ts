import type { JobApplicationOverview } from '@/domain/job-application'

export type HeaderViewData = Pick<
  JobApplicationOverview,
  'title' | 'endClientLabel' | 'intermediaryName' | 'intermediaryKind' | 'source' | 'appliedOn' | 'postingUrl'
>

export type HeaderViewProps = {
  jobApplication: HeaderViewData
}
