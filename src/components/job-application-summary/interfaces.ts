import type { Interview } from '@/domain/interviews'

export type JobApplicationSummaryProps = {
  title: string
  interviews: Interview[]
  now: Date
}
