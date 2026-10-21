import { randomUUID } from 'node:crypto'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { JOB_SPECS_BUCKET } from '@/domain/job-spec'
import type { Database } from '@/server/supabase/database-types'

export type TestUser = { client: SupabaseClient<Database>; userId: string }

export type SeededUserData = { jobApplicationId: string; pdfStoragePath: string }

export const STORED_ENCRYPTED_API_KEY = 'chiffre-ne-doit-jamais-sortir'

export const STORED_API_KEY_LAST_FOUR = 'w9x2'

export const STORED_PDF_BYTES = Uint8Array.from([
  ...new TextEncoder().encode('%PDF-1.4\n'),
  ...Array.from({ length: 256 }, (_unused, byteValue) => byteValue),
])

const SUBSIDIARY_BRIEF = {
  markdown: '## Bêta Digital\nÉditeur de logiciels.',
  sources: [{ title: 'Site officiel', url: 'https://beta.example' }],
  generatedAt: '2026-10-10T08:30:00.123456+00:00',
}

const readInsertedIdOrFail = ({ data, error }: { data: { id: string } | null; error: PostgrestError | null }): string => {
  if (error !== null || data === null) throw new Error(`Fixture insertion failed: ${error?.message ?? 'no row'}`)
  return data.id
}

const failOnError = ({ error }: { error: PostgrestError | null }): void => {
  if (error !== null) throw new Error(`Fixture write failed: ${error.message}`)
}

const insertEndClientChain = async ({ client, userId }: TestUser): Promise<string> => {
  const groupEndClientId = readInsertedIdOrFail(
    await client
      .from('end_clients')
      .insert({ user_id: userId, name: 'Groupe Bêta', normalized_name: 'groupe beta' })
      .select('id')
      .single(),
  )
  const subsidiaryEndClientId = readInsertedIdOrFail(
    await client
      .from('end_clients')
      .insert({
        user_id: userId,
        name: 'Bêta Digital',
        normalized_name: 'beta digital',
        parent_end_client_id: groupEndClientId,
        notes: 'Filiale numérique',
        brief_markdown: SUBSIDIARY_BRIEF.markdown,
        brief_sources: SUBSIDIARY_BRIEF.sources,
        brief_generated_at: SUBSIDIARY_BRIEF.generatedAt,
      })
      .select('id')
      .single(),
  )
  failOnError(
    await client.from('end_client_briefs').insert({
      user_id: userId,
      end_client_id: subsidiaryEndClientId,
      language: 'fr',
      markdown: SUBSIDIARY_BRIEF.markdown,
      sources: SUBSIDIARY_BRIEF.sources,
      generated_at: SUBSIDIARY_BRIEF.generatedAt,
    }),
  )
  const teamEndClientId = readInsertedIdOrFail(
    await client
      .from('end_clients')
      .insert({
        user_id: userId,
        name: 'Bêta Labs',
        normalized_name: 'beta labs',
        parent_end_client_id: subsidiaryEndClientId,
      })
      .select('id')
      .single(),
  )
  return teamEndClientId
}

const uploadJobSpecPdf = async ({ client, userId }: TestUser, jobApplicationId: string): Promise<string> => {
  const pdfStoragePath = `${userId}/${jobApplicationId}/${randomUUID()}.pdf`
  const { error } = await client.storage
    .from(JOB_SPECS_BUCKET)
    .upload(pdfStoragePath, STORED_PDF_BYTES, { contentType: 'application/pdf' })
  if (error) throw new Error(`Fixture pdf upload failed: ${error.message}`)
  return pdfStoragePath
}

export const seedEveryUserTable = async (testUser: TestUser): Promise<SeededUserData> => {
  const { client, userId } = testUser
  failOnError(
    await client
      .from('profiles')
      .update({
        first_name: 'Camille',
        last_name: 'Durand',
        links: [{ label: 'Malt', url: 'https://www.malt.fr/profile/camille' }],
        follow_up_delay_days: 10,
        encrypted_anthropic_api_key: STORED_ENCRYPTED_API_KEY,
        anthropic_api_key_last_four: STORED_API_KEY_LAST_FOUR,
      })
      .eq('id', userId),
  )
  const intermediaryId = readInsertedIdOrFail(
    await client
      .from('intermediaries')
      .insert({ user_id: userId, name: 'Agence Alpha', normalized_name: 'agence alpha', kind: 'agency' })
      .select('id')
      .single(),
  )
  const contactId = readInsertedIdOrFail(
    await client
      .from('contacts')
      .insert({
        user_id: userId,
        full_name: 'Jeanne Martin',
        normalized_name: 'jeanne martin',
        email: 'jeanne.martin@alpha.example',
        phone: '+33 6 12 34 56 78',
        intermediary_id: intermediaryId,
        notes: 'Rencontrée au meetup React',
        referred_by: 'Paul Leroy',
      })
      .select('id')
      .single(),
  )
  const endClientId = await insertEndClientChain(testUser)
  const jobApplicationId = readInsertedIdOrFail(
    await client
      .from('job_applications')
      .insert({
        user_id: userId,
        title: 'Lead développeur React',
        status: 'cv_submitted',
        intermediary_id: intermediaryId,
        contact_id: contactId,
        end_client_id: endClientId,
        requested_daily_rate: 650,
        applied_on: '2026-10-02',
        stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
      })
      .select('id')
      .single(),
  )
  failOnError(
    await client.from('activity_log_entries').insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      kind: 'call',
      summary: 'Appel de qualification',
      occurred_at: '2026-10-03T09:15:00+00:00',
    }),
  )
  failOnError(
    await client.from('activity_log_entries').insert({
      user_id: userId,
      job_application_id: null,
      contact_id: contactId,
      kind: 'call',
      summary: 'Appel sans candidature',
      occurred_at: '2026-10-04T10:00:00+00:00',
    }),
  )
  failOnError(
    await client.from('interviews').insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      starts_at: '2026-10-20T13:00:00+00:00',
      kind: 'client',
      format: 'video',
      participants: 'CTO',
    }),
  )
  const pdfStoragePath = await uploadJobSpecPdf(testUser, jobApplicationId)
  failOnError(
    await client.from('job_specs').insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      source_kind: 'pdf',
      storage_path: pdfStoragePath,
      pending_stack: [{ name: 'TypeScript', category: 'language', origin: 'job_spec' }],
    }),
  )
  failOnError(
    await client.from('alert_snoozes').insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      alert_kind: 'follow_up_due',
      snoozed_until: '2026-10-25T08:00:00+00:00',
    }),
  )
  failOnError(
    await client.from('interview_questions').insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      language: 'en',
      questions: ['Which product ships next?', 'How large is the frontend team?'],
      generated_at: '2026-10-11T14:00:00.654321+00:00',
    }),
  )
  return { jobApplicationId, pdfStoragePath }
}
