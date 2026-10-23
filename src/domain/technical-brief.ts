import type { ActionResult } from '@/domain/action-result'
import type { AiErrorKind } from '@/domain/ai-errors'
import { CLIENT_BRIEF_AI_ERROR_MESSAGES } from '@/domain/client-brief'
import { isRecord, validateUuid } from '@/domain/input-validation'
import { type BriefLanguage, validateBriefLanguage } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { formatParisDate } from '@/domain/paris-time'

export const TECHNICAL_BRIEF_EMPHASES = ['lean_on', 'intro', 'skim'] as const

export type TechnicalBriefEmphasis = (typeof TECHNICAL_BRIEF_EMPHASES)[number]

export const TECHNICAL_BRIEF_EMPHASIS_LABELS: Record<TechnicalBriefEmphasis, string> = {
  lean_on: 'Appuie fort',
  intro: "Pour l'intro",
  skim: 'Passe vite',
}

export type TechnicalBriefStoryStep = { title: string; guidance: string }

export type TechnicalBriefMission = {
  label: string
  period: string
  emphasis: TechnicalBriefEmphasis
  sharedStack: string[]
  why: string
  reflectionQuestions: string[]
}

export type TechnicalBriefGap = { stackItem: string; question: string }

export type TechnicalBriefContent = {
  storyline: TechnicalBriefStoryStep[]
  missions: TechnicalBriefMission[]
  gaps: TechnicalBriefGap[]
}

export type TechnicalBrief = {
  language: BriefLanguage
  content: TechnicalBriefContent
  cvVersionId: string | null
  cvLabel: string
  cvUploadedAt: Date
  generatedAt: Date
}

export type TechnicalBriefAvailability = 'ready' | 'missing_sent_cv' | 'missing_mission_details'

export type TechnicalBriefView = {
  language: BriefLanguage
  availability: TechnicalBriefAvailability
  brief: TechnicalBrief | null
  isCvOutdated: boolean
}

export type TechnicalBriefGenerationOutcome =
  | { kind: 'generated'; view: TechnicalBriefView }
  | { kind: 'cv_missing_information' }
  | { kind: 'cv_unreadable' }

export type TechnicalBriefRequest = { jobApplicationId: string; language: BriefLanguage }

export const TECHNICAL_BRIEF_LIMITS = {
  storySteps: 5,
  maxMissions: 6,
  maxSharedStack: 12,
  maxGaps: 5,
  reflectionQuestions: { lean_on: 4, intro: 2, skim: 0 },
  textLengths: { title: 80, guidance: 400, label: 120, period: 60, why: 300, question: 300, stackItem: 60 },
} as const

export const TECHNICAL_BRIEF_MESSAGES = {
  title: 'Brief technique',
  readyIntroduction:
    "L'IA croise ton CV envoyé et la stack de la mission pour te dire quelles missions raconter et quoi préparer.",
  generate: 'Préparer mon pitch',
  regenerate: 'Régénérer',
  generationProgress: "Préparation de ton pitch… (jusqu'à 2 min)",
  missingSentCv: 'Rattache le CV que tu as envoyé à cette candidature pour préparer ton pitch.',
  chooseSentCv: 'Choisir le CV envoyé',
  missingMissionDetails: 'Ajoute la fiche de poste ou la stack de la mission pour préparer ton pitch.',
  cvMissingInformationTitle: "Le CV manque d'informations.",
  cvMissingInformationDetail: 'Il faut au moins la stack de chaque mission pour savoir sur lesquelles appuyer.',
  cvMissingInformationReassurance: "T'inquiète, on va le retaper ensemble.",
  cvUnreadable: 'Impossible de lire ce CV. Dépose une version PDF exportée depuis ton éditeur, pas un scan.',
  improveCv: 'Améliorer mon CV',
  cvOutdated: 'Ton CV envoyé a changé depuis ce brief.',
  storylineTitle: '1 · Ton fil rouge',
  missionsTitle: '2 · Missions sur lesquelles appuyer',
  gapsTitle: '3 · Points à préparer',
  gapsIntroduction: "Leur stack contient des choses que ton CV ne montre pas. C'est là que tomberont les questions :",
  sharedStackLabel: 'En commun avec leur stack :',
  whyLabel: 'Pourquoi :',
  reflectionQuestionsLabel: 'Pour préparer ton récit :',
  skimPrefix: 'Passe vite sur :',
  loading: 'Chargement du brief technique…',
  generationFailure: "Impossible d'enregistrer le brief technique pour le moment. Réessaie dans quelques minutes.",
  sessionExpired: 'Ta session a expiré. Reconnecte-toi puis réessaie.',
  invalidRequest: 'Demande de brief technique invalide.',
} as const

export const TECHNICAL_BRIEF_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...CLIENT_BRIEF_AI_ERROR_MESSAGES,
  unknown: 'La préparation du pitch a échoué, réessaie.',
}

type TextLengthKey = keyof typeof TECHNICAL_BRIEF_LIMITS.textLengths

const isEmphasis = (candidate: unknown): candidate is TechnicalBriefEmphasis =>
  (TECHNICAL_BRIEF_EMPHASES as readonly unknown[]).includes(candidate)

const isStringArray = (candidate: unknown): candidate is string[] =>
  Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')

const cleanText = (text: string, lengthKey: TextLengthKey): string =>
  text.trim().slice(0, TECHNICAL_BRIEF_LIMITS.textLengths[lengthKey]).trim()

const cleanTextList = (texts: string[], lengthKey: TextLengthKey, maximumCount: number): string[] =>
  texts
    .map((text) => cleanText(text, lengthKey))
    .filter((text) => text !== '')
    .slice(0, maximumCount)

const normalizeStoryStep = (candidate: unknown): TechnicalBriefStoryStep | null => {
  if (!isRecord(candidate) || typeof candidate.title !== 'string' || typeof candidate.guidance !== 'string') return null
  return { title: cleanText(candidate.title, 'title'), guidance: cleanText(candidate.guidance, 'guidance') }
}

const normalizeMission = (candidate: unknown): TechnicalBriefMission | null | undefined => {
  if (
    !isRecord(candidate) ||
    typeof candidate.label !== 'string' ||
    typeof candidate.period !== 'string' ||
    typeof candidate.why !== 'string' ||
    !isEmphasis(candidate.emphasis) ||
    !isStringArray(candidate.sharedStack) ||
    !isStringArray(candidate.reflectionQuestions)
  )
    return undefined
  const label = cleanText(candidate.label, 'label')
  if (label === '') return null
  return {
    label,
    period: cleanText(candidate.period, 'period'),
    emphasis: candidate.emphasis,
    sharedStack: cleanTextList(candidate.sharedStack, 'stackItem', TECHNICAL_BRIEF_LIMITS.maxSharedStack),
    why: cleanText(candidate.why, 'why'),
    reflectionQuestions: cleanTextList(
      candidate.reflectionQuestions,
      'question',
      TECHNICAL_BRIEF_LIMITS.reflectionQuestions[candidate.emphasis],
    ),
  }
}

const normalizeGap = (candidate: unknown): TechnicalBriefGap | null | undefined => {
  if (!isRecord(candidate) || typeof candidate.stackItem !== 'string' || typeof candidate.question !== 'string')
    return undefined
  const stackItem = cleanText(candidate.stackItem, 'stackItem')
  const question = cleanText(candidate.question, 'question')
  return stackItem === '' || question === '' ? null : { stackItem, question }
}

const normalizeList = <Item>(
  candidates: unknown[],
  normalizeItem: (candidate: unknown) => Item | null | undefined,
): Item[] | null => {
  const normalizedItems = candidates.map(normalizeItem)
  if (normalizedItems.includes(undefined)) return null
  return normalizedItems.filter((item): item is Item => item !== null && item !== undefined)
}

export const normalizeTechnicalBriefContent = (candidate: unknown): TechnicalBriefContent | null => {
  if (
    !isRecord(candidate) ||
    !Array.isArray(candidate.storyline) ||
    !Array.isArray(candidate.missions) ||
    !Array.isArray(candidate.gaps)
  )
    return null
  if (candidate.storyline.length !== TECHNICAL_BRIEF_LIMITS.storySteps) return null

  const storyline = normalizeList(candidate.storyline, (step) => normalizeStoryStep(step) ?? undefined)
  const missions = normalizeList(candidate.missions, normalizeMission)
  const gaps = normalizeList(candidate.gaps, normalizeGap)
  if (storyline === null || missions === null || gaps === null || missions.length === 0) return null

  const emphasisRank = (mission: TechnicalBriefMission): number => TECHNICAL_BRIEF_EMPHASES.indexOf(mission.emphasis)
  const sortedMissions = missions
    .slice(0, TECHNICAL_BRIEF_LIMITS.maxMissions)
    .map((mission, position) => ({ mission, position }))
    .sort((first, second) => emphasisRank(first.mission) - emphasisRank(second.mission) || first.position - second.position)
    .map(({ mission }) => mission)

  return { storyline, missions: sortedMissions, gaps: gaps.slice(0, TECHNICAL_BRIEF_LIMITS.maxGaps) }
}

export const toTechnicalBriefView = (input: {
  language: BriefLanguage
  sentCvVersionId: string | null
  hasMissionDetails: boolean
  brief: TechnicalBrief | null
}): TechnicalBriefView => {
  const { language, sentCvVersionId, hasMissionDetails, brief } = input
  const availability: TechnicalBriefAvailability =
    sentCvVersionId === null ? 'missing_sent_cv' : hasMissionDetails ? 'ready' : 'missing_mission_details'
  const isCvOutdated = brief !== null && (brief.cvVersionId === null || brief.cvVersionId !== sentCvVersionId)
  return { language, availability, brief, isCvOutdated }
}

export const formatTechnicalBriefSource = (brief: TechnicalBrief): string =>
  `Basé sur : ${brief.cvLabel} · version du ${formatParisDate(brief.cvUploadedAt)} (le CV envoyé)`

export const validateTechnicalBriefRequest = (
  jobApplicationId: unknown,
  language: unknown,
): ActionResult<TechnicalBriefRequest> => {
  const jobApplicationIdValidation = validateUuid(jobApplicationId, JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const languageValidation = validateBriefLanguage(language)
  if (!languageValidation.ok) return languageValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, language: languageValidation.data } }
}

export type GuidancePart = { text: string; isMissionLabel: boolean }

const MINIMUM_HIGHLIGHTED_MISSION_LABEL_LENGTH = 3

const escapeForRegularExpression = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const splitGuidanceByMissionLabels = (guidance: string, missionLabels: string[]): GuidancePart[] => {
  const highlightedMissionLabels = [...new Set(missionLabels)]
    .filter((missionLabel) => missionLabel.length >= MINIMUM_HIGHLIGHTED_MISSION_LABEL_LENGTH)
    .sort((firstLabel, secondLabel) => secondLabel.length - firstLabel.length)
  if (highlightedMissionLabels.length === 0) return guidance === '' ? [] : [{ text: guidance, isMissionLabel: false }]
  const missionLabelPattern = new RegExp(`(${highlightedMissionLabels.map(escapeForRegularExpression).join('|')})`)
  return guidance
    .split(missionLabelPattern)
    .map((text, partIndex) => ({ text, isMissionLabel: partIndex % 2 === 1 }))
    .filter((guidancePart) => guidancePart.text !== '')
}
