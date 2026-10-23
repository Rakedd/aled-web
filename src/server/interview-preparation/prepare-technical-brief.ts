import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { JobApplicationOverview } from '@/domain/job-application'
import {
  TECHNICAL_BRIEF_AI_ERROR_MESSAGES,
  TECHNICAL_BRIEF_MESSAGES,
  type TechnicalBriefGenerationOutcome,
  type TechnicalBriefRequest,
  type TechnicalBriefView,
  toTechnicalBriefView,
} from '@/domain/technical-brief'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import {
  type GeneratedTechnicalBrief,
  generateTechnicalBrief,
  type TechnicalBriefInput,
  type TechnicalBriefJobSpec,
} from '@/server/ai/generate-technical-brief'
import { findCvVersionForTechnicalBrief } from '@/server/repositories/cvs-repository'
import { findLanguageBrief } from '@/server/repositories/interview-preparation-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { downloadJobSpecPdfAsBase64, findJobSpec } from '@/server/repositories/job-specs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { findTechnicalBrief, saveTechnicalBrief } from '@/server/repositories/technical-briefs-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type TechnicalBriefDependencies = {
  getApiKey: (userId: string) => Promise<string | null>
  generateTechnicalBrief: (apiKey: string, technicalBriefInput: TechnicalBriefInput) => Promise<GeneratedTechnicalBrief>
  now: () => Date
}

type TechnicalBriefContext = { jobApplication: JobApplicationOverview; view: TechnicalBriefView }

export const createTechnicalBriefDependencies = (): TechnicalBriefDependencies => ({
  getApiKey: getDecryptedAnthropicApiKeyForUser,
  generateTechnicalBrief: (apiKey, technicalBriefInput) =>
    generateTechnicalBrief(createAnthropicClient(apiKey), technicalBriefInput),
  now: () => new Date(),
})

const loadTechnicalBriefContext = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<TechnicalBriefContext>> => {
  const jobApplicationResult = await findJobApplicationOverview(supabase, userId, jobApplicationId)
  if (!jobApplicationResult.ok) return jobApplicationResult
  const jobApplication = jobApplicationResult.data
  const brief = await findTechnicalBrief(supabase, userId, jobApplicationId, language)
  const view = toTechnicalBriefView({
    language,
    sentCvVersionId: jobApplication.sentCv?.versionId ?? null,
    hasMissionDetails: jobApplication.stack.length > 0 || jobApplication.hasJobSpec,
    brief,
  })
  return { ok: true, data: { jobApplication, view } }
}

export const findTechnicalBriefViewForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<TechnicalBriefView>> => {
  const contextResult = await loadTechnicalBriefContext(supabase, userId, jobApplicationId, language)
  return contextResult.ok ? { ok: true, data: contextResult.data.view } : contextResult
}

const findJobSpecForTechnicalBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<TechnicalBriefJobSpec | null> => {
  const jobSpec = await findJobSpec(supabase, userId, jobApplicationId)
  if (jobSpec === null) return null
  if (jobSpec.sourceKind === 'text') return jobSpec.rawText === null ? null : { kind: 'text', text: jobSpec.rawText }
  const base64Pdf = await downloadJobSpecPdfAsBase64(supabase, userId, jobApplicationId)
  return base64Pdf === null ? null : { kind: 'pdf', base64Pdf }
}

const findEndClientBriefMarkdown = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string | null,
  language: BriefLanguage,
): Promise<string | null> => {
  if (endClientId === null) return null
  const languageBrief = await findLanguageBrief(supabase, userId, endClientId, language)
  return languageBrief?.markdown ?? null
}

const runTechnicalBriefGeneration = async (
  generate: () => Promise<GeneratedTechnicalBrief>,
): Promise<ActionResult<GeneratedTechnicalBrief>> => {
  try {
    return { ok: true, data: await generate() }
  } catch (generationError) {
    const aiErrorLogContext = describeAiErrorForLogs(generationError)
    console.error('Technical brief generation failed', aiErrorLogContext)
    return rejectWith(TECHNICAL_BRIEF_AI_ERROR_MESSAGES[aiErrorLogContext.aiErrorKind])
  }
}

export const generateTechnicalBriefForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { jobApplicationId, language }: TechnicalBriefRequest,
  dependencies: TechnicalBriefDependencies,
): Promise<ActionResult<TechnicalBriefGenerationOutcome>> => {
  const contextResult = await loadTechnicalBriefContext(supabase, userId, jobApplicationId, language)
  if (!contextResult.ok) return contextResult
  const { jobApplication, view } = contextResult.data
  if (view.availability === 'missing_sent_cv' || jobApplication.sentCv === null) {
    return rejectWith(TECHNICAL_BRIEF_MESSAGES.missingSentCv)
  }
  if (view.availability === 'missing_mission_details') return rejectWith(TECHNICAL_BRIEF_MESSAGES.missingMissionDetails)
  const apiKey = await dependencies.getApiKey(userId)
  if (apiKey === null) return rejectWith(TECHNICAL_BRIEF_AI_ERROR_MESSAGES.missing_api_key)
  const cvVersionResult = await findCvVersionForTechnicalBrief(supabase, userId, jobApplication.sentCv.versionId)
  if (!cvVersionResult.ok) return rejectWith(TECHNICAL_BRIEF_MESSAGES.missingSentCv)
  const cvVersion = cvVersionResult.data
  const [jobSpec, briefMarkdown] = await Promise.all([
    findJobSpecForTechnicalBrief(supabase, userId, jobApplicationId),
    findEndClientBriefMarkdown(supabase, userId, jobApplication.endClientId, language),
  ])
  if (jobApplication.stack.length === 0 && jobSpec === null) {
    return rejectWith(TECHNICAL_BRIEF_MESSAGES.missingMissionDetails)
  }
  const generationResult = await runTechnicalBriefGeneration(() =>
    dependencies.generateTechnicalBrief(apiKey, {
      language,
      cvPdfBase64: cvVersion.pdfBase64,
      missionTitle: jobApplication.title,
      stack: jobApplication.stack,
      jobSpec,
      endClientName: jobApplication.endClientName,
      intermediaryName: jobApplication.intermediaryName,
      briefMarkdown,
    }),
  )
  if (!generationResult.ok) return generationResult
  const generatedTechnicalBrief = generationResult.data
  if (generatedTechnicalBrief.cvStatus === 'missing_mission_stacks') {
    return { ok: true, data: { kind: 'cv_missing_information' } }
  }
  if (generatedTechnicalBrief.cvStatus === 'unreadable') return { ok: true, data: { kind: 'cv_unreadable' } }
  const saveResult = await saveTechnicalBrief(supabase, userId, jobApplicationId, {
    language,
    content: generatedTechnicalBrief.content,
    cvVersionId: cvVersion.versionId,
    cvLabel: cvVersion.label,
    cvUploadedAt: cvVersion.uploadedAt,
    generatedAt: dependencies.now(),
  })
  if (!saveResult.ok) return saveResult
  const reloadedViewResult = await findTechnicalBriefViewForUser(supabase, userId, jobApplicationId, language)
  return reloadedViewResult.ok ? { ok: true, data: { kind: 'generated', view: reloadedViewResult.data } } : reloadedViewResult
}
