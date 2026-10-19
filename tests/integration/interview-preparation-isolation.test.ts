import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/server/supabase/database-types'
import { createJobApplicationOrFail } from './job-application-fixtures'
import { createAnonymousTestClient, createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'

const MIGRATION_FILE_PATH = join(
  process.cwd(),
  'supabase/migrations/20261019000000_briefs_by_language_and_interview_questions.sql',
)
const BRIEF_BACKFILL_STATEMENT_PATTERN = /insert into public\.end_client_briefs[\s\S]+?;/

const LEGACY_BRIEF = {
  brief_markdown: '## Gamma Banque\nBanque de détail.',
  brief_sources: [{ title: 'Rapport annuel', url: 'https://gamma.example/rapport' }],
  brief_generated_at: '2026-09-30T07:45:00.654321+00:00',
}

const createEndClientOrFail = async (
  client: SupabaseClient<Database>,
  userId: string,
  legacyBriefColumns: Partial<typeof LEGACY_BRIEF> = {},
): Promise<string> => {
  const endClientName = `Client ${randomUUID()}`
  const { data, error } = await client
    .from('end_clients')
    .insert({ user_id: userId, name: endClientName, normalized_name: endClientName.toLowerCase(), ...legacyBriefColumns })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const failOnError = ({ error }: { error: { message: string } | null }): void => {
  if (error) throw new Error(error.message)
}

const buildBriefRow = (userId: string, endClientId: string) => ({
  user_id: userId,
  end_client_id: endClientId,
  language: 'fr',
  markdown: '## Client\nDescription.',
  sources: [{ title: 'Site', url: 'https://client.example' }],
  generated_at: '2026-10-18T09:00:00+00:00',
})

const buildInterviewQuestionsRow = (userId: string, jobApplicationId: string) => ({
  user_id: userId,
  job_application_id: jobApplicationId,
  language: 'en',
  questions: ['What does the team ship first?', 'How is the code reviewed?'],
  generated_at: '2026-10-18T09:05:00+00:00',
})

const runSqlAsDatabaseOwner = async (sqlQuery: string): Promise<unknown> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const response = await fetch(`${process.env.SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sqlQuery }),
  })
  if (!response.ok) throw new Error(`Local SQL query failed with status ${response.status}: ${await response.text()}`)
  return response.json()
}

const readBriefBackfillStatement = (): string => {
  const backfillStatement = readFileSync(MIGRATION_FILE_PATH, 'utf8').match(BRIEF_BACKFILL_STATEMENT_PATTERN)?.[0]
  if (backfillStatement === undefined) throw new Error('The migration has no end_client_briefs backfill statement')
  return backfillStatement
}

describe('interview preparation isolation', () => {
  it('prevents user B from reading, modifying, deleting or forging user A briefs and interview questions', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const endClientIdOfA = await createEndClientOrFail(userA.client, userA.userId)
    const jobApplicationIdOfA = await createJobApplicationOrFail(userA.client, userA.userId)
    const { data: briefOfA } = await userA.client
      .from('end_client_briefs')
      .insert(buildBriefRow(userA.userId, endClientIdOfA))
      .select('id')
      .single()
    const { data: questionsOfA } = await userA.client
      .from('interview_questions')
      .insert(buildInterviewQuestionsRow(userA.userId, jobApplicationIdOfA))
      .select('id')
      .single()

    const { data: briefsReadByB } = await userB.client.from('end_client_briefs').select().eq('id', briefOfA!.id)
    const { data: briefsUpdatedByB } = await userB.client.from('end_client_briefs').update({ markdown: 'Piraté' }).eq('id', briefOfA!.id).select()
    const { data: briefsDeletedByB } = await userB.client.from('end_client_briefs').delete().eq('id', briefOfA!.id).select()
    expect(briefsReadByB).toEqual([])
    expect(briefsUpdatedByB).toEqual([])
    expect(briefsDeletedByB).toEqual([])

    const { data: questionsReadByB } = await userB.client.from('interview_questions').select().eq('id', questionsOfA!.id)
    const { data: questionsUpdatedByB } = await userB.client.from('interview_questions').update({ questions: ['Piraté'] }).eq('id', questionsOfA!.id).select()
    const { data: questionsDeletedByB } = await userB.client.from('interview_questions').delete().eq('id', questionsOfA!.id).select()
    expect(questionsReadByB).toEqual([])
    expect(questionsUpdatedByB).toEqual([])
    expect(questionsDeletedByB).toEqual([])

    const { error: briefForgedForA } = await userB.client
      .from('end_client_briefs')
      .insert({ ...buildBriefRow(userA.userId, endClientIdOfA), language: 'en' })
    const { error: questionsForgedForA } = await userB.client
      .from('interview_questions')
      .insert({ ...buildInterviewQuestionsRow(userA.userId, jobApplicationIdOfA), language: 'fr' })
    expect(briefForgedForA?.code).toBe('42501')
    expect(questionsForgedForA?.code).toBe('42501')

    const { error: ownBriefOnEndClientOfA } = await userB.client
      .from('end_client_briefs')
      .insert({ ...buildBriefRow(userB.userId, endClientIdOfA), language: 'en' })
    const { error: ownQuestionsOnJobApplicationOfA } = await userB.client
      .from('interview_questions')
      .insert({ ...buildInterviewQuestionsRow(userB.userId, jobApplicationIdOfA), language: 'fr' })
    expect(ownBriefOnEndClientOfA?.code).toBe('23503')
    expect(ownQuestionsOnJobApplicationOfA?.code).toBe('23503')

    const { data: briefsReadByA } = await userA.client.from('end_client_briefs').select('language, markdown').eq('end_client_id', endClientIdOfA)
    const { data: questionsReadByA } = await userA.client.from('interview_questions').select('language, questions').eq('job_application_id', jobApplicationIdOfA)
    expect(briefsReadByA).toEqual([{ language: 'fr', markdown: '## Client\nDescription.' }])
    expect(questionsReadByA).toEqual([{ language: 'en', questions: ['What does the team ship first?', 'How is the code reviewed?'] }])
  })

  it('keeps the briefs and interview questions away from anonymous visitors', async () => {
    const anonymousClient = createAnonymousTestClient()

    const { error: briefsReadError } = await anonymousClient.from('end_client_briefs').select('id')
    const { error: questionsReadError } = await anonymousClient.from('interview_questions').select('id')

    expect(briefsReadError?.code).toBe('42501')
    expect(questionsReadError?.code).toBe('42501')
  })

  it('stores at most one brief per end client and language', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const endClientId = await createEndClientOrFail(user.client, user.userId)
    await user.client.from('end_client_briefs').insert(buildBriefRow(user.userId, endClientId))

    const { error: secondFrenchBriefError } = await user.client.from('end_client_briefs').insert(buildBriefRow(user.userId, endClientId))
    const { error: englishBriefError } = await user.client
      .from('end_client_briefs')
      .insert({ ...buildBriefRow(user.userId, endClientId), language: 'en' })

    expect(secondFrenchBriefError?.code).toBe('23505')
    expect(englishBriefError).toBeNull()
  })

  it('stores at most one set of interview questions per job application and language', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await user.client.from('interview_questions').insert(buildInterviewQuestionsRow(user.userId, jobApplicationId))

    const { error: duplicateQuestionsError } = await user.client
      .from('interview_questions')
      .insert(buildInterviewQuestionsRow(user.userId, jobApplicationId))

    expect(duplicateQuestionsError?.code).toBe('23505')
  })

  it('rejects an unsupported language and questions or sources that are not arrays', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const endClientId = await createEndClientOrFail(user.client, user.userId)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    const { error: germanBriefError } = await user.client
      .from('end_client_briefs')
      .insert({ ...buildBriefRow(user.userId, endClientId), language: 'de' })
    const { error: objectSourcesError } = await user.client
      .from('end_client_briefs')
      .insert({ ...buildBriefRow(user.userId, endClientId), sources: { title: 'Site' } })
    const { error: textQuestionsError } = await user.client
      .from('interview_questions')
      .insert({ ...buildInterviewQuestionsRow(user.userId, jobApplicationId), questions: 'Une seule question' })

    expect(germanBriefError?.code).toBe('23514')
    expect(objectSourcesError?.code).toBe('23514')
    expect(textQuestionsError?.code).toBe('23514')
  })

  it('deletes the interview questions of a job application when the job application is deleted', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    failOnError(
      await user.client.from('interview_questions').insert(buildInterviewQuestionsRow(user.userId, jobApplicationId)),
    )

    const { error: deletionError } = await user.client.from('job_applications').delete().eq('id', jobApplicationId)
    expect(deletionError).toBeNull()

    const { data: remainingQuestions } = await createServiceRoleTestClient()
      .from('interview_questions')
      .select('id')
      .eq('job_application_id', jobApplicationId)
    expect(remainingQuestions).toEqual([])
  })

  it('deletes the briefs of an end client when the end client is deleted', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const endClientId = await createEndClientOrFail(user.client, user.userId)
    failOnError(await user.client.from('end_client_briefs').insert(buildBriefRow(user.userId, endClientId)))

    const { error: deletionError } = await user.client.from('end_clients').delete().eq('id', endClientId)
    expect(deletionError).toBeNull()

    const { data: remainingBriefs } = await createServiceRoleTestClient()
      .from('end_client_briefs')
      .select('id')
      .eq('end_client_id', endClientId)
    expect(remainingBriefs).toEqual([])
  })

  it('turns an existing end client brief into a french brief when the migration runs', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const endClientWithBriefId = await createEndClientOrFail(user.client, user.userId, LEGACY_BRIEF)
    const endClientWithoutBriefId = await createEndClientOrFail(user.client, user.userId)

    const backfilledBriefs = await runSqlAsDatabaseOwner(
      `begin;
      ${readBriefBackfillStatement()}
      select end_client_id, language, markdown, sources, generated_at = '${LEGACY_BRIEF.brief_generated_at}'::timestamptz as keeps_generated_at
      from public.end_client_briefs
      where end_client_id in ('${endClientWithBriefId}', '${endClientWithoutBriefId}');
      rollback;`,
    )

    expect(backfilledBriefs).toEqual([
      {
        end_client_id: endClientWithBriefId,
        language: 'fr',
        markdown: LEGACY_BRIEF.brief_markdown,
        sources: LEGACY_BRIEF.brief_sources,
        keeps_generated_at: true,
      },
    ])
    const { data: briefsAfterRollback } = await user.client.from('end_client_briefs').select('id')
    expect(briefsAfterRollback).toEqual([])
    const { data: legacyColumnsAfterBackfill } = await user.client
      .from('end_clients')
      .select('brief_markdown')
      .eq('id', endClientWithBriefId)
    expect(legacyColumnsAfterBackfill).toEqual([{ brief_markdown: LEGACY_BRIEF.brief_markdown }])
  })
})
