import {
  findDuplicatePositioningRisks,
  type PositionedJobApplication,
} from '@/domain/duplicate-positioning'
import type { JobApplicationListItem } from '@/domain/job-application'
import { toNullableText } from '@/domain/form-values'
import { parseParisCalendarDate } from '@/domain/paris-time'

export type PositioningFormValues = {
  jobApplicationId: string | null
  endClientName: string
  endClientParentName: string
  intermediaryName: string
  appliedOn: string
}

export const toPositionedJobApplications = (jobApplications: JobApplicationListItem[]): PositionedJobApplication[] =>
  jobApplications.map((jobApplication) => ({
    id: jobApplication.id,
    title: jobApplication.title,
    endClientName: jobApplication.endClientName,
    endClientParentName: jobApplication.endClientParentName,
    intermediaryName: jobApplication.intermediaryName,
    appliedOn: jobApplication.appliedOn,
  }))

export const findDuplicatePositioningRisksForFormValues = (
  formValues: PositioningFormValues,
  positionedJobApplications: PositionedJobApplication[],
): PositionedJobApplication[] => {
  const appliedOn = parseParisCalendarDate(formValues.appliedOn)
  if (Number.isNaN(appliedOn.getTime())) return []
  return findDuplicatePositioningRisks(
    {
      jobApplicationId: formValues.jobApplicationId,
      endClientName: toNullableText(formValues.endClientName),
      endClientParentName: toNullableText(formValues.endClientParentName),
      intermediaryName: toNullableText(formValues.intermediaryName),
      appliedOn,
    },
    positionedJobApplications,
  )
}
