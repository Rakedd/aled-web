import type { StackItem } from './types'

export const MAX_PASTED_TEXT_LENGTH = 50_000

export type JobPostingExtraction = {
  title: string | null
  intermediaryName: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  endClientName: string | null
  postedDailyRate: number | null
  location: string | null
  remotePolicy: string | null
  desiredStart: string | null
  duration: string | null
  stack: StackItem[]
}
