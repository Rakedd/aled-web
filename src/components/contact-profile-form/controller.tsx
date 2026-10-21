import { type ContactProfile, validateContactProfileInput } from '@/domain/contacts'
import { findChangedFields, toFormText, toNullableText } from '@/domain/form-values'
import { type SavePlan, useBlockForm } from '@/lib/use-block-form'
import type { ContactProfileFormControllerParameters, ContactProfileFormValues } from './interfaces'

const toFormValues = (profile: ContactProfile): ContactProfileFormValues => ({
  fullName: profile.fullName,
  intermediaryName: toFormText(profile.intermediaryName),
  phone: toFormText(profile.phone),
  email: toFormText(profile.email),
  linkedinUrl: toFormText(profile.linkedinUrl),
  referredBy: toFormText(profile.referredBy),
  notes: toFormText(profile.notes),
})

const toProfileCandidate = (formValues: ContactProfileFormValues) => ({
  fullName: formValues.fullName,
  intermediaryName: toNullableText(formValues.intermediaryName),
  phone: toNullableText(formValues.phone),
  email: toNullableText(formValues.email),
  linkedinUrl: toNullableText(formValues.linkedinUrl),
  referredBy: toNullableText(formValues.referredBy),
  notes: toNullableText(formValues.notes),
})

export const useController = ({
  profile,
  updateContactProfile,
  onDataChanged,
  onClose,
}: ContactProfileFormControllerParameters) => {
  const { baselineFormValues, formValues, setFormValue, isSaving, errorMessage, save } = useBlockForm({
    serverFormValues: toFormValues(profile),
    onDataChanged,
    onClose,
  })

  const planProfileSave = (): SavePlan => {
    const profileCandidate = toProfileCandidate(formValues)
    const changedFields = findChangedFields(toProfileCandidate(baselineFormValues), profileCandidate)
    if (Object.keys(changedFields).length === 0) return { ok: true, data: [] }
    const validation = validateContactProfileInput(profileCandidate)
    if (!validation.ok) return validation
    return { ok: true, data: [() => updateContactProfile(profile.id, validation.data)] }
  }

  return {
    formValues,
    setFormValue,
    isSaving,
    errorMessage,
    save: () => save(planProfileSave),
    cancel: onClose,
  }
}
