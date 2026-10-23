import { validateIntermediaryKind } from '@/domain/entities'
import { findChangedFields, toFormText, toNullableText } from '@/domain/form-values'
import type { JobApplicationOverview } from '@/domain/job-application'
import { formatParisCalendarDate, parseParisCalendarDate } from '@/domain/paris-time'
import { findDuplicatePositioningRisksForFormValues } from '@/lib/duplicate-positioning-risks'
import { type SavePlan, planJobApplicationUpdate, useBlockForm } from '@/lib/use-block-form'
import type { HeaderEditFormControllerParameters, HeaderEditFormValueName, HeaderEditFormValues } from './interfaces'

const END_CLIENT_PARENT_FIELD_NAME = 'endClientParentName'

const toFormValues = (jobApplication: JobApplicationOverview): HeaderEditFormValues => ({
  title: jobApplication.title,
  source: toFormText(jobApplication.source),
  postingUrl: toFormText(jobApplication.postingUrl),
  intermediaryName: toFormText(jobApplication.intermediaryName),
  intermediaryKind: jobApplication.intermediaryKind ?? '',
  endClientName: toFormText(jobApplication.endClientName),
  endClientParentName: toFormText(jobApplication.endClientParentName),
  appliedOn: formatParisCalendarDate(jobApplication.appliedOn),
})

const toUpdateCandidate = (formValues: HeaderEditFormValues): Record<string, unknown> => ({
  title: formValues.title,
  source: toNullableText(formValues.source),
  postingUrl: toNullableText(formValues.postingUrl),
  intermediaryName: toNullableText(formValues.intermediaryName),
  endClientName: toNullableText(formValues.endClientName),
  endClientParentName: toNullableText(formValues.endClientParentName),
  appliedOn: parseParisCalendarDate(formValues.appliedOn),
})

const isOnlyEndClientParentCleared = (changedFields: Record<string, unknown>): boolean =>
  END_CLIENT_PARENT_FIELD_NAME in changedFields &&
  !('endClientName' in changedFields) &&
  changedFields[END_CLIENT_PARENT_FIELD_NAME] === null

const omitEndClientParent = (changedFields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(changedFields).filter(([fieldName]) => fieldName !== END_CLIENT_PARENT_FIELD_NAME))

export const useController = ({
  jobApplication,
  updateJobApplication,
  setEndClientParent,
  updateIntermediaryKind,
  positionedJobApplications,
  onDataChanged,
  onClose,
}: HeaderEditFormControllerParameters) => {
  const { baselineFormValues, formValues, setFormValues, isSaving, errorMessage, save } = useBlockForm({
    serverFormValues: toFormValues(jobApplication),
    onDataChanged,
    onClose,
  })

  const isIntermediaryKindDisabled =
    jobApplication.intermediaryId === null || formValues.intermediaryName !== baselineFormValues.intermediaryName

  const setFormValue = (valueName: HeaderEditFormValueName, value: string) =>
    setFormValues((currentFormValues) => ({
      ...currentFormValues,
      [valueName]: value,
      ...(valueName === 'endClientName' && value.trim().length === 0 ? { endClientParentName: '' } : {}),
      ...(valueName === 'intermediaryName' && value !== baselineFormValues.intermediaryName
        ? { intermediaryKind: baselineFormValues.intermediaryKind }
        : {}),
    }))

  const planHeaderSave = (): SavePlan => {
    const { endClientId, intermediaryId } = jobApplication
    const changedFields = findChangedFields(toUpdateCandidate(baselineFormValues), toUpdateCandidate(formValues))
    const shouldUnlinkEndClientParent = endClientId !== null && isOnlyEndClientParentCleared(changedFields)
    const updatePlan = planJobApplicationUpdate(
      shouldUnlinkEndClientParent ? omitEndClientParent(changedFields) : changedFields,
      (validatedInput) => updateJobApplication(jobApplication.id, validatedInput),
    )
    if (!updatePlan.ok) return updatePlan
    const saveSteps = [...updatePlan.data]
    if (shouldUnlinkEndClientParent && endClientId !== null) {
      saveSteps.push(() => setEndClientParent(endClientId, null))
    }
    const hasIntermediaryKindChanged = formValues.intermediaryKind !== baselineFormValues.intermediaryKind
    if (intermediaryId !== null && !isIntermediaryKindDisabled && hasIntermediaryKindChanged) {
      const intermediaryKindValidation = validateIntermediaryKind(formValues.intermediaryKind)
      if (!intermediaryKindValidation.ok) return intermediaryKindValidation
      saveSteps.push(() => updateIntermediaryKind(intermediaryId, intermediaryKindValidation.data))
    }
    return { ok: true, data: saveSteps }
  }

  return {
    formValues,
    setFormValue,
    isEndClientParentDisabled: formValues.endClientName.trim().length === 0,
    isIntermediaryKindDisabled,
    duplicatePositioningRisks: findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: jobApplication.id, ...formValues },
      positionedJobApplications,
    ),
    isSaving,
    errorMessage,
    save: () => save(planHeaderSave),
    cancel: onClose,
  }
}
