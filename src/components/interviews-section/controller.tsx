import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { type Interview, sortInterviewsByStartsAt, validateInterviewInput } from '@/domain/interviews'
import { formatParisLocalDateTime } from '@/domain/paris-time'
import type { InterviewEditorTarget, InterviewFormValues, InterviewsSectionControllerParameters } from './interfaces'

type ReloadedInterviews = { initialInterviewsAtReload: Interview[]; interviews: Interview[] }

const EMPTY_FORM_VALUES: InterviewFormValues = {
  parisLocalDateTime: '',
  kind: 'client',
  format: 'video',
  participants: '',
  notes: '',
}

const toFormValues = (interview: Interview): InterviewFormValues => ({
  parisLocalDateTime: formatParisLocalDateTime(interview.startsAt),
  kind: interview.kind,
  format: interview.format,
  participants: interview.participants ?? '',
  notes: interview.notes ?? '',
})

export const useController = ({
  jobApplicationId,
  initialInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  listInterviewsForJobApplication,
  onDataChanged,
}: InterviewsSectionControllerParameters) => {
  const [reloadedInterviews, setReloadedInterviews] = useState<ReloadedInterviews | null>(null)
  const [editorTarget, setEditorTarget] = useState<InterviewEditorTarget | null>(null)
  const [formValues, setFormValues] = useState<InterviewFormValues>(EMPTY_FORM_VALUES)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isRequestInFlightRef = useRef(false)

  const visibleInterviews =
    reloadedInterviews !== null && reloadedInterviews.initialInterviewsAtReload === initialInterviews
      ? reloadedInterviews.interviews
      : initialInterviews

  const reloadInterviews = async () => {
    try {
      const listResult = await listInterviewsForJobApplication(jobApplicationId)
      if (listResult.ok) setReloadedInterviews({ initialInterviewsAtReload: initialInterviews, interviews: listResult.data })
    } catch {
      return
    }
  }

  const runExclusiveMutation = async <ResultData,>(mutation: () => Promise<ActionResult<ResultData>>): Promise<boolean> => {
    if (isRequestInFlightRef.current) return false
    isRequestInFlightRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    let mutationResult: ActionResult<ResultData>
    try {
      mutationResult = await mutation()
    } catch {
      mutationResult = { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
    }
    if (mutationResult.ok) {
      await reloadInterviews()
    } else {
      setErrorMessage(mutationResult.errorMessage)
    }
    isRequestInFlightRef.current = false
    setIsSubmitting(false)
    if (mutationResult.ok) onDataChanged()
    return mutationResult.ok
  }

  const startCreating = () => {
    setEditorTarget({ mode: 'create' })
    setFormValues(EMPTY_FORM_VALUES)
    setErrorMessage(null)
  }

  const startEditing = (interview: Interview) => {
    setEditorTarget({ mode: 'edit', interviewId: interview.id })
    setFormValues(toFormValues(interview))
    setErrorMessage(null)
  }

  const cancelEditing = () => {
    setEditorTarget(null)
    setErrorMessage(null)
  }

  const setFormValue = <FieldName extends keyof InterviewFormValues>(
    fieldName: FieldName,
    fieldValue: InterviewFormValues[FieldName],
  ) => {
    setFormValues((currentFormValues) => ({ ...currentFormValues, [fieldName]: fieldValue }))
  }

  const submitInterview = async () => {
    if (editorTarget === null || isRequestInFlightRef.current) return
    const validation = validateInterviewInput(formValues)
    if (!validation.ok) {
      setErrorMessage(validation.errorMessage)
      return
    }
    const interviewInput = {
      parisLocalDateTime: formValues.parisLocalDateTime,
      kind: validation.data.kind,
      format: validation.data.format,
      participants: validation.data.participants,
      notes: validation.data.notes,
    }
    const isSaved = await runExclusiveMutation(() =>
      editorTarget.mode === 'create'
        ? createInterview(jobApplicationId, interviewInput)
        : updateInterview(editorTarget.interviewId, interviewInput),
    )
    if (isSaved) setEditorTarget(null)
  }

  const removeInterview = async (interviewId: string) => {
    const isDeleted = await runExclusiveMutation(() => deleteInterview(interviewId))
    if (isDeleted && editorTarget?.mode === 'edit' && editorTarget.interviewId === interviewId) setEditorTarget(null)
  }

  return {
    interviews: sortInterviewsByStartsAt(visibleInterviews),
    editorTarget,
    formValues,
    isSubmitting,
    errorMessage,
    startCreating,
    startEditing,
    cancelEditing,
    setFormValue,
    submitInterview,
    removeInterview,
  }
}
