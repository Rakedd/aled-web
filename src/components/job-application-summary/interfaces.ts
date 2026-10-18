import type { Interview } from '@/domain/interviews'
import type { JobApplicationOverview } from '@/domain/job-application'

export type JobApplicationSummaryData = Pick<
  JobApplicationOverview,
  | 'title'
  | 'endClientLabel'
  | 'intermediaryName'
  | 'intermediaryKind'
  | 'source'
  | 'appliedOn'
  | 'lastActivityAt'
  | 'postingUrl'
>

export type JobApplicationSummaryProps = {
  jobApplication: JobApplicationSummaryData
  interviews: Interview[]
  now: Date
}
