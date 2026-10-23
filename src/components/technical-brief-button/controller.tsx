import { useEffect, useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefView } from '@/domain/technical-brief'
import type { TransientOutcome } from '@/components/technical-brief-section/interfaces'
import type { TechnicalBriefButtonControllerParameters } from './interfaces'

export const useController = ({
  jobApplicationId,
  language,
  hasAnthropicApiKey,
  getTechnicalBriefView,
  generateTechnicalBrief,
}: TechnicalBriefButtonControllerParameters) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
  }, [jobApplicationId, language])

  const generate = async () => {
    if (!hasAnthropicApiKey || isGenerationInFlightRef.current) return
    isGenerationInFlightRef.current = true
    const requestKey = `${jobApplicationId}:${language}`
    setIsGenerating(true)
    setErrorMessage(null)
    setTransientOutcome(null)
    const generationResult = await guardActionCall(() =>
      actionsRef.current.generateTechnicalBrief(jobApplicationId, language),
    )
    isGenerationInFlightRef.current = false
    setIsGenerating(false)
    if (requestKey !== activeRequestKeyRef.current) return
    if (!generationResult.ok) {
      setErrorMessage(generationResult.errorMessage)
      return
    }
    if (generationResult.data.kind === 'generated') {
      setView(generationResult.data.view)
      return
    }
    setTransientOutcome(generationResult.data.kind)
  }

  const openDialog = () => setIsDialogOpen(true)
  const closeDialog = () => setIsDialogOpen(false)
  const buttonLabel = isGenerating ? TECHNICAL_BRIEF_MESSAGES.generationProgress : 'Brief technique · voir'

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
  }
}
