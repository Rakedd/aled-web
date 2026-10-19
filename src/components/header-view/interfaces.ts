import type { ReactNode } from 'react'
import type { JobApplicationOverview } from '@/domain/job-application'

export type HeaderViewData = Pick<
  JobApplicationOverview,
  'endClientLabel' | 'intermediaryName' | 'intermediaryKind' | 'source' | 'appliedOn' | 'postingUrl'
>

export type HeaderViewProps = {
  jobApplication: HeaderViewData
}

export type SummaryPart = { key: string; content: ReactNode }
