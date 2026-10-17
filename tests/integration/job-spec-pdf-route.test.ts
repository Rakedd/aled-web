import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/job-specs/[jobApplicationId]/pdf/route'
import { saveJobSpecContent, uploadJobSpecPdfFile } from '@/server/repositories/job-specs-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { createAnonymousTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const STORED_PDF_CONTENT = '%PDF-1.4 fiche métier stockée'

const createTestUser = () => createSignedInTestClient(`job-spec-pdf-route-${randomUUID()}@test.local`)

const requestJobSpecPdfAs = (client: SupabaseClient<Database>, jobApplicationId: string) => {
  jest.mocked(createServerSupabaseClient).mockResolvedValue(client)
  return GET(new NextRequest(`http://localhost:3000/api/job-specs/${jobApplicationId}/pdf`), {
    params: Promise.resolve({ jobApplicationId }),
  })
}

const createJobApplicationWithStoredPdf = async (user: TestUser): Promise<string> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
  const storagePath = await uploadJobSpecPdfFile(
    user.client,
    user.userId,
    jobApplicationId,
    new TextEncoder().encode(STORED_PDF_CONTENT),
  )
  await saveJobSpecContent(user.client, user.userId, jobApplicationId, { sourceKind: 'pdf', storagePath }, null)
  return jobApplicationId
}

describe('GET /api/job-specs/[jobApplicationId]/pdf', () => {
  it('answers 401 without redirecting when nobody is signed in', async () => {
    const owner = await createTestUser()
    const jobApplicationId = await createJobApplicationWithStoredPdf(owner)

    const pdfResponse = await requestJobSpecPdfAs(createAnonymousTestClient(), jobApplicationId)

    expect(pdfResponse.status).toBe(401)
    expect(pdfResponse.headers.get('location')).toBeNull()
  })

  it('redirects the owner to a signed url that serves the stored pdf, without caching it', async () => {
    const owner = await createTestUser()
    const jobApplicationId = await createJobApplicationWithStoredPdf(owner)

    const pdfResponse = await requestJobSpecPdfAs(owner.client, jobApplicationId)

    expect(pdfResponse.status).toBe(302)
    expect(pdfResponse.headers.get('cache-control')).toBe('private, no-store')
    const signedUrl = pdfResponse.headers.get('location')
    if (signedUrl === null) throw new Error('Missing redirect location')
    const signedUrlResponse = await fetch(signedUrl)
    expect(signedUrlResponse.status).toBe(200)
    expect(await signedUrlResponse.text()).toBe(STORED_PDF_CONTENT)
  })

  it("answers 404 for another user's job application", async () => {
    const owner = await createTestUser()
    const jobApplicationId = await createJobApplicationWithStoredPdf(owner)
    const intruder = await createTestUser()

    const pdfResponse = await requestJobSpecPdfAs(intruder.client, jobApplicationId)

    expect(pdfResponse.status).toBe(404)
    expect(pdfResponse.headers.get('location')).toBeNull()
  })

  it('answers 404 for a malformed id or a job spec without pdf', async () => {
    const owner = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId)
    await saveJobSpecContent(owner.client, owner.userId, jobApplicationId, { sourceKind: 'text', rawText: 'React' }, null)

    expect((await requestJobSpecPdfAs(owner.client, 'not-a-uuid')).status).toBe(404)
    expect((await requestJobSpecPdfAs(owner.client, jobApplicationId)).status).toBe(404)
  })
})
