import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { type ContactProfileInput, validateContactProfileInput } from '@/domain/contacts'
import { contactRoute } from '@/domain/routes'
import type { NewContactFormControllerParameters, NewContactFormValues } from './interfaces'

const EMPTY_FORM_VALUES: NewContactFormValues = {
  fullName: '',
  intermediaryName: '',
  phone: '',
  email: '',
  linkedinUrl: '',
}

const toNullableText = (text: string): string | null => (text.trim().length === 0 ? null : text)

const toContactProfileCandidate = (formValues: NewContactFormValues) => ({
  fullName: formValues.fullName,
  phone: toNullableText(formValues.phone),
  email: toNullableText(formValues.email),
  linkedinUrl: toNullableText(formValues.linkedinUrl),
  intermediaryName: toNullableText(formValues.intermediaryName),
  referredBy: null,
  notes: null,
})

export const useController = ({ createContact, navigateTo }: NewContactFormControllerParameters) => {
  const [formValues, setFormValues] = useState<NewContactFormValues>(EMPTY_FORM_VALUES)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmissionInFlightRef = useRef(false)

  const setFormValue = (valueName: keyof NewContactFormValues, value: string) =>
    setFormValues((currentFormValues) => ({ ...currentFormValues, [valueName]: value }))

  const createFromValidatedInput = async (validatedInput: ContactProfileInput) => {
    try {
      return await createContact(validatedInput)
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE } as const
    }
  }

  const submit = async () => {
    if (isSubmissionInFlightRef.current) return
    setErrorMessage(null)
    const validationResult = validateContactProfileInput(toContactProfileCandidate(formValues))
    if (!validationResult.ok) {
      setErrorMessage(validationResult.errorMessage)
      return
    }
    isSubmissionInFlightRef.current = true
    setIsSubmitting(true)
    const creationResult = await createFromValidatedInput(validationResult.data)
    if (!creationResult.ok) {
      setErrorMessage(creationResult.errorMessage)
      setIsSubmitting(false)
      isSubmissionInFlightRef.current = false
      return
    }
    navigateTo(contactRoute(creationResult.data.id))
  }

  return { formValues, errorMessage, isSubmitting, setFormValue, submit }
}
