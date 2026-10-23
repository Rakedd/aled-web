import type { ActionResult } from '@/domain/action-result'
import { isRecord, isValidDate, rejectWith } from '@/domain/input-validation'
import { type BriefLanguage, isBriefLanguage } from '@/domain/interview-preparation'
import {
  normalizeTechnicalBriefContent,
  TECHNICAL_BRIEF_MESSAGES,
  type TechnicalBrief,
  type TechnicalBriefAvailability,
  type TechnicalBriefGenerationOutcome,
  type TechnicalBriefView,
} from '@/domain/technical-brief'

const TECHNICAL_BRIEF_GENERATION_ROUTE = '/api/technical-briefs'

const TECHNICAL_BRIEF_AVAILABILITIES: readonly TechnicalBriefAvailability[] = [
  'ready',
  'missing_sent_cv',
  'missing_mission_details',
]

const isTechnicalBriefAvailability = (candidate: unknown): candidate is TechnicalBriefAvailability =>
  (TECHNICAL_BRIEF_AVAILABILITIES as readonly unknown[]).includes(candidate)

const reviveDateOrNull = (candidate: unknown): Date | null => {
  if (typeof candidate !== 'string') return null
  const revivedDate = new Date(candidate)
  return isValidDate(revivedDate) ? revivedDate : null
}

const parseTechnicalBriefOrNull = (candidate: unknown): TechnicalBrief | null => {
  if (!isRecord(candidate)) return null
  const { language, cvVersionId, cvLabel } = candidate
  if (!isBriefLanguage(language) || typeof cvLabel !== 'string') return null
  if (cvVersionId !== null && typeof cvVersionId !== 'string') return null
  const content = normalizeTechnicalBriefContent(candidate.content)
  const cvUploadedAt = reviveDateOrNull(candidate.cvUploadedAt)
  const generatedAt = reviveDateOrNull(candidate.generatedAt)
  if (content === null || cvUploadedAt === null || generatedAt === null) return null
  return { language, content, cvVersionId, cvLabel, cvUploadedAt, generatedAt }
}

const parseTechnicalBriefViewOrNull = (candidate: unknown): TechnicalBriefView | null => {
  if (!isRecord(candidate)) return null
  const { language, availability, isCvOutdated } = candidate
  if (!isBriefLanguage(language) || !isTechnicalBriefAvailability(availability) || typeof isCvOutdated !== 'boolean') {
    return null
  }
  if (candidate.brief === null) return { language, availability, brief: null, isCvOutdated }
  const brief = parseTechnicalBriefOrNull(candidate.brief)
  return brief === null ? null : { language, availability, brief, isCvOutdated }
}

const parseGenerationOutcomeOrNull = (candidate: unknown): TechnicalBriefGenerationOutcome | null => {
  if (!isRecord(candidate)) return null
  const { kind } = candidate
  if (kind === 'cv_missing_information' || kind === 'cv_unreadable') return { kind }
  if (kind !== 'generated') return null
  const view = parseTechnicalBriefViewOrNull(candidate.view)
  return view === null ? null : { kind, view }
}

export const parseTechnicalBriefGenerationResponse = (
  responseBody: unknown,
): ActionResult<TechnicalBriefGenerationOutcome> => {
  if (!isRecord(responseBody)) return rejectWith(TECHNICAL_BRIEF_MESSAGES.generationFailure)
  const { ok, errorMessage, error } = responseBody
  if (ok === false && typeof errorMessage === 'string') return rejectWith(errorMessage)
  if (typeof error === 'string') return rejectWith(error)
  if (ok !== true) return rejectWith(TECHNICAL_BRIEF_MESSAGES.generationFailure)
  const generationOutcome = parseGenerationOutcomeOrNull(responseBody.data)
  return generationOutcome === null
    ? rejectWith(TECHNICAL_BRIEF_MESSAGES.generationFailure)
    : { ok: true, data: generationOutcome }
}

export const requestTechnicalBriefGeneration = async (
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<TechnicalBriefGenerationOutcome>> => {
  try {
    const generationResponse = await fetch(TECHNICAL_BRIEF_GENERATION_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobApplicationId, language }),
    })
    return parseTechnicalBriefGenerationResponse(await generationResponse.json())
  } catch {
    return rejectWith(TECHNICAL_BRIEF_MESSAGES.generationFailure)
  }
}
