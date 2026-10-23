import { useEffect, useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefView } from '@/domain/technical-brief'
import type { TechnicalBriefButtonControllerParameters, TransientOutcome } from './interfaces'

export const useController = ({
  jobApplicationId,
  language,
  hasAnthropicApiKey,
  getTechnicalBriefView,
  generateTechnicalBrief,
}: TechnicalBriefButtonControllerParameters) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [hasBeenOpened, setHasBeenOpened] = useState(false)
  const [closedDialogAnnouncement, setClosedDialogAnnouncement] = useState('')
  const isDialogOpenRef = useRef(false)
  const [view, setView] = useState<TechnicalBriefView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transientOutcome, setTransientOutcome] = useState<TransientOutcome | null>(null)
  const latestRequestNumberRef = useRef(0)
  const isGenerationInFlightRef = useRef(false)
  const activeRequestKeyRef = useRef(`${jobApplicationId}:${language}`)
  const actionsRef = useRef({ getTechnicalBriefView, generateTechnicalBrief })
  const [loadedRequestKey, setLoadedRequestKey] = useState(`${jobApplicationId}:${language}`)
  const currentRequestKey = `${jobApplicationId}:${language}`

  if (loadedRequestKey !== currentRequestKey) {
    setLoadedRequestKey(currentRequestKey)
    setView(null)
    setIsLoading(true)
    setErrorMessage(null)
    setTransientOutcome(null)
  }

  useEffect(() => {
    actionsRef.current = { getTechnicalBriefView, generateTechnicalBrief }
  })

  useEffect(() => {
    if (!hasBeenOpened) return
    activeRequestKeyRef.current = `${jobApplicationId}:${language}`
    latestRequestNumberRef.current += 1
    const requestNumber = latestRequestNumberRef.current
    const loadView = async () => {
      const loadResult = await guardActionCall(() => actionsRef.current.getTechnicalBriefView(jobApplicationId, language))
      if (requestNumber !== latestRequestNumberRef.current) return
      setIsLoading(false)
      if (!loadResult.ok) {
        setErrorMessage(loadResult.errorMessage)
        return
      }
      setView(loadResult.data)
    }
    void loadView()
  }, [jobApplicationId, language, hasBeenOpened])

  const generate = async () => {
    if (!hasAnthropicApiKey || isGenerationInFlightRef.current) return
    isGenerationInFlightRef.current = true
    const requestKey = `${jobApplicationId}:${language}`
    setIsGenerating(true)
    setErrorMessage(null)
    setTransientOutcome(null)
    setClosedDialogAnnouncement('')
    const generationResult = await guardActionCall(() =>
      actionsRef.current.generateTechnicalBrief(jobApplicationId, language),
    )
    isGenerationInFlightRef.current = false
    setIsGenerating(false)
    if (requestKey !== activeRequestKeyRef.current) return
    const announceWhenClosed = (message: string) => {
      if (!isDialogOpenRef.current) setClosedDialogAnnouncement(message)
    }
    if (!generationResult.ok) {
      setErrorMessage(generationResult.errorMessage)
      announceWhenClosed(generationResult.errorMessage)
      return
    }
    if (generationResult.data.kind === 'generated') {
      setView(generationResult.data.view)
      announceWhenClosed(TECHNICAL_BRIEF_MESSAGES.ready)
      return
    }
    setTransientOutcome(generationResult.data.kind)
    announceWhenClosed(
      generationResult.data.kind === 'cv_missing_information'
        ? TECHNICAL_BRIEF_MESSAGES.cvMissingInformationTitle
        : TECHNICAL_BRIEF_MESSAGES.cvUnreadable,
    )
  }

  const openDialog = () => {
    isDialogOpenRef.current = true
    setIsDialogOpen(true)
    setHasBeenOpened(true)
    setClosedDialogAnnouncement('')
  }
  const closeDialog = () => {
    isDialogOpenRef.current = false
    setIsDialogOpen(false)
  }
  const buttonLabel = isGenerating ? TECHNICAL_BRIEF_MESSAGES.generationProgress : TECHNICAL_BRIEF_MESSAGES.openButton

  return {
    view,
    isLoading,
    isGenerating,
    errorMessage,
    transientOutcome,
    generate,
    isDialogOpen,
    openDialog,
    closeDialog,
    buttonLabel,
    closedDialogAnnouncement,
  }
}
