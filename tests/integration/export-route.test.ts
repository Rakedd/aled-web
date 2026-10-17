import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GET } from '@/app/api/export/route'
import type { UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { createAnonymousTestClient, createSignedInTestClient } from './create-test-user'
import { seedEveryUserTable, STORED_ENCRYPTED_API_KEY } from './user-data-snapshot-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const requestExportAs = (client: SupabaseClient<Database>) => {
  jest.mocked(createServerSupabaseClient).mockResolvedValue(client)
  return GET()
}

describe('GET /api/export', () => {
  it('answers 401 when nobody is signed in', async () => {
    const exportResponse = await requestExportAs(createAnonymousTestClient())

    expect(exportResponse.status).toBe(401)
  })

  it('downloads the signed-in user data as a dated json attachment without the api key', async () => {
    const owner = await createSignedInTestClient(`export-route-${randomUUID()}@test.local`)
    const { jobApplicationId } = await seedEveryUserTable(owner)

    const exportResponse = await requestExportAs(owner.client)

    expect(exportResponse.status).toBe(200)
    expect(exportResponse.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(exportResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(exportResponse.headers.get('content-disposition')).toMatch(
      /^attachment; filename="freeclutch-export-\d{4}-\d{2}-\d{2}\.json"$/,
    )
    const exportedText = await exportResponse.text()
    expect(exportedText).not.toContain(STORED_ENCRYPTED_API_KEY)
    const exportedSnapshot: UserDataSnapshot = JSON.parse(exportedText)
    expect(exportedSnapshot.userId).toBe(owner.userId)
    expect(exportedSnapshot.jobApplications.map((jobApplication) => jobApplication.id)).toEqual([jobApplicationId])
    expect(exportedSnapshot.jobSpecs[0].pdfBase64).not.toBeNull()
  })
})
