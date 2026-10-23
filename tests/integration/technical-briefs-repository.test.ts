import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CV_MESSAGES } from '@/domain/cv-library'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { TechnicalBrief } from '@/domain/technical-brief'
import { findCvVersionForTechnicalBrief } from '@/server/repositories/cvs-repository'
import { downloadJobSpecPdfAsBase64, saveJobSpecContent, uploadJobSpecPdfFile } from '@/server/repositories/job-specs-repository'
import { findTechnicalBrief, saveTechnicalBrief } from '@/server/repositories/technical-briefs-repository'
import type { Database } from '@/server/supabase/database-types'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

type TestUser = { client: SupabaseClient<Database>; userId: string }

const PDF_TEXT = '%PDF-1.7 cv envoyé'
const CV_UPLOADED_AT = '2026-10-20T09:00:00.000Z'

const createTestUser = (): Promise<TestUser> =>
  createSignedInTestClient(`technical-briefs-repository-${randomUUID()}@test.local`)

const insertCvVersionWithPdfOrFail = async (user: TestUser): Promise<string> => {
  const versionId = randomUUID()
  const storagePath = `${user.userId}/${versionId}.pdf`
  const { error: uploadError } = await user.client.storage
    .from('cvs')
    .upload(storagePath, new TextEncoder().encode(PDF_TEXT), { contentType: 'application/pdf' })
  if (uploadError) throw uploadError
  const { error } = await user.client.from('cv_versions').insert({
    id: versionId,
    user_id: user.userId,
    label: 'CV envoyé',
    storage_path: storagePath,
    file_name: 'cv.pdf',
    byte_size: PDF_TEXT.length,
    uploaded_at: CV_UPLOADED_AT,
  })
  if (error) throw error
  return versionId
}

const buildTechnicalBrief = (overrides: Partial<TechnicalBrief> = {}): TechnicalBrief => ({
  language: 'fr',
  content: {
    storyline: Array.from({ length: 5 }, (_, stepIndex) => ({
      title: `Étape ${stepIndex + 1}`,
      guidance: 'Commence par ton dernier projet',
    })),
    missions: [
      {
        label: 'Mission React',
        period: '2024-2025',
        emphasis: 'lean_on',
        sharedStack: ['React'],
        why: 'Même stack que la mission',
        reflectionQuestions: ['Comment as-tu structuré le front ?'],
      },
    ],
    gaps: [{ stackItem: 'Kafka', question: 'As-tu déjà opéré Kafka ?' }],
  },
  cvVersionId: null,
  cvLabel: 'CV envoyé',
  cvUploadedAt: new Date(CV_UPLOADED_AT),
  generatedAt: new Date('2026-10-23T09:00:00.000Z'),
  ...overrides,
})

describe('technical briefs repository', () => {
  it('reads the label, date and pdf of an own cv version', async () => {
    const user = await createTestUser()
    const versionId = await insertCvVersionWithPdfOrFail(user)

    const result = await findCvVersionForTechnicalBrief(user.client, user.userId, versionId)

    expect(result).toEqual({
      ok: true,
      data: {
        versionId,
        label: 'CV envoyé',
        uploadedAt: new Date(CV_UPLOADED_AT),
        pdfBase64: Buffer.from(PDF_TEXT).toString('base64'),
      },
    })
  })

  it('refuses the cv version of another user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const versionId = await insertCvVersionWithPdfOrFail(owner)

    const result = await findCvVersionForTechnicalBrief(intruder.client, intruder.userId, versionId)

    expect(result).toEqual({ ok: false, errorMessage: CV_MESSAGES.cvVersionNotFound })
  })

  it('refuses a cv version whose file is missing', async () => {
    const user = await createTestUser()
    const versionId = await insertCvVersionWithPdfOrFail(user)
    const { error } = await user.client.storage.from('cvs').remove([`${user.userId}/${versionId}.pdf`])
    expect(error).toBeNull()

    const result = await findCvVersionForTechnicalBrief(user.client, user.userId, versionId)

    expect(result).toEqual({ ok: false, errorMessage: CV_MESSAGES.cvVersionNotFound })
  })

  it('downloads a pdf job spec and returns null for a text job spec', async () => {
    const user = await createTestUser()
    const pdfJobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const textJobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const storagePath = await uploadJobSpecPdfFile(
      user.client,
      user.userId,
      pdfJobApplicationId,
      new TextEncoder().encode('%PDF-1.4 fiche'),
    )
    await saveJobSpecContent(user.client, user.userId, pdfJobApplicationId, { sourceKind: 'pdf', storagePath }, null)
    await saveJobSpecContent(
      user.client,
      user.userId,
      textJobApplicationId,
      { sourceKind: 'text', rawText: 'Fiche en texte' },
      null,
    )

    const pdfBase64 = await downloadJobSpecPdfAsBase64(user.client, user.userId, pdfJobApplicationId)
    const textJobSpecPdfBase64 = await downloadJobSpecPdfAsBase64(user.client, user.userId, textJobApplicationId)

    expect(pdfBase64).toBe(Buffer.from('%PDF-1.4 fiche').toString('base64'))
    expect(textJobSpecPdfBase64).toBeNull()
  })

  it('saves then replaces the technical brief of a language and reads it back', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const versionId = await insertCvVersionWithPdfOrFail(user)
    const firstBrief = buildTechnicalBrief({ cvVersionId: versionId })
    const secondBrief = buildTechnicalBrief({
      cvVersionId: versionId,
      cvLabel: 'CV mis à jour',
      generatedAt: new Date('2026-10-24T09:00:00.000Z'),
    })

    expect(await findTechnicalBrief(user.client, user.userId, jobApplicationId, 'fr')).toBeNull()
    expect(await saveTechnicalBrief(user.client, user.userId, jobApplicationId, firstBrief)).toEqual({
      ok: true,
      data: null,
    })
    expect(await findTechnicalBrief(user.client, user.userId, jobApplicationId, 'fr')).toEqual(firstBrief)
    await saveTechnicalBrief(user.client, user.userId, jobApplicationId, secondBrief)

    expect(await findTechnicalBrief(user.client, user.userId, jobApplicationId, 'fr')).toEqual(secondBrief)
    expect(await findTechnicalBrief(user.client, user.userId, jobApplicationId, 'en')).toBeNull()
  })

  it('refuses to save a technical brief on the job application of another user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId)

    const result = await saveTechnicalBrief(intruder.client, intruder.userId, jobApplicationId, buildTechnicalBrief())

    expect(result).toEqual({ ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE })
    expect(await findTechnicalBrief(owner.client, owner.userId, jobApplicationId, 'fr')).toBeNull()
  })

  it('refuses to save a technical brief on a cv version that is not the user own', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(intruder.client, intruder.userId)
    const ownerVersionId = await insertCvVersionWithPdfOrFail(owner)

    const result = await saveTechnicalBrief(
      intruder.client,
      intruder.userId,
      jobApplicationId,
      buildTechnicalBrief({ cvVersionId: ownerVersionId }),
    )

    expect(result).toEqual({ ok: false, errorMessage: CV_MESSAGES.cvVersionNotFound })
    expect(await findTechnicalBrief(intruder.client, intruder.userId, jobApplicationId, 'fr')).toBeNull()
  })

  it('returns null for a stored technical brief whose content does not normalize', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const { error } = await user.client.from('technical_briefs').insert({
      user_id: user.userId,
      job_application_id: jobApplicationId,
      language: 'fr',
      cv_label: 'CV envoyé',
      cv_uploaded_at: CV_UPLOADED_AT,
      generated_at: CV_UPLOADED_AT,
      content: { ...buildTechnicalBrief().content, storyline: buildTechnicalBrief().content.storyline.slice(0, 4) },
    })
    expect(error).toBeNull()

    expect(await findTechnicalBrief(user.client, user.userId, jobApplicationId, 'fr')).toBeNull()
  })

  it('returns no job spec pdf for the job application of another user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId)
    const storagePath = await uploadJobSpecPdfFile(
      owner.client,
      owner.userId,
      jobApplicationId,
      new TextEncoder().encode('%PDF-1.4 fiche'),
    )
    await saveJobSpecContent(owner.client, owner.userId, jobApplicationId, { sourceKind: 'pdf', storagePath }, null)

    expect(await downloadJobSpecPdfAsBase64(intruder.client, intruder.userId, jobApplicationId)).toBeNull()
  })
})
