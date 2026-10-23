/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import type { Database, Tables } from '@/server/supabase/database-types'
import { parseUserDataSnapshot, restoreUserDataSnapshot } from './restore-user-data-snapshot'

const SNAPSHOT_USER_ID = '44444444-4444-4444-8444-444444444444'

const EMPTY_SNAPSHOT: UserDataSnapshot = {
  formatVersion: 1,
  exportedAt: '2026-10-19T03:00:00.000Z',
  userId: SNAPSHOT_USER_ID,
  profile: {
    id: SNAPSHOT_USER_ID,
    first_name: null,
    last_name: null,
    email: 'restauration@test.local',
    links: [],
    follow_up_delay_days: 7,
    created_at: '2026-10-01T00:00:00+00:00',
    updated_at: '2026-10-01T00:00:00+00:00',
  },
  intermediaries: [],
  contacts: [],
  endClients: [],
  jobApplications: [],
  activityLogEntries: [],
  interviews: [],
  jobSpecs: [],
  alertSnoozes: [],
  opportunityFilters: [],
  opportunityDecisions: [],
  endClientBriefs: [],
  interviewQuestions: [],
  technicalBriefs: [],
  cvs: [],
  cvVersions: [],
}

const buildEndClientRow = (overrides: Partial<Tables<'end_clients'>>): Tables<'end_clients'> => ({
  id: '55555555-5555-4555-8555-555555555555',
  user_id: SNAPSHOT_USER_ID,
  name: 'Delta Énergie',
  normalized_name: 'delta energie',
  parent_end_client_id: null,
  notes: null,
  brief_markdown: null,
  brief_sources: null,
  brief_generated_at: null,
  created_at: '2026-10-02T00:00:00+00:00',
  updated_at: '2026-10-03T00:00:00+00:00',
  ...overrides,
})

const buildSnapshotJsonWithoutBriefsByLanguage = (endClients: Tables<'end_clients'>[]): Record<string, unknown> => {
  const snapshotJson: Record<string, unknown> = { ...EMPTY_SNAPSHOT, endClients }
  delete snapshotJson.endClientBriefs
  delete snapshotJson.interviewQuestions
  delete snapshotJson.technicalBriefs
  return snapshotJson
}

const buildFakeClient = (getUserByIdResult: { data: { user: null }; error: { status: number; code: string; message: string } }) => {
  const createUser = jest.fn()
  const from = jest.fn()
  const fakeClient = { auth: { admin: { getUserById: async () => getUserByIdResult, createUser } }, from }
  return { fakeClient: fakeClient as unknown as SupabaseClient<Database>, createUser, from }
}

describe('restoreUserDataSnapshot', () => {
  it('stops before any write when the user lookup fails for a reason other than a missing user', async () => {
    const { fakeClient, createUser, from } = buildFakeClient({
      data: { user: null },
      error: { status: 403, code: 'bad_jwt', message: 'invalid JWT' },
    })

    await expect(restoreUserDataSnapshot(fakeClient, EMPTY_SNAPSHOT)).rejects.toThrow(
      'Restore operation findUser failed: invalid JWT',
    )

    expect(createUser).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

describe('parseUserDataSnapshot', () => {
  it('turns each end client brief of a snapshot written before briefs by language into a french brief', () => {
    const endClientWithBrief = buildEndClientRow({
      brief_markdown: '## Delta Énergie',
      brief_sources: [{ title: 'Site', url: 'https://delta.example' }],
      brief_generated_at: '2026-10-04T10:00:00+00:00',
    })
    const endClientWithoutBrief = buildEndClientRow({ id: '66666666-6666-4666-8666-666666666666', name: 'Epsilon' })

    const parsedSnapshot = parseUserDataSnapshot(
      buildSnapshotJsonWithoutBriefsByLanguage([endClientWithBrief, endClientWithoutBrief]),
    )

    expect(parsedSnapshot.endClientBriefs).toEqual([
      {
        id: expect.any(String),
        user_id: SNAPSHOT_USER_ID,
        end_client_id: endClientWithBrief.id,
        language: 'fr',
        markdown: '## Delta Énergie',
        sources: [{ title: 'Site', url: 'https://delta.example' }],
        generated_at: '2026-10-04T10:00:00+00:00',
      },
    ])
    expect(parsedSnapshot.interviewQuestions).toEqual([])
  })

  it('falls back to no sources and to the end client update date when the old brief lacks them', () => {
    const endClientWithPartialBrief = buildEndClientRow({ brief_markdown: '## Delta Énergie', brief_sources: { title: 'Site' } })

    const parsedSnapshot = parseUserDataSnapshot(buildSnapshotJsonWithoutBriefsByLanguage([endClientWithPartialBrief]))

    expect(parsedSnapshot.endClientBriefs).toEqual([
      expect.objectContaining({ sources: [], generated_at: endClientWithPartialBrief.updated_at }),
    ])
  })

  it('still parses a snapshot written before the cv library', () => {
    const snapshotJson: Record<string, unknown> = { ...EMPTY_SNAPSHOT }
    delete snapshotJson.cvs
    delete snapshotJson.cvVersions

    const parsedSnapshot = parseUserDataSnapshot(snapshotJson)

    expect(parsedSnapshot.cvs).toEqual([])
    expect(parsedSnapshot.cvVersions).toEqual([])
  })

  it('keeps the briefs by language and the interview questions of a current snapshot', () => {
    const endClientBrief: Tables<'end_client_briefs'> = {
      id: '77777777-7777-4777-8777-777777777777',
      user_id: SNAPSHOT_USER_ID,
      end_client_id: '55555555-5555-4555-8555-555555555555',
      language: 'en',
      markdown: '## Delta Energy',
      sources: [],
      generated_at: '2026-10-05T10:00:00+00:00',
    }
    const interviewQuestions: Tables<'interview_questions'> = {
      id: '88888888-8888-4888-8888-888888888888',
      user_id: SNAPSHOT_USER_ID,
      job_application_id: '99999999-9999-4999-8999-999999999999',
      language: 'fr',
      questions: ['Quelle équipe ?'],
      generated_at: '2026-10-05T11:00:00+00:00',
    }

    const parsedSnapshot = parseUserDataSnapshot({
      ...EMPTY_SNAPSHOT,
      endClients: [buildEndClientRow({ brief_markdown: '## Delta Énergie' })],
      endClientBriefs: [endClientBrief],
      interviewQuestions: [interviewQuestions],
    })

    expect(parsedSnapshot.endClientBriefs).toEqual([endClientBrief])
    expect(parsedSnapshot.interviewQuestions).toEqual([interviewQuestions])
  })

  it('parses the technical briefs and defaults them to an empty list', () => {
    const technicalBrief: Tables<'technical_briefs'> = {
      id: '12121212-1212-4212-8212-121212121212',
      user_id: SNAPSHOT_USER_ID,
      job_application_id: '99999999-9999-4999-8999-999999999999',
      language: 'fr',
      cv_version_id: null,
      cv_label: 'CV React',
      cv_uploaded_at: '2026-09-20T10:00:00+00:00',
      content: { storyline: [], missions: [], gaps: [] },
      generated_at: '2026-10-05T12:00:00+00:00',
    }
    const snapshotWithoutTechnicalBriefs: Record<string, unknown> = { ...EMPTY_SNAPSHOT }
    delete snapshotWithoutTechnicalBriefs.technicalBriefs

    expect(parseUserDataSnapshot(snapshotWithoutTechnicalBriefs).technicalBriefs).toEqual([])
    expect(parseUserDataSnapshot({ ...EMPTY_SNAPSHOT, technicalBriefs: [technicalBrief] }).technicalBriefs).toEqual([
      technicalBrief,
    ])
  })

  it('keeps only the Free-Work filters of a snapshot written before shared filters, without their source', () => {
    const sharedFilters: Tables<'opportunity_filters'> = {
      id: '66666666-6666-4666-8666-666666666666',
      user_id: SNAPSHOT_USER_ID,
      include_keywords: ['react'],
      always_exclude_keywords: [],
      rescuable_exclude_keywords: [],
      rescue_keywords: [],
      rate_floor_full_remote: null,
      rate_floor_hybrid: 450,
      rate_floor_onsite: null,
      regions: ['Île-de-France'],
      disabled_sources: [],
      created_at: '2026-10-05T10:00:00+00:00',
      updated_at: '2026-10-05T10:00:00+00:00',
    }
    const { disabled_sources: absentFromEarlierSnapshots, ...earlierFreeWorkFilters } = sharedFilters
    const earlierCollectiveFilters = {
      ...earlierFreeWorkFilters,
      id: '77777777-7777-4777-8777-777777777776',
      source: 'collective',
    }

    const parsedSnapshot = parseUserDataSnapshot({
      ...EMPTY_SNAPSHOT,
      opportunityFilters: [{ ...earlierFreeWorkFilters, source: 'free-work' }, earlierCollectiveFilters],
    })

    expect(absentFromEarlierSnapshots).toEqual([])
    expect(parsedSnapshot.opportunityFilters).toEqual([sharedFilters])
  })

  it('keeps the disabled sources of a current snapshot', () => {
    const currentFilters: Tables<'opportunity_filters'> = {
      id: '66666666-6666-4666-8666-666666666667',
      user_id: SNAPSHOT_USER_ID,
      include_keywords: [],
      always_exclude_keywords: [],
      rescuable_exclude_keywords: [],
      rescue_keywords: [],
      rate_floor_full_remote: null,
      rate_floor_hybrid: null,
      rate_floor_onsite: null,
      regions: [],
      disabled_sources: ['collective'],
      created_at: '2026-10-21T10:00:00+00:00',
      updated_at: '2026-10-21T10:00:00+00:00',
    }

    expect(parseUserDataSnapshot({ ...EMPTY_SNAPSHOT, opportunityFilters: [currentFilters] }).opportunityFilters).toEqual([
      currentFilters,
    ])
  })

  it.each(['endClientBriefs', 'interviewQuestions', 'technicalBriefs'])('refuses a snapshot whose %s is not a list', (snapshotArrayKey) => {
    expect(() => parseUserDataSnapshot({ ...EMPTY_SNAPSHOT, [snapshotArrayKey]: {} })).toThrow(
      'The file is not a Freeclutch snapshot with formatVersion 1',
    )
  })
})
