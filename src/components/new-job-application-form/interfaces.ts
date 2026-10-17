import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationInput } from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import type { JobPostingExtraction } from '@/domain/job-posting-extraction'
import type { StackItem } from '@/domain/types'
import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'

export type ExtractJobPosting = (rawText: string) => Promise<ActionResult<JobPostingExtraction>>

export type CreateJobApplication = (input: JobApplicationInput) => Promise<ActionResult<{ id: string }>>

export type NewJobApplicationStep = 'paste' | 'form'

export type JobApplicationFormValues = {
  title: string
  source: string
  postingUrl: string
  postingRawText: string
  status: JobApplicationStatus
  intermediaryName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  endClientName: string
  endClientParentName: string
  postedDailyRate: string
  location: string
  remotePolicy: string
  desiredStart: string
  duration: string
  appliedOn: string
  stack: StackItem[]
}

export type TextFormValueName = Exclude<keyof JobApplicationFormValues, 'stack' | 'status'>

export type NewJobApplicationFormControllerParameters = {
  extractJobPosting: ExtractJobPosting
  createJobApplication: CreateJobApplication
  navigateTo: (path: string) => void
  hasAnthropicApiKey: boolean
}

export type NewJobApplicationFormProps = Omit<NewJobApplicationFormControllerParameters, 'navigateTo'> & {
  searchEntities: SearchEntities
}
