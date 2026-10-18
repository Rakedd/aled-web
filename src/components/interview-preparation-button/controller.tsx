import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import type { NotesSaveStatus } from '@/components/interview-preparation-modal/interfaces'
import type { InterviewPreparationButtonControllerParameters } from './interfaces'

const NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS = 800
const GENERATE_LABEL = 'Générer le brief'
const VIEW_LABEL = 'Brief généré · voir mon brief'
const GENERATING_LABEL = "Génération… (jusqu'à 4 min)"

const runActionSafely = async <ResultData,>(
  request: () => Promise<ActionResult<ResultData>>,
): Promise<ActionResult<ResultData>> => {
  try {
    return await request()
  } catch {
    return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
  }
}

const isPreparationComplete = (preparation: InterviewPreparation): boolean =>
  preparation.questions !== null && (preparation.endClientId === null || preparation.brief !== null)

export const useController = ({
  jobApplicationId,
  initialPreparation,
  getInterviewPreparation,
  generateInterviewPreparation,
  updateEndClientNotes,
  hasAnthropicApiKey,
  onDataChanged,
}: InterviewPreparationButtonControllerParameters) => {
  const [preparation, setPreparation] = useState(initialPreparation)
  const [language, setLanguage] = useState<BriefLanguage>(initialPreparation.language)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notes, setNotes] = useState(initialPreparation.notes ?? '')
  const [notesSaveStatus, setNotesSaveStatus] = useState<NotesSaveStatus>('idle')
  const [notesErrorMessage, setNotesErrorMessage] = useState<string | null>(null)
  const isGenerationInFlightRef = useRef(false)
  const latestLanguageChangeNumberRef = useRef(0)
  const pendingNotesRef = useRef<string | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const latestNotesSaveRequestNumberRef = useRef(0)
  const unsavedNotesRequestCountRef = useRef(0)
  const isMountedRef = useRef(true)
  const notesSavingDependenciesRef = useRef({ endClientId: initialPreparation.endClientId, updateEndClientNotes })

  const isComplete = isPreparationComplete(preparation)

  useEffect(() => {
    notesSavingDependenciesRef.current = { endClientId: preparation.endClientId, updateEndClientNotes }
  })

  const showNotesSaveResult = (notesSaveResult: ActionResult<null>, requestNumber: number, savedNotes: string) => {
    const isLatestRequest = requestNumber === latestNotesSaveRequestNumberRef.current
    if (!isMountedRef.current || !isLatestRequest) return
    if (!notesSaveResult.ok && pendingNotesRef.current === null) pendingNotesRef.current = savedNotes
    setNotesSaveStatus(notesSaveResult.ok ? 'saved' : 'failed')
    setNotesErrorMessage(notesSaveResult.ok ? null : notesSaveResult.errorMessage)
  }

  const enqueueNotesSave = (notesToSave: string) => {
    const savingDependencies = notesSavingDependenciesRef.current
    if (savingDependencies.endClientId === null) return
    const { endClientId } = savingDependencies
    latestNotesSaveRequestNumberRef.current += 1
    unsavedNotesRequestCountRef.current += 1
    const requestNumber = latestNotesSaveRequestNumberRef.current
    notesSaveQueueRef.current = notesSaveQueueRef.current.then(async () => {
      if (isMountedRef.current && requestNumber === latestNotesSaveRequestNumberRef.current) setNotesSaveStatus('saving')
      const notesSaveResult = await runActionSafely(() => savingDependencies.updateEndClientNotes(endClientId, notesToSave))
      unsavedNotesRequestCountRef.current -= 1
      showNotesSaveResult(notesSaveResult, requestNumber, notesToSave)
    })
  }

  const flushPendingNotes = () => {
    if (autosaveTimerRef.current !== null) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = null
    if (pendingNotesRef.current === null) return
    const notesToSave = pendingNotesRef.current
    pendingNotesRef.current = null
    enqueueNotesSave(notesToSave)
  }

  const changeNotes = (updatedNotes: string) => {
    setNotes(updatedNotes)
    setNotesSaveStatus('unsaved')
    pendingNotesRef.current = updatedNotes
    if (autosaveTimerRef.current !== null) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(flushPendingNotes, NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS)
  }

  const flushPendingNotesRef = useRef(flushPendingNotes)

  useEffect(() => {
    flushPendingNotesRef.current = flushPendingNotes
  })

  useEffect(() => {
    isMountedRef.current = true
    const warnAboutUnsavedNotes = (beforeUnloadEvent: BeforeUnloadEvent) => {
      const hasUnsavedNotes = pendingNotesRef.current !== null || unsavedNotesRequestCountRef.current > 0
      if (hasUnsavedNotes) beforeUnloadEvent.preventDefault()
    }
    window.addEventListener('beforeunload', warnAboutUnsavedNotes)
    return () => {
      window.removeEventListener('beforeunload', warnAboutUnsavedNotes)
      flushPendingNotesRef.current()
      isMountedRef.current = false
    }
  }, [])

  const generate = async (languageToGenerate: BriefLanguage, regenerate: boolean) => {
    if (!hasAnthropicApiKey || isGenerationInFlightRef.current || isLoadingLanguage) return
    isGenerationInFlightRef.current = true
    latestLanguageChangeNumberRef.current += 1
    setIsGenerating(true)
    setErrorMessage(null)
    const generationResult = await runActionSafely(() =>
      generateInterviewPreparation(jobApplicationId, languageToGenerate, regenerate),
    )
    isGenerationInFlightRef.current = false
    setIsGenerating(false)
    if (!generationResult.ok) {
      setErrorMessage(generationResult.errorMessage)
      return
    }
    setPreparation(generationResult.data)
    setLanguage(languageToGenerate)
    setIsModalOpen(true)
    onDataChanged()
  }

  const changeLanguage = async (chosenLanguage: BriefLanguage) => {
    if (isGenerationInFlightRef.current || chosenLanguage === language) return
    const previousLanguage = language
    latestLanguageChangeNumberRef.current += 1
    const changeNumber = latestLanguageChangeNumberRef.current
    setLanguage(chosenLanguage)
    setErrorMessage(null)
    setIsLoadingLanguage(true)
    const loadResult = await runActionSafely(() => getInterviewPreparation(jobApplicationId, chosenLanguage))
    if (changeNumber !== latestLanguageChangeNumberRef.current) return
    setIsLoadingLanguage(false)
    if (!loadResult.ok) {
      setLanguage(previousLanguage)
      setErrorMessage(loadResult.errorMessage)
      return
    }
    setPreparation(loadResult.data)
  }

  const handleButtonClick = async () => {
    if (isGenerating || isLoadingLanguage) return
    if (isComplete) {
      setIsModalOpen(true)
      return
    }
    await generate(language, false)
  }

  const computeButtonLabel = (): string => {
    if (isGenerating) return GENERATING_LABEL
    return isComplete ? VIEW_LABEL : GENERATE_LABEL
  }

  return {
    preparation,
    language,
    changeLanguage,
    isGenerating,
    errorMessage,
    buttonLabel: computeButtonLabel(),
    isButtonDisabled: isGenerating || isLoadingLanguage || (!isComplete && !hasAnthropicApiKey),
    handleButtonClick,
    regenerate: (languageToGenerate: BriefLanguage) => generate(languageToGenerate, true),
    isModalOpen,
    closeModal: () => setIsModalOpen(false),
    notes,
    changeNotes,
    notesSaveStatus,
    notesErrorMessage,
    retryNotesSave: flushPendingNotes,
  }
}
