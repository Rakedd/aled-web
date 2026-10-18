import { useEffect, useRef, useState, useTransition } from 'react'
import { type ActionResult, guardActionCall } from '@/domain/action-result'
import { isSameFormValue, mergeUntouchedFormValues } from '@/domain/form-values'
import { type JobApplicationInput, validateJobApplicationUpdateInput } from '@/domain/job-application'

export type SaveStep = () => Promise<ActionResult<null>>

export type SavePlan = ActionResult<SaveStep[]>

export type BlockFormParameters<FormValues> = {
  serverFormValues: FormValues
  onDataChanged: () => void
  onClose: () => void
}

const NOTHING_TO_SAVE: SavePlan = { ok: true, data: [] }

export const planJobApplicationUpdate = (
  changedFields: Record<string, unknown>,
  sendUpdate: (validatedInput: Partial<JobApplicationInput>) => Promise<ActionResult<null>>,
): SavePlan => {
  if (Object.keys(changedFields).length === 0) return NOTHING_TO_SAVE
  const validation = validateJobApplicationUpdateInput(changedFields)
  if (!validation.ok) return validation
  return { ok: true, data: [() => sendUpdate(validation.data)] }
}

export const useBlockForm = <FormValues extends Record<string, unknown>>({
  serverFormValues,
  onDataChanged,
  onClose,
}: BlockFormParameters<FormValues>) => {
  const [baselineFormValues, setBaselineFormValues] = useState<FormValues>(serverFormValues)
  const [formValues, setFormValues] = useState<FormValues>(serverFormValues)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, startRefreshTransition] = useTransition()
  const isSaveInFlightRef = useRef(false)
  const shouldCloseAfterRefreshRef = useRef(false)

  if (!isSameFormValue(serverFormValues, baselineFormValues)) {
    setBaselineFormValues(serverFormValues)
    setFormValues(mergeUntouchedFormValues(baselineFormValues, serverFormValues, formValues))
  }

  useEffect(() => {
    if (isRefreshing || !shouldCloseAfterRefreshRef.current) return
    shouldCloseAfterRefreshRef.current = false
    onClose()
  }, [isRefreshing, onClose])

  const refreshData = () => startRefreshTransition(() => onDataChanged())

  const setFormValue = <ValueName extends keyof FormValues>(valueName: ValueName, value: FormValues[ValueName]) =>
    setFormValues((currentFormValues) => ({ ...currentFormValues, [valueName]: value }))

  const finishSaving = () => {
    isSaveInFlightRef.current = false
    setIsSaving(false)
  }

  const save = async (planSave: () => SavePlan) => {
    if (isSaveInFlightRef.current || shouldCloseAfterRefreshRef.current) return
    setErrorMessage(null)
    const savePlan = planSave()
    if (!savePlan.ok) {
      setErrorMessage(savePlan.errorMessage)
      return
    }
    if (savePlan.data.length === 0) {
      onClose()
      return
    }
    isSaveInFlightRef.current = true
    setIsSaving(true)
    let hasSavedAnyStep = false
    for (const saveStep of savePlan.data) {
      const stepResult = await guardActionCall(saveStep)
      if (!stepResult.ok) {
        finishSaving()
        setErrorMessage(stepResult.errorMessage)
        if (hasSavedAnyStep) refreshData()
        return
      }
      hasSavedAnyStep = true
    }
    finishSaving()
    shouldCloseAfterRefreshRef.current = true
    refreshData()
  }

  return {
    baselineFormValues,
    formValues,
    setFormValues,
    setFormValue,
    isSaving: isSaving || isRefreshing,
    errorMessage,
    save,
  }
}
