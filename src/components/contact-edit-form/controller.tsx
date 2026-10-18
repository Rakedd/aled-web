import { type ContactDetails, validateContactDetailsInput } from '@/domain/entities'
import { findChangedFields, toFormText, toNullableText } from '@/domain/form-values'
import { type SavePlan, planJobApplicationUpdate, useBlockForm } from '@/lib/use-block-form'
import type {
  ContactEditFormControllerParameters,
  ContactEditFormValueName,
  ContactEditFormValues,
} from './interfaces'

const toFormValues = (contactName: string | null, contactDetails: ContactDetails | null): ContactEditFormValues => ({
  contactName: toFormText(contactName),
  phone: toFormText(contactDetails?.phone ?? null),
  email: toFormText(contactDetails?.email ?? null),
  linkedinUrl: toFormText(contactDetails?.linkedinUrl ?? null),
})

const toDetailsCandidate = (formValues: ContactEditFormValues) => ({
  phone: toNullableText(formValues.phone),
  email: toNullableText(formValues.email),
  linkedinUrl: toNullableText(formValues.linkedinUrl),
})

export const useController = ({
  jobApplication,
  contactDetails,
  updateJobApplication,
  updateContactDetails,
  onDataChanged,
  onClose,
}: ContactEditFormControllerParameters) => {
  const linkedContactDetails =
    contactDetails !== null && contactDetails.id === jobApplication.contactId ? contactDetails : null
  const { baselineFormValues, formValues, setFormValues, isSaving, errorMessage, save } = useBlockForm({
    serverFormValues: toFormValues(jobApplication.contactName, linkedContactDetails),
    onDataChanged,
    onClose,
  })

  const isContactNameEdited = formValues.contactName !== baselineFormValues.contactName

  const setFormValue = (valueName: ContactEditFormValueName, value: string) =>
    setFormValues((currentFormValues) => {
      const isLinkingAnotherContact = valueName === 'contactName' && value !== baselineFormValues.contactName
      return isLinkingAnotherContact
        ? { ...baselineFormValues, contactName: value }
        : { ...currentFormValues, [valueName]: value }
    })

  const planContactSave = (): SavePlan => {
    const changedContactName = findChangedFields(
      { contactName: toNullableText(baselineFormValues.contactName) },
      { contactName: toNullableText(formValues.contactName) },
    )
    if (Object.keys(changedContactName).length > 0) {
      return planJobApplicationUpdate(changedContactName, (validatedInput) =>
        updateJobApplication(jobApplication.id, validatedInput),
      )
    }
    const detailsCandidate = toDetailsCandidate(formValues)
    const changedDetails = findChangedFields(toDetailsCandidate(baselineFormValues), detailsCandidate)
    if (linkedContactDetails === null || Object.keys(changedDetails).length === 0) return { ok: true, data: [] }
    const validation = validateContactDetailsInput({ fullName: linkedContactDetails.fullName, ...detailsCandidate })
    if (!validation.ok) return validation
    return { ok: true, data: [() => updateContactDetails(linkedContactDetails.id, validation.data)] }
  }

  return {
    formValues,
    setFormValue,
    areContactDetailsDisabled: linkedContactDetails === null || isContactNameEdited,
    isContactNameEdited,
    isSaving,
    errorMessage,
    save: () => save(planContactSave),
    cancel: onClose,
  }
}
