import type { ActionResult } from './action-result'
import type { AiErrorKind } from './ai-errors'
import { CLIENT_BRIEF_AI_ERROR_MESSAGES, type ClientBriefSource } from './client-brief'
import { rejectWith } from './input-validation'

export const BRIEF_LANGUAGES = ['fr', 'en'] as const

export type BriefLanguage = (typeof BRIEF_LANGUAGES)[number]

export const BRIEF_LANGUAGE_LABELS: Record<BriefLanguage, string> = { fr: 'Français', en: 'English' }

export const isBriefLanguage = (candidate: unknown): candidate is BriefLanguage =>
  typeof candidate === 'string' && (BRIEF_LANGUAGES as readonly string[]).includes(candidate)

export const INTERVIEW_PREPARATION_MESSAGES = { invalidLanguage: 'Langue invalide' } as const

export const INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...CLIENT_BRIEF_AI_ERROR_MESSAGES,
  refused: "Claude n'a pas pu générer ces questions. Réessaie plus tard.",
  unknown: 'La génération des questions a échoué, réessaie.',
}

export const validateBriefLanguage = (candidate: unknown): ActionResult<BriefLanguage> =>
  isBriefLanguage(candidate) ? { ok: true, data: candidate } : rejectWith(INTERVIEW_PREPARATION_MESSAGES.invalidLanguage)

export const isInterviewQuestionList = (candidate: unknown): candidate is string[] =>
  Array.isArray(candidate) && candidate.every((question) => typeof question === 'string')

export const MIN_INTERVIEW_QUESTIONS = 8

export const MAX_INTERVIEW_QUESTIONS = 10

export type InterviewQuestions = { language: BriefLanguage; questions: string[]; generatedAt: Date }

export type LanguageBrief = {
  language: BriefLanguage
  markdown: string
  sources: ClientBriefSource[]
  generatedAt: Date
}

export type InterviewPreparation = {
  language: BriefLanguage
  endClientId: string | null
  endClientName: string | null
  brief: LanguageBrief | null
  questions: InterviewQuestions | null
  notes: string | null
  lastUsedLanguage: BriefLanguage | null
}
