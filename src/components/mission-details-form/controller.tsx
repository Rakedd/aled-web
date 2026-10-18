import {
  findChangedFields,
  toDailyRateText,
  toFormText,
  toNullableDailyRate,
  toNullableParisDate,
  toNullableText,
} from '@/domain/form-values'
import type { JobApplicationOverview } from '@/domain/job-application'
import { formatParisCalendarDate } from '@/domain/paris-time'
import { planJobApplicationUpdate, useBlockForm } from '@/lib/use-block-form'
import type { MissionDetailsFormControllerParameters, MissionDetailsFormValues } from './interfaces'

const toFormValues = (jobApplication: JobApplicationOverview): MissionDetailsFormValues => ({
  postedDailyRate: toDailyRateText(jobApplication.postedDailyRate),
  requestedDailyRate: toDailyRateText(jobApplication.requestedDailyRate),
  location: toFormText(jobApplication.location),
  remotePolicy: toFormText(jobApplication.remotePolicy),
  desiredStart: toFormText(jobApplication.desiredStart),
  actualStartDate:
    jobApplication.actualStartDate === null ? '' : formatParisCalendarDate(jobApplication.actualStartDate),
  duration: toFormText(jobApplication.duration),
  notes: toFormText(jobApplication.notes),
})

const toUpdateCandidate = (formValues: MissionDetailsFormValues): Record<string, unknown> => ({
  postedDailyRate: toNullableDailyRate(formValues.postedDailyRate),
  requestedDailyRate: toNullableDailyRate(formValues.requestedDailyRate),
  location: toNullableText(formValues.location),
  remotePolicy: toNullableText(formValues.remotePolicy),
  desiredStart: toNullableText(formValues.desiredStart),
  actualStartDate: toNullableParisDate(formValues.actualStartDate),
  duration: toNullableText(formValues.duration),
  notes: toNullableText(formValues.notes),
})

export const useController = ({
  jobApplication,
  updateJobApplication,
  onDataChanged,
  onClose,
}: MissionDetailsFormControllerParameters) => {
  const { baselineFormValues, formValues, setFormValue, isSaving, errorMessage, save } = useBlockForm({
    serverFormValues: toFormValues(jobApplication),
    onDataChanged,
    onClose,
  })

  const saveChangedFields = () =>
    save(() =>
      planJobApplicationUpdate(
        findChangedFields(toUpdateCandidate(baselineFormValues), toUpdateCandidate(formValues)),
        (validatedInput) => updateJobApplication(jobApplication.id, validatedInput),
      ),
    )

  return {
    formValues,
    setFormValue,
    isSaving,
    errorMessage,
    save: saveChangedFields,
    cancel: onClose,
  }
}
