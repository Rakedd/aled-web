import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefContent } from '@/domain/technical-brief'
import type { StackItem } from '@/domain/types'
import {
  findTechnicalBriefViewForUser,
  generateTechnicalBriefForUser,
  type TechnicalBriefDependencies,
} from '@/server/interview-preparation/prepare-technical-brief'
import { setSentCvVersion } from '@/server/repositories/cvs-repository'
import type { Database } from '@/server/supabase/database-types'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const PDF_TEXT = '%PDF-1.7 cv envoyé'
const NOW = new Date('2026-10-23T10:00:00.000Z')
const MISSION_STACK: StackItem[] = [{ name: 'React', category: 'framework', origin: 'job_spec' }]

const usableContent: TechnicalBriefContent = {
  storyline: Array.from({ length: 5 }, (_, stepIndex) => ({ title: `Étape ${stepIndex + 1}`, guidance: 'Raconte' })),
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
}

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`technical-brief-actions-${randomUUID()}@test.local`)

const createDependencies = (overrides: Partial<TechnicalBriefDependencies> = {}): TechnicalBriefDependencies => ({
  getApiKey: jest.fn().mockResolvedValue('sk-ant-test-key'),
  generateTechnicalBrief: jest.fn().mockResolvedValue({ cvStatus: 'usable', content: usableContent }),
  now: () => NOW,
  ...overrides,
})

const insertCvVersionOrFail = async (user: TestUser, label: string): Promise<string> => {
  const versionId = randomUUID()
  const storagePath = `${user.userId}/${versionId}.pdf`
  const { error: uploadError } = await user.client.storage
    .from('cvs')
    .upload(storagePath, new TextEncoder().encode(PDF_TEXT), { contentType: 'application/pdf' })
  if (uploadError) throw uploadError
  const { error } = await user.client.from('cv_versions').insert({
    id: versionId,
    user_id: user.userId,
    label,
    storage_path: storagePath,
    file_name: 'cv.pdf',
    byte_size: PDF_TEXT.length,
    uploaded_at: '2026-10-20T09:00:00.000Z',
  })
  if (error) throw error
  return versionId
}

const createApplicationWithSentCv = async (
  user: TestUser,
  label = 'CV envoyé',
): Promise<{ jobApplicationId: string; versionId: string }> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
    title: 'Développeur React senior',
    stack: MISSION_STACK,
  })
  const versionId = await insertCvVersionOrFail(user, label)
  const sentCvResult = await setSentCvVersion(user.client, user.userId, jobApplicationId, versionId)
  if (!sentCvResult.ok) throw new Error(sentCvResult.errorMessage)
  return { jobApplicationId, versionId }
}

describe('technical brief actions', () => {
  it('generates, saves and reads back a technical brief for an own job application', async () => {
    const user = await createTestUser()
    const { jobApplicationId, versionId } = await createApplicationWithSentCv(user)
    const dependencies = createDependencies()

    const generationResult = await generateTechnicalBriefForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr' },
      dependencies,
    )
    const viewResult = await findTechnicalBriefViewForUser(user.client, user.userId, jobApplicationId, 'fr')

    expect(dependencies.generateTechnicalBrief).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ cvPdfBase64: Buffer.from(PDF_TEXT).toString('base64'), stack: MISSION_STACK }),
    )
    expect(generationResult.ok && generationResult.data.kind).toBe('generated')
    expect(viewResult).toEqual({
      ok: true,
      data: {
        language: 'fr',
        availability: 'ready',
        isCvOutdated: false,
        brief: {
          language: 'fr',
          content: usableContent,
          cvVersionId: versionId,
          cvLabel: 'CV envoyé',
          cvUploadedAt: new Date('2026-10-20T09:00:00.000Z'),
          generatedAt: NOW,
        },
      },
    })
  })

  it('refuses the job application of another user without calling the ai', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const { jobApplicationId } = await createApplicationWithSentCv(owner)
    const dependencies = createDependencies()

    const result = await generateTechnicalBriefForUser(
      intruder.client,
      intruder.userId,
      { jobApplicationId, language: 'fr' },
      dependencies,
    )

    expect(result).toEqual({ ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE })
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
    const ownerView = await findTechnicalBriefViewForUser(owner.client, owner.userId, jobApplicationId, 'fr')
    expect(ownerView.ok && ownerView.data.brief).toBeNull()
  })

  it('refuses a job application without a sent cv', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { stack: MISSION_STACK })
    const dependencies = createDependencies()

    const result = await generateTechnicalBriefForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr' },
      dependencies,
    )

    expect(result).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.missingSentCv })
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
  })

  it('shows the stored brief as outdated after the sent cv changes', async () => {
    const user = await createTestUser()
    const { jobApplicationId } = await createApplicationWithSentCv(user)
    await generateTechnicalBriefForUser(user.client, user.userId, { jobApplicationId, language: 'fr' }, createDependencies())
    const newVersionId = await insertCvVersionOrFail(user, 'CV mis à jour')
    await setSentCvVersion(user.client, user.userId, jobApplicationId, newVersionId)

    const viewResult = await findTechnicalBriefViewForUser(user.client, user.userId, jobApplicationId, 'fr')

    expect(viewResult.ok && viewResult.data.isCvOutdated).toBe(true)
    expect(viewResult.ok && viewResult.data.brief?.cvLabel).toBe('CV envoyé')
  })
})
