import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import { type BriefLanguage, isBriefLanguage } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { normalizeTechnicalBriefContent, type TechnicalBrief } from '@/domain/technical-brief'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

type TechnicalBriefRow = Pick<
  Tables<'technical_briefs'>,
  'language' | 'content' | 'cv_version_id' | 'cv_label' | 'cv_uploaded_at' | 'generated_at'
>

const toTechnicalBrief = (technicalBriefRow: TechnicalBriefRow): TechnicalBrief | null => {
  if (!isBriefLanguage(technicalBriefRow.language)) return null
  const content = normalizeTechnicalBriefContent(technicalBriefRow.content)
  if (content === null) return null
  return {
    language: technicalBriefRow.language,
    content,
    cvVersionId: technicalBriefRow.cv_version_id,
    cvLabel: technicalBriefRow.cv_label,
    cvUploadedAt: new Date(technicalBriefRow.cv_uploaded_at),
    generatedAt: new Date(technicalBriefRow.generated_at),
  }
}

export const findTechnicalBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<TechnicalBrief | null> => {
  const { data, error } = await supabase
    .from('technical_briefs')
    .select('language, content, cv_version_id, cv_label, cv_uploaded_at, generated_at')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .eq('language', language)
    .maybeSingle()
  if (error) throw toRepositoryError('findTechnicalBrief', error)
  return data === null ? null : toTechnicalBrief(data)
}

export const saveTechnicalBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  technicalBrief: TechnicalBrief,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('technical_briefs').upsert(
    {
      user_id: userId,
      job_application_id: jobApplicationId,
      language: technicalBrief.language,
      cv_version_id: technicalBrief.cvVersionId,
      cv_label: technicalBrief.cvLabel,
      cv_uploaded_at: technicalBrief.cvUploadedAt.toISOString(),
      content: technicalBrief.content,
      generated_at: technicalBrief.generatedAt.toISOString(),
    },
    { onConflict: 'user_id,job_application_id,language' },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (error) throw toRepositoryError('saveTechnicalBrief', error)
  return { ok: true, data: null }
}
