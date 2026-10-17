import type { ActionResult } from '@/domain/action-result'
import type { Interview, InterviewInput } from '@/domain/interviews'
import type { InterviewFormat, InterviewKind } from '@/domain/types'

export type CreateInterview = (jobApplicationId: string, input: InterviewInput) => Promise<ActionResult<{ id: string }>>

export type UpdateInterview = (interviewId: string, input: InterviewInput) => Promise<ActionResult<null>>

export type DeleteInterview = (interviewId: string) => Promise<ActionResult<null>>

export type ListInterviewsForJobApplication = (jobApplicationId: string) => Promise<ActionResult<Interview[]>>

export type InterviewFormValues = {
  parisLocalDateTime: string
  kind: InterviewKind
  format: InterviewFormat
  participants: string
  notes: string
}

export type InterviewEditorTarget = { mode: 'create' } | { mode: 'edit'; interviewId: string }

export type InterviewsSectionControllerParameters = {
  jobApplicationId: string
  initialInterviews: Interview[]
  createInterview: CreateInterview
  updateInterview: UpdateInterview
  deleteInterview: DeleteInterview
  listInterviewsForJobApplication: ListInterviewsForJobApplication
  onDataChanged: () => void
}

export type InterviewsSectionProps = Omit<InterviewsSectionControllerParameters, 'onDataChanged'>
