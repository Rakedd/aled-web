import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { isClientBriefSource } from '@/domain/client-brief'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { rejectWith } from '@/domain/input-validation'
import {
  type BriefLanguage,
  type InterviewQuestions,
  isBriefLanguage,
  isInterviewQuestionList,
  type LanguageBrief,
} from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

type LanguageBriefRow = Pick<Tables<'end_client_briefs'>, 'language' | 'markdown' | 'sources' | 'generated_at'>

type InterviewQuestionsRow = Pick<Tables<'interview_questions'>, 'language' | 'questions' | 'generated_at'>

const toLanguageBrief = (briefRow: LanguageBriefRow): LanguageBrief | null => {
  if (!isBriefLanguage(briefRow.language)) return null
  return {
    language: briefRow.language,
    markdown: briefRow.markdown,
    sources: Array.isArray(briefRow.sources) ? briefRow.sources.filter(isClientBriefSource) : [],
    generatedAt: new Date(briefRow.generated_at),
  }
}

const toInterviewQuestions = (questionsRow: InterviewQuestionsRow): InterviewQuestions | null => {
  if (!isBriefLanguage(questionsRow.language) || !isInterviewQuestionList(questionsRow.questions)) return null
  return {
    language: questionsRow.language,
    questions: questionsRow.questions,
    generatedAt: new Date(questionsRow.generated_at),
  }
}

export const findLanguageBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  language: BriefLanguage,
): Promise<LanguageBrief | null> => {
  const { data, error } = await supabase
    .from('end_client_briefs')
    .select('language, markdown, sources, generated_at')
    .eq('user_id', userId)
    .eq('end_client_id', endClientId)
    .eq('language', language)
    .maybeSingle()
  if (error) throw toRepositoryError('findLanguageBrief', error)
  return data === null ? null : toLanguageBrief(data)
}

export const saveLanguageBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  languageBrief: LanguageBrief,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('end_client_briefs').upsert(
    {
      user_id: userId,
      end_client_id: endClientId,
      language: languageBrief.language,
      markdown: languageBrief.markdown,
      sources: languageBrief.sources,
      generated_at: languageBrief.generatedAt.toISOString(),
    },
    { onConflict: 'user_id,end_client_id,language' },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(ENTITY_NOT_FOUND_MESSAGES.endClient)
  if (error) throw toRepositoryError('saveLanguageBrief', error)
  return { ok: true, data: null }
}

export const findEndClientNotes = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('end_clients')
    .select('notes')
    .eq('id', endClientId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findEndClientNotes', error)
  return data?.notes ?? null
}

export const findInterviewQuestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<InterviewQuestions | null> => {
  const { data, error } = await supabase
    .from('interview_questions')
    .select('language, questions, generated_at')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .eq('language', language)
    .maybeSingle()
  if (error) throw toRepositoryError('findInterviewQuestions', error)
  return data === null ? null : toInterviewQuestions(data)
}

export const findLatestInterviewQuestionsLanguage = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<BriefLanguage | null> => {
  const { data, error } = await supabase
    .from('interview_questions')
    .select('language')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw toRepositoryError('findLatestInterviewQuestionsLanguage', error)
  return data !== null && isBriefLanguage(data.language) ? data.language : null
}

export const saveInterviewQuestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  interviewQuestions: InterviewQuestions,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('interview_questions').upsert(
    {
      user_id: userId,
      job_application_id: jobApplicationId,
      language: interviewQuestions.language,
      questions: interviewQuestions.questions,
      generated_at: interviewQuestions.generatedAt.toISOString(),
    },
    { onConflict: 'user_id,job_application_id,language' },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (error) throw toRepositoryError('saveInterviewQuestions', error)
  return { ok: true, data: null }
}
