import { useState } from 'react'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { InterviewPreparationModalControllerParameters } from './interfaces'

export const useController = ({ language, onRegenerate }: InterviewPreparationModalControllerParameters) => {
  const [regenerationLanguage, setRegenerationLanguage] = useState<BriefLanguage>(language)

  return {
    regenerationLanguage,
    changeRegenerationLanguage: setRegenerationLanguage,
    requestRegeneration: () => onRegenerate(regenerationLanguage),
  }
}
