import {
  findDuplicatePositioningRisks,
  type PositionedJobApplication,
} from '@/domain/duplicate-positioning'
import { toNullableText } from '@/domain/form-values'
import { parseParisCalendarDate } from '@/domain/paris-time'

export type PositioningFormValues = {
  jobApplicationId: string | null
  endClientName: string
  endClientParentName: string
  intermediaryName: string
  appliedOn: string
}

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
