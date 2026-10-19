import type { ReactNode } from 'react'
import type { Interview } from '@/domain/interviews'

export type JobApplicationHighlightsProps = {
  requestedDailyRate: number | null
  postedDailyRate: number | null
  nextInterview: Interview | null
  now: Date
  preparation: ReactNode
}

export type DailyRateHighlight = {
  label: string
  formattedDailyRate: string | null
}
