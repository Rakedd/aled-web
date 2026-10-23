import { useEffect, useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import type { TechnicalBriefView } from '@/domain/technical-brief'
import type { TechnicalBriefSectionProps, TransientOutcome } from './interfaces'

export const useController = ({
  jobApplicationId,
  language,
  hasAnthropicApiKey,
  getTechnicalBriefView,
  generateTechnicalBrief,
}: TechnicalBriefSectionProps) => {
  const [view, setView] = useState<TechnicalBriefView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transientOutcome, setTransientOutcome] = useState<TransientOutcome | null>(null)
  const latestRequestNumberRef = useRef(0)
  const isGenerationInFlightRef = useRef(false)
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
    latestRequestNumberRef.current += 1
    const requestNumber = latestRequestNumberRef.current
    const loadView = async () => {
      const loadResult = await guardActionCall(() => getTechnicalBriefView(jobApplicationId, language))
      if (requestNumber !== latestRequestNumberRef.current) return
      setIsLoading(false)
      if (!loadResult.ok) {
        setErrorMessage(loadResult.errorMessage)
        return
      }
      setView(loadResult.data)
    }
    void loadView()
  }, [jobApplicationId, language, getTechnicalBriefView])

  const generate = async () => {
    if (!hasAnthropicApiKey || isGenerationInFlightRef.current) return
    isGenerationInFlightRef.current = true
    const requestNumber = latestRequestNumberRef.current
    setIsGenerating(true)
    setErrorMessage(null)
    setTransientOutcome(null)
    const generationResult = await guardActionCall(() => generateTechnicalBrief(jobApplicationId, language))
    isGenerationInFlightRef.current = false
    setIsGenerating(false)
    if (requestNumber !== latestRequestNumberRef.current) return
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

  return { view, isLoading, isGenerating, errorMessage, transientOutcome, generate }
}
