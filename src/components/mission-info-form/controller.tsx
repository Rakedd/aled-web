import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { validateContactDetailsInput } from '@/domain/entities'
import { validateJobApplicationUpdateInput, type JobApplicationOverview } from '@/domain/job-application'
import { formatParisCalendarDate, parseParisCalendarDate } from '@/domain/paris-time'
import type { StackItem } from '@/domain/types'
import type {
  ContactFormValueName,
  ContactFormValues,
  MissionInfoFormControllerParameters,
  MissionInfoFormValues,
  MissionInfoTextValueName,
} from './interfaces'

const toText = (value: string | null): string => value ?? ''

const toFormValues = (jobApplication: JobApplicationOverview): MissionInfoFormValues => ({
  title: jobApplication.title,
  source: toText(jobApplication.source),
  postingUrl: toText(jobApplication.postingUrl),
  postedDailyRate: jobApplication.postedDailyRate === null ? '' : String(jobApplication.postedDailyRate),
  requestedDailyRate: jobApplication.requestedDailyRate === null ? '' : String(jobApplication.requestedDailyRate),
  location: toText(jobApplication.location),
  remotePolicy: toText(jobApplication.remotePolicy),
  desiredStart: toText(jobApplication.desiredStart),
  duration: toText(jobApplication.duration),
  appliedOn: formatParisCalendarDate(jobApplication.appliedOn),
  actualStartDate:
    jobApplication.actualStartDate === null ? '' : formatParisCalendarDate(jobApplication.actualStartDate),
  notes: toText(jobApplication.notes),
  intermediaryName: toText(jobApplication.intermediaryName),
  contactName: toText(jobApplication.contactName),
  endClientName: toText(jobApplication.endClientName),
  endClientParentName: toText(jobApplication.endClientParentName),
  stack: jobApplication.stack,
})

const TEXT_VALUE_NAMES: readonly MissionInfoTextValueName[] = [
  'title',
  'source',
  'postingUrl',
  'postedDailyRate',
  'requestedDailyRate',
  'location',
  'remotePolicy',
  'desiredStart',
  'duration',
  'appliedOn',
  'actualStartDate',
  'notes',
  'intermediaryName',
  'contactName',
  'endClientName',
  'endClientParentName',
]

const mergeServerChanges = (
  previousBaseline: MissionInfoFormValues,
  nextBaseline: MissionInfoFormValues,
  currentFormValues: MissionInfoFormValues,
): MissionInfoFormValues => {
  const mergedFormValues: MissionInfoFormValues = { ...currentFormValues }
  for (const valueName of TEXT_VALUE_NAMES) {
    if (currentFormValues[valueName] === previousBaseline[valueName])
      mergedFormValues[valueName] = nextBaseline[valueName]
  }
  if (JSON.stringify(currentFormValues.stack) === JSON.stringify(previousBaseline.stack)) {
    mergedFormValues.stack = nextBaseline.stack
  }
  return mergedFormValues
}

const toNullableText = (text: string): string | null => (text.trim().length === 0 ? null : text)

const toNullableDailyRate = (dailyRateText: string): number | null =>
  dailyRateText.trim().length === 0 ? null : Number(dailyRateText)

const toNullableParisDate = (calendarDate: string): Date | null =>
  calendarDate.length === 0 ? null : parseParisCalendarDate(calendarDate)

const toUpdateCandidate = (formValues: MissionInfoFormValues): Record<string, unknown> => ({
  title: formValues.title,
  source: toNullableText(formValues.source),
  postingUrl: toNullableText(formValues.postingUrl),
  postedDailyRate: toNullableDailyRate(formValues.postedDailyRate),
  requestedDailyRate: toNullableDailyRate(formValues.requestedDailyRate),
  location: toNullableText(formValues.location),
  remotePolicy: toNullableText(formValues.remotePolicy),
  desiredStart: toNullableText(formValues.desiredStart),
  duration: toNullableText(formValues.duration),
  appliedOn: parseParisCalendarDate(formValues.appliedOn),
  actualStartDate: toNullableParisDate(formValues.actualStartDate),
  notes: toNullableText(formValues.notes),
  intermediaryName: toNullableText(formValues.intermediaryName),
  contactName: toNullableText(formValues.contactName),
  endClientName: toNullableText(formValues.endClientName),
  endClientParentName: toNullableText(formValues.endClientParentName),
  stack: formValues.stack,
})

const isSameFieldValue = (firstValue: unknown, secondValue: unknown): boolean =>
  typeof firstValue === 'number' || typeof secondValue === 'number'
    ? Object.is(firstValue, secondValue)
    : JSON.stringify(firstValue) === JSON.stringify(secondValue)

const findChangedEntries = (
  initialFormValues: MissionInfoFormValues,
  currentFormValues: MissionInfoFormValues,
): [string, unknown][] => {
  const initialCandidate = toUpdateCandidate(initialFormValues)
  return Object.entries(toUpdateCandidate(currentFormValues)).filter(
    ([fieldName, fieldValue]) => !isSameFieldValue(fieldValue, initialCandidate[fieldName]),
  )
}

const toContactFormValues = (contactDetails: {
  phone: string | null
  email: string | null
  linkedinUrl: string | null
}): ContactFormValues => ({
  phone: toText(contactDetails.phone),
  email: toText(contactDetails.email),
  linkedinUrl: toText(contactDetails.linkedinUrl),
})

const guardServerCall = async (serverCall: () => Promise<ActionResult<null>>): Promise<ActionResult<null>> => {
  try {
    return await serverCall()
  } catch {
    return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
  }
}

type LoadedContact = {
  contactId: string
  fullName: string
  formValues: ContactFormValues
}

export const useController = ({
  jobApplication,
  updateJobApplication,
  setEndClientParent,
  getContactDetails,
  updateContactDetails,
  onDataChanged,
}: MissionInfoFormControllerParameters) => {
  const [baselineFormValues, setBaselineFormValues] = useState<MissionInfoFormValues>(() =>
    toFormValues(jobApplication),
  )
  const [formValues, setFormValues] = useState<MissionInfoFormValues>(baselineFormValues)
  const [syncedJobApplication, setSyncedJobApplication] = useState(jobApplication)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadedContact, setLoadedContact] = useState<LoadedContact | null>(null)
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [contactErrorMessage, setContactErrorMessage] = useState<string | null>(null)
  const isSaveInFlightRef = useRef(false)
  const isContactSaveInFlightRef = useRef(false)
  const getContactDetailsRef = useRef(getContactDetails)

  useEffect(() => {
    getContactDetailsRef.current = getContactDetails
  }, [getContactDetails])

  if (syncedJobApplication !== jobApplication) {
    const nextBaselineFormValues = toFormValues(jobApplication)
    setSyncedJobApplication(jobApplication)
    setBaselineFormValues(nextBaselineFormValues)
    setFormValues(mergeServerChanges(baselineFormValues, nextBaselineFormValues, formValues))
  }

  const { contactId } = jobApplication
  const currentLoadedContact = loadedContact !== null && loadedContact.contactId === contactId ? loadedContact : null
  const changedEntries = findChangedEntries(baselineFormValues, formValues)

  useEffect(() => {
    if (contactId === null) return
    let isCancelled = false
    const loadContact = async () => {
      try {
        const contactResult = await getContactDetailsRef.current(contactId)
        if (isCancelled) return
        if (!contactResult.ok) {
          setContactErrorMessage(contactResult.errorMessage)
          return
        }
        setContactErrorMessage(null)
        setLoadedContact({
          contactId,
          fullName: contactResult.data.fullName,
          formValues: toContactFormValues(contactResult.data),
        })
      } catch {
        if (!isCancelled) setContactErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
      }
    }
    void loadContact()
    return () => {
      isCancelled = true
    }
  }, [contactId])

  const setTextFormValue = (valueName: MissionInfoTextValueName, value: string) =>
    setFormValues((currentFormValues) => ({
      ...currentFormValues,
      [valueName]: value,
      ...(valueName === 'endClientName' && value.trim().length === 0 ? { endClientParentName: '' } : {}),
    }))

  const setStack = (stack: StackItem[]) => setFormValues((currentFormValues) => ({ ...currentFormValues, stack }))

  const shouldUnlinkEndClientParent = (): boolean =>
    jobApplication.endClientId !== null &&
    changedEntries.some(([fieldName]) => fieldName === 'endClientParentName') &&
    !changedEntries.some(([fieldName]) => fieldName === 'endClientName') &&
    toNullableText(formValues.endClientParentName) === null

  const save = async () => {
    if (isSaveInFlightRef.current || changedEntries.length === 0) return
    setErrorMessage(null)
    const shouldUnlink = shouldUnlinkEndClientParent()
    const updateEntries = shouldUnlink
      ? changedEntries.filter(([fieldName]) => fieldName !== 'endClientParentName')
      : changedEntries
    const validation = validateJobApplicationUpdateInput(Object.fromEntries(updateEntries))
    if (!validation.ok) {
      setErrorMessage(validation.errorMessage)
      return
    }
    isSaveInFlightRef.current = true
    setIsSaving(true)
    let saveResult: ActionResult<null> = { ok: true, data: null }
    if (updateEntries.length > 0) {
      saveResult = await guardServerCall(() => updateJobApplication(jobApplication.id, validation.data))
    }
    if (saveResult.ok && shouldUnlink && jobApplication.endClientId !== null) {
      const endClientId = jobApplication.endClientId
      saveResult = await guardServerCall(() => setEndClientParent(endClientId, null))
    }
    isSaveInFlightRef.current = false
    setIsSaving(false)
    if (!saveResult.ok) {
      setErrorMessage(saveResult.errorMessage)
      return
    }
    onDataChanged()
  }

  const setContactFormValue = (valueName: ContactFormValueName, value: string) =>
    setLoadedContact((currentLoadedContact) =>
      currentLoadedContact === null
        ? null
        : {
            ...currentLoadedContact,
            formValues: {
              ...currentLoadedContact.formValues,
              [valueName]: value,
            },
          },
    )

  const saveContact = async () => {
    if (isContactSaveInFlightRef.current || currentLoadedContact === null) return
    setContactErrorMessage(null)
    const validation = validateContactDetailsInput({
      fullName: currentLoadedContact.fullName,
      phone: toNullableText(currentLoadedContact.formValues.phone),
      email: toNullableText(currentLoadedContact.formValues.email),
      linkedinUrl: toNullableText(currentLoadedContact.formValues.linkedinUrl),
    })
    if (!validation.ok) {
      setContactErrorMessage(validation.errorMessage)
      return
    }
    isContactSaveInFlightRef.current = true
    setIsSavingContact(true)
    const saveResult = await guardServerCall(() =>
      updateContactDetails(currentLoadedContact.contactId, validation.data),
    )
    isContactSaveInFlightRef.current = false
    setIsSavingContact(false)
    if (!saveResult.ok) {
      setContactErrorMessage(saveResult.errorMessage)
      return
    }
    onDataChanged()
  }

  return {
    formValues,
    setTextFormValue,
    setStack,
    hasChanges: changedEntries.length > 0,
    isEndClientParentDisabled: formValues.endClientName.trim().length === 0,
    isSaving,
    errorMessage,
    save,
    isContactLoaded: currentLoadedContact !== null,
    contactFormValues: currentLoadedContact?.formValues ?? null,
    setContactFormValue,
    isSavingContact,
    contactErrorMessage,
    saveContact,
  }
}
