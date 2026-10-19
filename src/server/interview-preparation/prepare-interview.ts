import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  CLIENT_BRIEF_AI_ERROR_MESSAGES,
  CLIENT_BRIEF_MESSAGES,
  type ClientBrief,
  isBriefableEndClientName,
} from '@/domain/client-brief'
import { rejectWith } from '@/domain/input-validation'
import type { AiErrorKind } from '@/domain/ai-errors'
import {
  type BriefLanguage,
  INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES,
  type InterviewPreparation,
  type LanguageBrief,
} from '@/domain/interview-preparation'
import type { JobApplicationOverview } from '@/domain/job-application'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { type ClientBriefInput, generateClientBrief } from '@/server/ai/generate-client-brief'
import {
  DEFAULT_INTERVIEW_QUESTIONS_REQUEST_OPTIONS,
  generateInterviewQuestions,
  type InterviewQuestionsInput,
  type InterviewQuestionsRequestOptions,
} from '@/server/ai/generate-interview-questions'
import {
  findEndClientNotes,
  findInterviewQuestions,
  findLanguageBrief,
  findLatestInterviewQuestionsLanguage,
  saveInterviewQuestions,
  saveLanguageBrief,
} from '@/server/repositories/interview-preparation-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { findJobSpec } from '@/server/repositories/job-specs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type InterviewPreparationRequest = { jobApplicationId: string; language: BriefLanguage; regenerate: boolean }

export type InterviewPreparationDependencies = {
  getApiKey: (userId: string) => Promise<string | null>
  generateBrief: (apiKey: string, clientBriefInput: ClientBriefInput) => Promise<ClientBrief>
  generateQuestions: (
    apiKey: string,
    interviewQuestionsInput: InterviewQuestionsInput,
    requestOptions: InterviewQuestionsRequestOptions,
  ) => Promise<string[]>
  startedAtInMilliseconds: number
  nowInMilliseconds: () => number
}

type PreparationContext = { jobApplication: JobApplicationOverview; preparation: InterviewPreparation }

type EndClientToBrief = { endClientId: string; clientBriefInput: ClientBriefInput }

type GenerationSession = {
  supabase: FreeclutchSupabaseClient
  userId: string
  apiKey: string
  dependencies: InterviewPreparationDependencies
}

const PREPARATION_TIME_BUDGET_IN_MILLISECONDS = 300_000
const PREPARATION_SAFETY_MARGIN_IN_MILLISECONDS = 15_000
const MINIMUM_QUESTIONS_TIME_IN_MILLISECONDS = 10_000
const MINIMUM_TIME_FOR_QUESTIONS_RETRY_IN_MILLISECONDS = 65_000

export const createInterviewPreparationDependencies = (
  startedAtInMilliseconds: number,
): InterviewPreparationDependencies => ({
  getApiKey: getDecryptedAnthropicApiKeyForUser,
  generateBrief: (apiKey, clientBriefInput) => generateClientBrief(createAnthropicClient(apiKey), clientBriefInput),
  generateQuestions: (apiKey, interviewQuestionsInput, requestOptions) =>
    generateInterviewQuestions(createAnthropicClient(apiKey), interviewQuestionsInput, requestOptions),
  startedAtInMilliseconds,
  nowInMilliseconds: Date.now,
})

const loadPreparationContext = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<PreparationContext>> => {
  const jobApplicationResult = await findJobApplicationOverview(supabase, userId, jobApplicationId)
  if (!jobApplicationResult.ok) return jobApplicationResult
  const jobApplication = jobApplicationResult.data
  const { endClientId } = jobApplication
  const [brief, notes, questions, lastUsedLanguage] = await Promise.all([
    endClientId === null ? null : findLanguageBrief(supabase, userId, endClientId, language),
    endClientId === null ? null : findEndClientNotes(supabase, userId, endClientId),
    findInterviewQuestions(supabase, userId, jobApplicationId, language),
    findLatestInterviewQuestionsLanguage(supabase, userId, jobApplicationId),
  ])
  return {
    ok: true,
    data: {
      jobApplication,
      preparation: {
        language,
        endClientId,
        endClientName: jobApplication.endClientName,
        brief,
        questions,
        notes,
        lastUsedLanguage,
      },
    },
  }
}

export const findInterviewPreparationForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<InterviewPreparation>> => {
  const contextResult = await loadPreparationContext(supabase, userId, jobApplicationId, language)
  return contextResult.ok ? { ok: true, data: contextResult.data.preparation } : contextResult
}

const findEndClientToBrief = (
  { jobApplication, preparation }: PreparationContext,
  { language, regenerate }: InterviewPreparationRequest,
): EndClientToBrief | null => {
  const { endClientId, endClientName, endClientParentName } = jobApplication
  if (endClientId === null || endClientName === null) return null
  if (!regenerate && preparation.brief !== null) return null
  return { endClientId, clientBriefInput: { endClientName, parentGroupName: endClientParentName, language } }
}

const runAiGeneration = async <GeneratedContent>(
  generationName: string,
  aiErrorMessages: Record<AiErrorKind, string>,
  generate: () => Promise<GeneratedContent>,
): Promise<ActionResult<GeneratedContent>> => {
  try {
    return { ok: true, data: await generate() }
  } catch (generationError) {
    const aiErrorLogContext = describeAiErrorForLogs(generationError)
    console.error(`${generationName} generation failed`, aiErrorLogContext)
    return rejectWith(aiErrorMessages[aiErrorLogContext.aiErrorKind])
  }
}

const generateAndSaveBrief = async (
  { supabase, userId, apiKey, dependencies }: GenerationSession,
  { endClientId, clientBriefInput }: EndClientToBrief,
): Promise<ActionResult<LanguageBrief>> => {
  const briefResult = await runAiGeneration('Client brief', CLIENT_BRIEF_AI_ERROR_MESSAGES, () =>
    dependencies.generateBrief(apiKey, clientBriefInput),
  )
  if (!briefResult.ok) return briefResult
  const languageBrief: LanguageBrief = {
    language: clientBriefInput.language,
    ...briefResult.data,
    generatedAt: new Date(dependencies.nowInMilliseconds()),
  }
  const saveResult = await saveLanguageBrief(supabase, userId, endClientId, languageBrief)
  return saveResult.ok ? { ok: true, data: languageBrief } : saveResult
}

const findOrGenerateBrief = (
  generationSession: GenerationSession,
  endClientToBrief: EndClientToBrief | null,
  existingBrief: LanguageBrief | null,
): Promise<ActionResult<LanguageBrief | null>> =>
  endClientToBrief === null
    ? Promise.resolve({ ok: true, data: existingBrief })
    : generateAndSaveBrief(generationSession, endClientToBrief)

const computeRemainingTimeInMilliseconds = ({
  startedAtInMilliseconds,
  nowInMilliseconds,
}: InterviewPreparationDependencies): number =>
  startedAtInMilliseconds +
  PREPARATION_TIME_BUDGET_IN_MILLISECONDS -
  PREPARATION_SAFETY_MARGIN_IN_MILLISECONDS -
  nowInMilliseconds()

const toQuestionsRequestOptions = (remainingTimeInMilliseconds: number): InterviewQuestionsRequestOptions => ({
  maxRetries:
    remainingTimeInMilliseconds < MINIMUM_TIME_FOR_QUESTIONS_RETRY_IN_MILLISECONDS
      ? 0
      : DEFAULT_INTERVIEW_QUESTIONS_REQUEST_OPTIONS.maxRetries,
  timeout: Math.min(DEFAULT_INTERVIEW_QUESTIONS_REQUEST_OPTIONS.timeout, remainingTimeInMilliseconds),
})

type QuestionsSubject = { language: BriefLanguage; briefMarkdown: string | null }

const buildInterviewQuestionsInput = async (
  { supabase, userId }: GenerationSession,
  jobApplication: JobApplicationOverview,
  { language, briefMarkdown }: QuestionsSubject,
): Promise<InterviewQuestionsInput> => {
  const jobSpec = await findJobSpec(supabase, userId, jobApplication.id)
  return {
    language,
    missionTitle: jobApplication.title,
    stack: jobApplication.stack,
    jobSpecText: jobSpec?.sourceKind === 'text' ? jobSpec.rawText : null,
    endClientName: jobApplication.endClientName,
    intermediaryName: jobApplication.intermediaryName,
    briefMarkdown,
  }
}

const generateAndSaveQuestions = async (
  generationSession: GenerationSession,
  jobApplication: JobApplicationOverview,
  questionsSubject: QuestionsSubject,
): Promise<ActionResult<null>> => {
  const { supabase, userId, apiKey, dependencies } = generationSession
  const interviewQuestionsInput = await buildInterviewQuestionsInput(generationSession, jobApplication, questionsSubject)
  const requestOptions = toQuestionsRequestOptions(computeRemainingTimeInMilliseconds(dependencies))
  const questionsResult = await runAiGeneration('Interview questions', INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES, () =>
    dependencies.generateQuestions(apiKey, interviewQuestionsInput, requestOptions),
  )
  if (!questionsResult.ok) return questionsResult
  return saveInterviewQuestions(supabase, userId, jobApplication.id, {
    language: questionsSubject.language,
    questions: questionsResult.data,
    generatedAt: new Date(dependencies.nowInMilliseconds()),
  })
}

export const generateInterviewPreparationForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  preparationRequest: InterviewPreparationRequest,
  dependencies: InterviewPreparationDependencies,
): Promise<ActionResult<InterviewPreparation>> => {
  const { jobApplicationId, language, regenerate } = preparationRequest
  const contextResult = await loadPreparationContext(supabase, userId, jobApplicationId, language)
  if (!contextResult.ok) return contextResult
  const { jobApplication, preparation } = contextResult.data
  const endClientToBrief = findEndClientToBrief(contextResult.data, preparationRequest)
  const shouldGenerateQuestions = regenerate || preparation.questions === null
  if (endClientToBrief === null && !shouldGenerateQuestions) return { ok: true, data: preparation }
  if (endClientToBrief !== null && !isBriefableEndClientName(endClientToBrief.clientBriefInput.endClientName)) {
    return rejectWith(CLIENT_BRIEF_MESSAGES.unusableEndClientName)
  }
  const apiKey = await dependencies.getApiKey(userId)
  if (apiKey === null) return rejectWith(CLIENT_BRIEF_AI_ERROR_MESSAGES.missing_api_key)
  const generationSession: GenerationSession = { supabase, userId, apiKey, dependencies }
  const briefResult = await findOrGenerateBrief(generationSession, endClientToBrief, preparation.brief)
  if (!briefResult.ok) return briefResult
  const hasTimeLeftForQuestions =
    computeRemainingTimeInMilliseconds(dependencies) >= MINIMUM_QUESTIONS_TIME_IN_MILLISECONDS
  if (shouldGenerateQuestions && hasTimeLeftForQuestions) {
    const questionsResult = await generateAndSaveQuestions(generationSession, jobApplication, {
      language,
      briefMarkdown: briefResult.data?.markdown ?? null,
    })
    if (!questionsResult.ok) return questionsResult
  }
  return findInterviewPreparationForUser(supabase, userId, jobApplicationId, language)
}
