import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cvs/versions/[versionId]/pdf/route'
import { createCvFromVersion, storeCvVersion } from '@/server/repositories/cvs-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { createAnonymousTestClient, createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const STORED_PDF_CONTENT = '%PDF-1.7 cv stocké'

const createTestUser = () => createSignedInTestClient(`cv-pdf-route-${randomUUID()}@test.local`)

const requestCvPdfAs = (client: SupabaseClient<Database>, versionId: string) => {
  jest.mocked(createServerSupabaseClient).mockResolvedValue(client)
  return GET(new NextRequest(`http://localhost:3000/api/cvs/versions/${versionId}/pdf`), {
    params: Promise.resolve({ versionId }),
  })
}

const storeCvWithPdfOrFail = async (user: TestUser): Promise<string> => {
  const versionId = await storeCvVersion(user.client, user.userId, {
    cvId: null,
    label: 'CV route',
    pdfBytes: new TextEncoder().encode(STORED_PDF_CONTENT),
    fileName: 'cv-route.pdf',
  })
  const creationResult = await createCvFromVersion(user.client, user.userId, 'CV route', versionId)
  if (!creationResult.ok) throw new Error(creationResult.errorMessage)
  return versionId
}

describe('GET /api/cvs/versions/[versionId]/pdf', () => {
  it('answers 401 without redirecting when nobody is signed in', async () => {
    const owner = await createTestUser()
    const versionId = await storeCvWithPdfOrFail(owner)

    const pdfResponse = await requestCvPdfAs(createAnonymousTestClient(), versionId)

    expect(pdfResponse.status).toBe(401)
    expect(pdfResponse.headers.get('location')).toBeNull()
  })

  it('redirects the owner to a signed url that serves the stored pdf, without caching it', async () => {
    const owner = await createTestUser()
    const versionId = await storeCvWithPdfOrFail(owner)

    const pdfResponse = await requestCvPdfAs(owner.client, versionId)

    expect(pdfResponse.status).toBe(302)
    expect(pdfResponse.headers.get('cache-control')).toBe('private, no-store')
    const signedUrl = pdfResponse.headers.get('location')
    if (signedUrl === null) throw new Error('Missing redirect location')
    const signedUrlResponse = await fetch(signedUrl)
    expect(signedUrlResponse.status).toBe(200)
    expect(await signedUrlResponse.text()).toBe(STORED_PDF_CONTENT)
  })

  it('answers 404 for a version of another user', async () => {
    const owner = await createTestUser()
    const versionId = await storeCvWithPdfOrFail(owner)
    const intruder = await createTestUser()

    const pdfResponse = await requestCvPdfAs(intruder.client, versionId)

    expect(pdfResponse.status).toBe(404)
    expect(pdfResponse.headers.get('location')).toBeNull()
  })

  it('answers 404 for a malformed version id', async () => {
    const owner = await createTestUser()

    expect((await requestCvPdfAs(owner.client, 'not-a-uuid')).status).toBe(404)
  })
})
