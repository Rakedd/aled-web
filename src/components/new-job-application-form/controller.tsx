import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { MAX_PASTED_TEXT_LENGTH, type JobPostingExtraction } from '@/domain/job-posting-extraction'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import type { ContactDetailFieldName } from '@/domain/contacts'
import type { EntitySuggestion } from '@/domain/entities'
import { toNullableText } from '@/domain/form-values'
import { type JobApplicationInput, validateJobApplicationInput } from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { formatParisCalendarDate, parseParisCalendarDate } from '@/domain/paris-time'
import { jobApplicationRoute } from '@/domain/routes'
import type { StackItem } from '@/domain/types'
import type {
  JobApplicationFormValues,
  NewJobApplicationFormControllerParameters,
  NewJobApplicationStep,
  TextFormValueName,
} from './interfaces'

export const EMPTY_PASTED_TEXT_MESSAGE = "Colle le texte de l'annonce ou passe en saisie manuelle"

const createEmptyFormValues = (): JobApplicationFormValues => ({
  title: '',
  source: '',
  postingUrl: '',
  postingRawText: '',
  status: 'applied',
  intermediaryName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactLinkedinUrl: '',
  endClientName: '',
  endClientParentName: '',
  postedDailyRate: '',
  location: '',
  remotePolicy: '',
  desiredStart: '',
  duration: '',
  appliedOn: formatParisCalendarDate(new Date()),
  stack: [],
})

const toFormValues = (
  baseFormValues: JobApplicationFormValues,
  jobPostingExtraction: JobPostingExtraction,
): JobApplicationFormValues => ({
  ...baseFormValues,
  title: jobPostingExtraction.title ?? '',
  intermediaryName: jobPostingExtraction.intermediaryName ?? '',
  contactName: jobPostingExtraction.contactName ?? '',
  contactEmail: jobPostingExtraction.contactEmail ?? '',
  contactPhone: jobPostingExtraction.contactPhone ?? '',
  endClientName: jobPostingExtraction.endClientName ?? '',
  postedDailyRate: jobPostingExtraction.postedDailyRate === null ? '' : String(jobPostingExtraction.postedDailyRate),
  location: jobPostingExtraction.location ?? '',
  remotePolicy: jobPostingExtraction.remotePolicy ?? '',
  desiredStart: jobPostingExtraction.desiredStart ?? '',
  duration: jobPostingExtraction.duration ?? '',
  stack: jobPostingExtraction.stack,
})

const CONTACT_DETAIL_FIELD_BY_FORM_VALUE_NAME: Partial<Record<TextFormValueName, ContactDetailFieldName>> = {
  contactPhone: 'phone',
  contactEmail: 'email',
  contactLinkedinUrl: 'linkedinUrl',
}

const toNullableDailyRate = (dailyRateText: string): number | null =>
  dailyRateText.trim().length === 0 ? null : Number(dailyRateText)

const toJobApplicationCandidate = (
  formValues: JobApplicationFormValues,
  userEditedContactFields: ContactDetailFieldName[],
) => ({
  title: formValues.title,
  source: toNullableText(formValues.source),
  postingUrl: toNullableText(formValues.postingUrl),
  postingRawText: toNullableText(formValues.postingRawText),
  status: formValues.status,
  postedDailyRate: toNullableDailyRate(formValues.postedDailyRate),
  requestedDailyRate: null,
  location: toNullableText(formValues.location),
  remotePolicy: toNullableText(formValues.remotePolicy),
  desiredStart: toNullableText(formValues.desiredStart),
  duration: toNullableText(formValues.duration),
  appliedOn: parseParisCalendarDate(formValues.appliedOn),
  notes: null,
  actualStartDate: null,
  stack: formValues.stack,
  intermediaryName: toNullableText(formValues.intermediaryName),
  contactName: toNullableText(formValues.contactName),
  contactEmail: toNullableText(formValues.contactEmail),
  contactPhone: toNullableText(formValues.contactPhone),
  contactLinkedinUrl: toNullableText(formValues.contactLinkedinUrl),
  userEditedContactFields,
  endClientName: toNullableText(formValues.endClientName),
  endClientParentName: toNullableText(formValues.endClientParentName),
})

export const useController = ({
  extractJobPosting,
  createJobApplication,
  navigateTo,
  hasAnthropicApiKey,
}: NewJobApplicationFormControllerParameters) => {
  const [step, setStep] = useState<NewJobApplicationStep>('paste')
  const [pastedText, setPastedText] = useState('')
  const [formValues, setFormValues] = useState<JobApplicationFormValues>(createEmptyFormValues)
  const [userEditedContactFields, setUserEditedContactFields] = useState<ContactDetailFieldName[]>([])
  const [isContactPrefilledFromSuggestion, setIsContactPrefilledFromSuggestion] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [hasExtractionFailed, setHasExtractionFailed] = useState(false)
  const [isPrefilledByClaude, setIsPrefilledByClaude] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isExtractionInFlightRef = useRef(false)
  const isSubmissionInFlightRef = useRef(false)

  const showForm = (initialFormValues: JobApplicationFormValues, initialErrorMessage: string | null) => {
    setFormValues(initialFormValues)
    setUserEditedContactFields([])
    setIsContactPrefilledFromSuggestion(false)
    setErrorMessage(initialErrorMessage)
    setStep('form')
  }

  const readExtractionOutcome = async (baseFormValues: JobApplicationFormValues) => {
    try {
      const extractionResult = await extractJobPosting(baseFormValues.postingRawText.trim())
      return extractionResult.ok
        ? { formValues: toFormValues(baseFormValues, extractionResult.data), errorMessage: null }
        : { formValues: baseFormValues, errorMessage: extractionResult.errorMessage }
    } catch {
      return { formValues: baseFormValues, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
    }
  }

  const extract = async () => {
    if (!hasAnthropicApiKey || isExtractionInFlightRef.current) return
    const baseFormValues = step === 'paste' ? { ...formValues, postingRawText: pastedText } : formValues
    const trimmedPastedText = baseFormValues.postingRawText.trim()
    if (trimmedPastedText.length === 0) {
      setErrorMessage(EMPTY_PASTED_TEXT_MESSAGE)
      return
    }
    if (trimmedPastedText.length > MAX_PASTED_TEXT_LENGTH) {
      setErrorMessage(AI_ERROR_MESSAGES.input_too_long)
      return
    }
    isExtractionInFlightRef.current = true
    setErrorMessage(null)
    setIsExtracting(true)
    const extractionOutcome = await readExtractionOutcome(baseFormValues)
    isExtractionInFlightRef.current = false
    setIsExtracting(false)
    setHasExtractionFailed(extractionOutcome.errorMessage !== null)
    setIsPrefilledByClaude(extractionOutcome.errorMessage === null)
    showForm(extractionOutcome.formValues, extractionOutcome.errorMessage)
  }

  const switchToManualEntry = () => {
    setHasExtractionFailed(false)
    setIsPrefilledByClaude(false)
    showForm({ ...createEmptyFormValues(), postingRawText: pastedText.trim().length === 0 ? '' : pastedText }, null)
  }

  const setTextFormValue = (valueName: TextFormValueName, value: string) => {
    const editedContactField = CONTACT_DETAIL_FIELD_BY_FORM_VALUE_NAME[valueName]
    if (editedContactField !== undefined) {
      setUserEditedContactFields((currentFields) =>
        currentFields.includes(editedContactField) ? currentFields : [...currentFields, editedContactField],
      )
    }
    const shouldClearPrefilledContactDetails = valueName === 'contactName' && isContactPrefilledFromSuggestion
    if (shouldClearPrefilledContactDetails) setIsContactPrefilledFromSuggestion(false)
    setFormValues((currentFormValues) => ({
      ...currentFormValues,
      ...(shouldClearPrefilledContactDetails && {
        contactPhone: userEditedContactFields.includes('phone') ? currentFormValues.contactPhone : '',
        contactEmail: userEditedContactFields.includes('email') ? currentFormValues.contactEmail : '',
        contactLinkedinUrl: userEditedContactFields.includes('linkedinUrl') ? currentFormValues.contactLinkedinUrl : '',
      }),
      [valueName]: value,
    }))
  }

  const selectContactSuggestion = (suggestion: EntitySuggestion) => {
    setUserEditedContactFields([])
    setIsContactPrefilledFromSuggestion(true)
    setFormValues((currentFormValues) => ({
      ...currentFormValues,
      contactPhone: suggestion.contactDetails?.phone ?? '',
      contactEmail: suggestion.contactDetails?.email ?? '',
      contactLinkedinUrl: suggestion.contactDetails?.linkedinUrl ?? '',
    }))
  }

  const setStatus = (status: JobApplicationStatus) =>
    setFormValues((currentFormValues) => ({ ...currentFormValues, status }))

  const setStack = (stack: StackItem[]) => setFormValues((currentFormValues) => ({ ...currentFormValues, stack }))

  const createFromValidatedInput = async (validatedInput: JobApplicationInput) => {
    try {
      return await createJobApplication(validatedInput, null)
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE } as const
    }
  }

  const submit = async () => {
    if (isSubmissionInFlightRef.current) return
    setErrorMessage(null)
    const validationResult = validateJobApplicationInput(toJobApplicationCandidate(formValues, userEditedContactFields))
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
    navigateTo(jobApplicationRoute(creationResult.data.id))
  }

  return {
    step,
    pastedText,
    setPastedText,
    formValues,
    errorMessage,
    isExtracting,
    hasExtractionFailed,
    isPrefilledByClaude,
    isSubmitting,
    extract,
    switchToManualEntry,
    setTextFormValue,
    selectContactSuggestion,
    userEditedContactFields,
    setStatus,
    setStack,
    submit,
  }
}
