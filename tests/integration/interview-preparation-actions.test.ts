import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CLIENT_BRIEF_AI_ERROR_MESSAGES, CLIENT_BRIEF_MESSAGES, type ClientBrief } from '@/domain/client-brief'
import { type BriefLanguage, INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { StackItem } from '@/domain/types'
import { AiError } from '@/server/ai/ai-error'
import {
  findInterviewPreparationForUser,
  generateInterviewPreparationForUser,
  type InterviewPreparationDependencies,
} from '@/server/interview-preparation/prepare-interview'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { saveJobSpecContent } from '@/server/repositories/job-specs-repository'
import type { Database } from '@/server/supabase/database-types'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const NOW_IN_MILLISECONDS = Date.parse('2026-10-18T10:00:00.000Z')
const EXISTING_BRIEF_MARKDOWN = '## Chiffres clés\n\n- 120 salariés (2025)'
const MISSION_STACK: StackItem[] = [{ name: 'React', category: 'framework', origin: 'job_spec' }]

const generatedBrief: ClientBrief = {
  markdown: '## Chiffres clés\n\n- 3 000 salariés (2026)',
  sources: [{ title: 'Rapport annuel', url: 'https://example.com/rapport' }],
}

const generatedQuestions = Array.from(
  { length: 8 },
  (_question, questionIndex) => `Comment l'équipe travaille-t-elle sur le sujet ${questionIndex + 1} ?`,
)

const createTestUser = (): Promise<TestUser> =>
  createSignedInTestClient(`interview-preparation-${randomUUID()}@test.local`)

const createDependencies = (
  overrides: Partial<InterviewPreparationDependencies> = {},
): InterviewPreparationDependencies => ({
  getApiKey: jest.fn().mockResolvedValue('sk-ant-test-key'),
  generateBrief: jest.fn().mockResolvedValue(generatedBrief),
  generateQuestions: jest.fn().mockResolvedValue(generatedQuestions),
  startedAtInMilliseconds: NOW_IN_MILLISECONDS,
  nowInMilliseconds: () => NOW_IN_MILLISECONDS,
  ...overrides,
})

const findEndClientIdOrFail = async (user: TestUser, jobApplicationId: string): Promise<string> => {
  const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
  if (!overviewResult.ok || overviewResult.data.endClientId === null) throw new Error('Expected an end client')
  return overviewResult.data.endClientId
}

const insertBriefOrFail = async (
  user: TestUser,
  endClientId: string,
  language: BriefLanguage,
  markdown: string,
): Promise<void> => {
  const { error } = await user.client.from('end_client_briefs').insert({
    user_id: user.userId,
    end_client_id: endClientId,
    language,
    markdown,
    sources: [{ title: 'Site', url: 'https://client.example' }],
    generated_at: '2026-10-01T09:00:00+00:00',
  })
  if (error) throw error
}

const insertQuestionsOrFail = async (
  user: TestUser,
  jobApplicationId: string,
  language: BriefLanguage,
  generatedAt: string,
): Promise<void> => {
  const { error } = await user.client.from('interview_questions').insert({
    user_id: user.userId,
    job_application_id: jobApplicationId,
    language,
    questions: ['Quelle est la taille de l’équipe ?'],
    generated_at: generatedAt,
  })
  if (error) throw error
}

const readBriefMarkdowns = async (endClientId: string): Promise<{ language: string; markdown: string }[]> => {
  const { data } = await createServiceRoleTestClient()
    .from('end_client_briefs')
    .select('language, markdown')
    .eq('end_client_id', endClientId)
  return data ?? []
}

const readStoredQuestions = async (jobApplicationId: string): Promise<{ language: string; questions: unknown }[]> => {
  const { data } = await createServiceRoleTestClient()
    .from('interview_questions')
    .select('language, questions')
    .eq('job_application_id', jobApplicationId)
  return data ?? []
}

const createJobApplicationWithEndClient = async (user: TestUser): Promise<{ jobApplicationId: string; endClientId: string }> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
    title: 'Développeur React senior',
    stack: MISSION_STACK,
    intermediaryName: 'Malt',
    endClientName: 'BNP Paribas Real Estate',
    endClientParentName: 'BNP Paribas',
  })
  return { jobApplicationId, endClientId: await findEndClientIdOrFail(user, jobApplicationId) }
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('generateInterviewPreparationForUser', () => {
  it('generates only the missing questions when the end client already has a brief in this language', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    await insertBriefOrFail(user, endClientId, 'fr', EXISTING_BRIEF_MARKDOWN)
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateBrief).not.toHaveBeenCalled()
    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      {
        language: 'fr',
        missionTitle: 'Développeur React senior',
        stack: MISSION_STACK,
        jobSpecText: null,
        endClientName: 'BNP Paribas Real Estate',
        intermediaryName: 'Malt',
        briefMarkdown: EXISTING_BRIEF_MARKDOWN,
      },
      { maxRetries: 1, timeout: 30_000 },
    )
    expect(preparationResult).toEqual({
      ok: true,
      data: {
        language: 'fr',
        endClientId,
        endClientName: 'BNP Paribas Real Estate',
        brief: {
          language: 'fr',
          markdown: EXISTING_BRIEF_MARKDOWN,
          sources: [{ title: 'Site', url: 'https://client.example' }],
          generatedAt: new Date('2026-10-01T09:00:00.000Z'),
        },
        questions: { language: 'fr', questions: generatedQuestions, generatedAt: new Date(NOW_IN_MILLISECONDS) },
        notes: null,
        lastUsedLanguage: 'fr',
      },
    })
  })

  it('generates the brief of the end client in the chosen language, then the questions from its markdown', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    await insertBriefOrFail(user, endClientId, 'fr', EXISTING_BRIEF_MARKDOWN)
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'en', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateBrief).toHaveBeenCalledWith('sk-ant-test-key', {
      endClientName: 'BNP Paribas Real Estate',
      parentGroupName: 'BNP Paribas',
      language: 'en',
    })
    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ language: 'en', briefMarkdown: generatedBrief.markdown }),
      expect.anything(),
    )
    expect(preparationResult.ok && preparationResult.data.brief).toEqual({
      language: 'en',
      ...generatedBrief,
      generatedAt: new Date(NOW_IN_MILLISECONDS),
    })
    expect(await readBriefMarkdowns(endClientId)).toEqual(
      expect.arrayContaining([
        { language: 'fr', markdown: EXISTING_BRIEF_MARKDOWN },
        { language: 'en', markdown: generatedBrief.markdown },
      ]),
    )
  })

  it('generates nothing and asks for no key when the brief and the questions already exist', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    await insertBriefOrFail(user, endClientId, 'fr', EXISTING_BRIEF_MARKDOWN)
    await insertQuestionsOrFail(user, jobApplicationId, 'fr', '2026-10-02T09:00:00+00:00')
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult.ok).toBe(true)
    expect(dependencies.getApiKey).not.toHaveBeenCalled()
    expect(dependencies.generateBrief).not.toHaveBeenCalled()
    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
  })

  it('regenerates and replaces both the brief and the questions', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    await insertBriefOrFail(user, endClientId, 'fr', EXISTING_BRIEF_MARKDOWN)
    await insertQuestionsOrFail(user, jobApplicationId, 'fr', '2026-10-02T09:00:00+00:00')
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: true },
      dependencies,
    )

    expect(dependencies.generateBrief).toHaveBeenCalledTimes(1)
    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ briefMarkdown: generatedBrief.markdown }),
      expect.anything(),
    )
    expect(preparationResult.ok && preparationResult.data.brief?.markdown).toBe(generatedBrief.markdown)
    expect(await readBriefMarkdowns(endClientId)).toEqual([{ language: 'fr', markdown: generatedBrief.markdown }])
    expect(await readStoredQuestions(jobApplicationId)).toEqual([{ language: 'fr', questions: generatedQuestions }])
  })

  it('generates only the questions when the end client is unknown, even with regeneration', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'en', regenerate: true },
      dependencies,
    )

    expect(dependencies.generateBrief).not.toHaveBeenCalled()
    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ endClientName: null, briefMarkdown: null }),
      expect.anything(),
    )
    expect(preparationResult).toEqual({
      ok: true,
      data: {
        language: 'en',
        endClientId: null,
        endClientName: null,
        brief: null,
        questions: { language: 'en', questions: generatedQuestions, generatedAt: new Date(NOW_IN_MILLISECONDS) },
        notes: null,
        lastUsedLanguage: 'en',
      },
    })
  })

  it('prevents user B from generating for the job application of user A, without writing anything', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(userA)
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      userB.client,
      userB.userId,
      { jobApplicationId, language: 'fr', regenerate: true },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE })
    expect(dependencies.generateBrief).not.toHaveBeenCalled()
    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
    expect(await readBriefMarkdowns(endClientId)).toEqual([])
    expect(await readStoredQuestions(jobApplicationId)).toEqual([])
  })

  it('keeps the generated brief and reports the error of claude when the questions fail', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    const dependencies = createDependencies({ generateQuestions: jest.fn().mockRejectedValue(new AiError('timeout')) })

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: INTERVIEW_QUESTIONS_AI_ERROR_MESSAGES.timeout })
    expect(await readBriefMarkdowns(endClientId)).toEqual([{ language: 'fr', markdown: generatedBrief.markdown }])
    expect(await readStoredQuestions(jobApplicationId)).toEqual([])
  })

  it.each([
    ['unknown', 'La génération des questions a échoué, réessaie.'],
    ['refused', "Claude n'a pas pu générer ces questions. Réessaie plus tard."],
    ['invalid_api_key', CLIENT_BRIEF_AI_ERROR_MESSAGES.invalid_api_key],
  ] as const)('talks about the questions, not the brief, when the questions fail with %s', async (aiErrorKind, expectedMessage) => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const dependencies = createDependencies({ generateQuestions: jest.fn().mockRejectedValue(new AiError(aiErrorKind)) })

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: expectedMessage })
  })

  it('saves nothing and reports the error of claude when the brief fails', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    const dependencies = createDependencies({ generateBrief: jest.fn().mockRejectedValue(new AiError('refused')) })

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: CLIENT_BRIEF_AI_ERROR_MESSAGES.refused })
    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
    expect(await readBriefMarkdowns(endClientId)).toEqual([])
  })

  it('asks for the claude key in the settings when the user has none', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const dependencies = createDependencies({ getApiKey: jest.fn().mockResolvedValue(null) })

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: CLIENT_BRIEF_AI_ERROR_MESSAGES.missing_api_key })
    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
  })

  it('refuses to generate a brief for an end client name made only of angle brackets', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { endClientName: '<>' })
    const dependencies = createDependencies()

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(preparationResult).toEqual({ ok: false, errorMessage: CLIENT_BRIEF_MESSAGES.unusableEndClientName })
    expect(dependencies.generateBrief).not.toHaveBeenCalled()
    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
  })

  it('sends the text of a pasted job spec to the questions', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await saveJobSpecContent(user.client, user.userId, jobApplicationId, { sourceKind: 'text', rawText: 'Refonte du portail' }, null)
    const dependencies = createDependencies()

    await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ jobSpecText: 'Refonte du portail' }),
      expect.anything(),
    )
  })

  it('never sends a pdf job spec to the questions', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await saveJobSpecContent(
      user.client,
      user.userId,
      jobApplicationId,
      { sourceKind: 'pdf', storagePath: `${user.userId}/${jobApplicationId}/fiche.pdf` },
      null,
    )
    const dependencies = createDependencies()

    await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateQuestions).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ jobSpecText: null }),
      expect.anything(),
    )
  })

  it('asks for the questions without retry and within the remaining time when the brief took most of the budget', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const dependencies = createDependencies({ startedAtInMilliseconds: NOW_IN_MILLISECONDS - 265_000 })

    await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateQuestions).toHaveBeenCalledWith('sk-ant-test-key', expect.anything(), {
      maxRetries: 0,
      timeout: 20_000,
    })
  })

  it('keeps the thirty second timeout but drops the retry when less than sixty five seconds remain', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const dependencies = createDependencies({ startedAtInMilliseconds: NOW_IN_MILLISECONDS - 230_000 })

    await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateQuestions).toHaveBeenCalledWith('sk-ant-test-key', expect.anything(), {
      maxRetries: 0,
      timeout: 30_000,
    })
  })

  it('keeps the saved brief and skips the questions when less than ten seconds remain', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    let elapsedTimeInMilliseconds = 0
    const dependencies = createDependencies({
      generateBrief: jest.fn().mockImplementation(async () => {
        elapsedTimeInMilliseconds = 280_000
        return generatedBrief
      }),
      nowInMilliseconds: () => NOW_IN_MILLISECONDS + elapsedTimeInMilliseconds,
    })

    const preparationResult = await generateInterviewPreparationForUser(
      user.client,
      user.userId,
      { jobApplicationId, language: 'fr', regenerate: false },
      dependencies,
    )

    expect(dependencies.generateQuestions).not.toHaveBeenCalled()
    expect(preparationResult.ok && preparationResult.data.questions).toBeNull()
    expect(preparationResult.ok && preparationResult.data.brief?.markdown).toBe(generatedBrief.markdown)
    expect(await readBriefMarkdowns(endClientId)).toEqual([{ language: 'fr', markdown: generatedBrief.markdown }])
  })
})

describe('findInterviewPreparationForUser', () => {
  it('returns the brief and questions of the language, the end client notes and the language of the latest questions', async () => {
    const user = await createTestUser()
    const { jobApplicationId, endClientId } = await createJobApplicationWithEndClient(user)
    await user.client.from('end_clients').update({ notes: 'Parler de la refonte' }).eq('id', endClientId)
    await insertBriefOrFail(user, endClientId, 'en', '## Key figures\n\n- 120 employees (2025)')
    await insertQuestionsOrFail(user, jobApplicationId, 'fr', '2026-10-02T09:00:00+00:00')
    await insertQuestionsOrFail(user, jobApplicationId, 'en', '2026-10-03T09:00:00+00:00')

    const preparationResult = await findInterviewPreparationForUser(user.client, user.userId, jobApplicationId, 'fr')

    expect(preparationResult).toEqual({
      ok: true,
      data: {
        language: 'fr',
        endClientId,
        endClientName: 'BNP Paribas Real Estate',
        brief: null,
        questions: {
          language: 'fr',
          questions: ['Quelle est la taille de l’équipe ?'],
          generatedAt: new Date('2026-10-02T09:00:00.000Z'),
        },
        notes: 'Parler de la refonte',
        lastUsedLanguage: 'en',
      },
    })
  })

  it('returns an empty preparation for a job application without end client nor questions', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    expect(await findInterviewPreparationForUser(user.client, user.userId, jobApplicationId, 'en')).toEqual({
      ok: true,
      data: {
        language: 'en',
        endClientId: null,
        endClientName: null,
        brief: null,
        questions: null,
        notes: null,
        lastUsedLanguage: null,
      },
    })
  })

  it('prevents user B from reading the preparation of user A', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const { jobApplicationId } = await createJobApplicationWithEndClient(userA)

    expect(await findInterviewPreparationForUser(userB.client, userB.userId, jobApplicationId, 'fr')).toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })
  })
})
