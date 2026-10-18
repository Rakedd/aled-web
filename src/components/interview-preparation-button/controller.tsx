import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import type { InterviewPreparationButtonControllerParameters } from './interfaces'

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
  hasAnthropicApiKey,
  onDataChanged,
}: InterviewPreparationButtonControllerParameters) => {
  const [preparation, setPreparation] = useState(initialPreparation)
  const [language, setLanguage] = useState<BriefLanguage>(initialPreparation.language)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isGenerationInFlightRef = useRef(false)
  const latestLanguageChangeNumberRef = useRef(0)

  const isComplete = isPreparationComplete(preparation)

  const generate = async (languageToGenerate: BriefLanguage, regenerate: boolean) => {
    if (!hasAnthropicApiKey || isGenerationInFlightRef.current) return
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
    const loadResult = await runActionSafely(() => getInterviewPreparation(jobApplicationId, chosenLanguage))
    if (changeNumber !== latestLanguageChangeNumberRef.current) return
    if (!loadResult.ok) {
      setLanguage(previousLanguage)
      setErrorMessage(loadResult.errorMessage)
      return
    }
    setPreparation(loadResult.data)
  }

  const handleButtonClick = async () => {
    if (isGenerating) return
    if (isComplete) {
      setIsModalOpen(true)
      return
    }
    await generate(language, false)
  }

  const handleNotesSaved = (savedNotes: string) =>
    setPreparation((currentPreparation) => ({ ...currentPreparation, notes: savedNotes }))

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
    isButtonDisabled: isGenerating || (!isComplete && !hasAnthropicApiKey),
    handleButtonClick,
    regenerate: (languageToGenerate: BriefLanguage) => generate(languageToGenerate, true),
    isModalOpen,
    closeModal: () => setIsModalOpen(false),
    handleNotesSaved,
  }
}
