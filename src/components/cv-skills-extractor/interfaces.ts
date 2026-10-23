import type { ActionResult } from '@/domain/action-result'
import type { CvOption } from '@/domain/cv-library'

export type ExtractSkillsFromCv = (cvId: string) => Promise<ActionResult<string[]>>

export type CvSkillsExtractorControllerParameters = {
  cvOptions: CvOption[]
  mySkills: string[]
  extractSkillsFromCv: ExtractSkillsFromCv
  onSkillsExtracted: (extractedSkills: string[]) => void
}

export type CvSkillsExtractorProps = CvSkillsExtractorControllerParameters & {
  hasAnthropicApiKey: boolean
  cvLibraryErrorMessage: string | null
}
