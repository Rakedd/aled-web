import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { GeneratedClientBrief } from '@/domain/client-brief'
import type { ClientBriefSectionControllerParameters, ClientBriefSectionState, NotesSaveStatus } from './interfaces'

const NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS = 800

const runActionSafely = async <ResultData,>(
  request: () => Promise<ActionResult<ResultData>>,
): Promise<ActionResult<ResultData>> => {
  try {
    return await request()
  } catch {
    return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
  }
}

export const useController = ({
  endClientBrief,
  generateBriefForEndClient,
  updateEndClientNotes,
  onDataChanged,
}: ClientBriefSectionControllerParameters) => {
  const [generatedBrief, setGeneratedBrief] = useState<GeneratedClientBrief | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notes, setNotes] = useState(endClientBrief?.notes ?? '')
  const [notesSaveStatus, setNotesSaveStatus] = useState<NotesSaveStatus>('idle')
  const [notesErrorMessage, setNotesErrorMessage] = useState<string | null>(null)
  const isGenerationInFlightRef = useRef(false)
  const pendingNotesRef = useRef<string | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const latestNotesSaveRequestNumberRef = useRef(0)
  const unsavedNotesRequestCountRef = useRef(0)
  const isMountedRef = useRef(true)
  const notesSavingDependenciesRef = useRef({ endClientBrief, updateEndClientNotes })

  useEffect(() => {
    notesSavingDependenciesRef.current = { endClientBrief, updateEndClientNotes }
  })

  const brief = generatedBrief ?? endClientBrief?.brief ?? null

  const computeState = (): ClientBriefSectionState => {
    if (endClientBrief === null) return 'unknown_client'
    if (isGenerating) return 'generating'
    return brief === null ? 'no_brief' : 'brief_available'
  }

  const generate = async () => {
    if (endClientBrief === null || isGenerationInFlightRef.current) return
    isGenerationInFlightRef.current = true
    setIsGenerating(true)
    setErrorMessage(null)
    const generationResult = await runActionSafely(() => generateBriefForEndClient(endClientBrief.endClientId))
    isGenerationInFlightRef.current = false
    setIsGenerating(false)
    if (!generationResult.ok) {
      setErrorMessage(generationResult.errorMessage)
      return
    }
    setGeneratedBrief(generationResult.data)
    onDataChanged()
  }

  const showNotesSaveResult = (notesSaveResult: ActionResult<null>, requestNumber: number, savedNotes: string) => {
    const isLatestRequest = requestNumber === latestNotesSaveRequestNumberRef.current
    if (!isMountedRef.current || !isLatestRequest) return
    if (!notesSaveResult.ok && pendingNotesRef.current === null) pendingNotesRef.current = savedNotes
    setNotesSaveStatus(notesSaveResult.ok ? 'saved' : 'failed')
    setNotesErrorMessage(notesSaveResult.ok ? null : notesSaveResult.errorMessage)
  }

  const enqueueNotesSave = (notesToSave: string) => {
    const savingDependencies = notesSavingDependenciesRef.current
    if (savingDependencies.endClientBrief === null) return
    const { endClientId } = savingDependencies.endClientBrief
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

  return {
    state: computeState(),
    brief,
    isGenerating,
    errorMessage,
    generate,
    notes,
    changeNotes,
    notesSaveStatus,
    notesErrorMessage,
    retryNotesSave: flushPendingNotes,
  }
}
