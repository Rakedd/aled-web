import type { ClientBriefSource } from './client-brief'

export const BRIEF_LANGUAGES = ['fr', 'en'] as const

export type BriefLanguage = (typeof BRIEF_LANGUAGES)[number]

export const BRIEF_LANGUAGE_LABELS: Record<BriefLanguage, string> = { fr: 'Français', en: 'English' }

export const isBriefLanguage = (candidate: unknown): candidate is BriefLanguage =>
  typeof candidate === 'string' && (BRIEF_LANGUAGES as readonly string[]).includes(candidate)

export const MIN_INTERVIEW_QUESTIONS = 8

export const MAX_INTERVIEW_QUESTIONS = 10

export type InterviewQuestions = { language: BriefLanguage; questions: string[]; generatedAt: Date }

export type LanguageBrief = {
  language: BriefLanguage
  markdown: string
  sources: ClientBriefSource[]
  generatedAt: Date
}
