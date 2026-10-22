import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/server/supabase/database-types'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

type TestUser = { client: SupabaseClient<Database>; userId: string }

const CHECK_VIOLATION_CODE = '23514'
const MAXIMUM_CV_COUNT = 10

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`cv-library-schema-${randomUUID()}@test.local`)

const buildVersionInsert = (user: TestUser, label: string, cvId: string | null = null) => {
  const versionId = randomUUID()
  return {
    id: versionId,
    user_id: user.userId,
    cv_id: cvId,
    label,
    storage_path: `${user.userId}/${versionId}.pdf`,
    file_name: `${label}.pdf`,
    byte_size: 1024,
  }
}

const insertVersionOrFail = async (user: TestUser, label: string, cvId: string | null = null) => {
  const { data, error } = await user.client.from('cv_versions').insert(buildVersionInsert(user, label, cvId)).select().single()
  if (error) throw error
  return data
}

const insertCvWithVersion = async (user: TestUser, label: string) => {
  const version = await insertVersionOrFail(user, label)
  const cvId = randomUUID()
  const { error: cvError } = await user.client
    .from('cvs')
    .insert({ id: cvId, user_id: user.userId, label, current_version_id: version.id })
  if (cvError) throw cvError
  const { error: versionError } = await user.client.from('cv_versions').update({ cv_id: cvId }).eq('id', version.id)
  if (versionError) throw versionError
  return { cvId, version }
}

const insertBareCv = (user: TestUser, label: string) =>
  user.client.from('cvs').insert({ id: randomUUID(), user_id: user.userId, label })

const fillLibrary = async (user: TestUser, cvCount: number) => {
  for (let index = 0; index < cvCount; index += 1) {
    const { error } = await insertBareCv(user, `CV ${index}`)
    if (error) throw error
  }
}

const sendVersion = async (user: TestUser, versionId: string): Promise<string> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
  const { error } = await user.client.from('job_applications').update({ sent_cv_version_id: versionId }).eq('id', jobApplicationId)
  if (error) throw error
  return jobApplicationId
}

const buildPdfBytes = (byteSize: number): Uint8Array => {
  const pdfBytes = new Uint8Array(byteSize)
  pdfBytes.set(new TextEncoder().encode('%PDF-'))
  return pdfBytes
}

describe('cv library schema', () => {
  it('refuses an eleventh cv with a check violation', async () => {
    const user = await createTestUser()
    await fillLibrary(user, MAXIMUM_CV_COUNT)

    const { error } = await insertBareCv(user, 'Onzième')

    expect(error?.code).toBe(CHECK_VIOLATION_CODE)
  })

  it('lets an upsert of an existing cv through when the library already has 10 cvs', async () => {
    const user = await createTestUser()
    await fillLibrary(user, MAXIMUM_CV_COUNT)
    const { data: existingCvs } = await user.client.from('cvs').select('id').limit(1)
    const existingCvId = existingCvs?.[0]?.id as string

    const { error } = await user.client
      .from('cvs')
      .upsert({ id: existingCvId, user_id: user.userId, label: 'Nouveau libellé' })

    expect(error).toBeNull()
    const { data: renamedCv } = await user.client.from('cvs').select('label').eq('id', existingCvId).single()
    expect(renamedCv?.label).toBe('Nouveau libellé')
  })

  it('accepts exactly one of two simultaneous inserts at nine cvs', async () => {
    const user = await createTestUser()
    await fillLibrary(user, MAXIMUM_CV_COUNT - 1)

    const results = await Promise.all([insertBareCv(user, 'Concurrent A'), insertBareCv(user, 'Concurrent B')])

    const errorCodes = results.map((result) => result.error?.code ?? null)
    expect(errorCodes.filter((errorCode) => errorCode === null)).toHaveLength(1)
    expect(errorCodes.filter((errorCode) => errorCode === CHECK_VIOLATION_CODE)).toHaveLength(1)
    const { count } = await user.client.from('cvs').select('*', { count: 'exact', head: true })
    expect(count).toBe(MAXIMUM_CV_COUNT)
  })

  it('does not count tailored versions in the limit', async () => {
    const user = await createTestUser()
    await fillLibrary(user, MAXIMUM_CV_COUNT)

    const { error } = await user.client.from('cv_versions').insert(buildVersionInsert(user, 'Sur mesure'))

    expect(error).toBeNull()
  })

  it('detaches versions and keeps them when their cv is deleted', async () => {
    const user = await createTestUser()
    const { cvId, version } = await insertCvWithVersion(user, 'Principal')

    const { error } = await user.client.from('cvs').delete().eq('id', cvId)

    expect(error).toBeNull()
    const { data: keptVersion } = await user.client.from('cv_versions').select('cv_id, user_id').eq('id', version.id).single()
    expect(keptVersion).toEqual({ cv_id: null, user_id: user.userId })
  })

  it('clears the sent cv of a job application when its version is deleted', async () => {
    const user = await createTestUser()
    const version = await insertVersionOrFail(user, 'Envoyé')
    const jobApplicationId = await sendVersion(user, version.id)

    const { error } = await user.client.from('cv_versions').delete().eq('id', version.id)

    expect(error).toBeNull()
    const { data: jobApplication } = await user.client
      .from('job_applications')
      .select('sent_cv_version_id, user_id')
      .eq('id', jobApplicationId)
      .single()
    expect(jobApplication).toEqual({ sent_cv_version_id: null, user_id: user.userId })
  })

  it('refuses a version pointing at another user cv', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const { cvId } = await insertCvWithVersion(owner, 'Privé')

    const { error } = await intruder.client.from('cv_versions').insert(buildVersionInsert(intruder, 'Intrus', cvId))

    expect(error).not.toBeNull()
  })

  it('deletes only unreferenced versions and returns their storage paths', async () => {
    const user = await createTestUser()
    const { version: currentVersion } = await insertCvWithVersion(user, 'Courante')
    const sentVersion = await insertVersionOrFail(user, 'Envoyée')
    await sendVersion(user, sentVersion.id)
    const orphanVersion = await insertVersionOrFail(user, 'Orpheline')

    const { data, error } = await user.client.rpc('delete_unreferenced_cv_versions', {
      candidate_version_ids: [currentVersion.id, sentVersion.id, orphanVersion.id],
    })

    expect(error).toBeNull()
    expect(data).toEqual([orphanVersion.storage_path])
    const { data: remainingVersions } = await user.client.from('cv_versions').select('id')
    expect(remainingVersions?.map((remainingVersion) => remainingVersion.id).sort()).toEqual(
      [currentVersion.id, sentVersion.id].sort(),
    )
  })

  it('does not delete another user version through the cleanup function', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const ownerVersion = await insertVersionOrFail(owner, 'Orpheline')

    const { data, error } = await intruder.client.rpc('delete_unreferenced_cv_versions', {
      candidate_version_ids: [ownerVersion.id],
    })

    expect(error).toBeNull()
    expect(data).toEqual([])
    const { data: keptVersion } = await owner.client.from('cv_versions').select('id').eq('id', ownerVersion.id)
    expect(keptVersion).toHaveLength(1)
  })

  it('exposes the current version and the sent count in cvs_overview', async () => {
    const user = await createTestUser()
    const { cvId, version: oldVersion } = await insertCvWithVersion(user, 'Principal')
    await sendVersion(user, oldVersion.id)
    await sendVersion(user, oldVersion.id)
    const newVersion = await insertVersionOrFail(user, 'Principal v2', cvId)
    await user.client.from('cvs').update({ current_version_id: newVersion.id }).eq('id', cvId)

    const { data, error } = await user.client.from('cvs_overview').select('*').eq('id', cvId).single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      current_version_id: newVersion.id,
      current_version_file_name: newVersion.file_name,
      current_version_storage_path: newVersion.storage_path,
      current_version_uploaded_at: newVersion.uploaded_at,
      sent_count: 2,
    })
  })

  it('counts the job applications of each version in cv_versions_overview', async () => {
    const user = await createTestUser()
    const sentVersion = await insertVersionOrFail(user, 'Envoyée')
    const unsentVersion = await insertVersionOrFail(user, 'Jamais envoyée')
    await sendVersion(user, sentVersion.id)
    await sendVersion(user, sentVersion.id)
    await sendVersion(user, sentVersion.id)

    const { data, error } = await user.client.from('cv_versions_overview').select('id, sent_count')

    expect(error).toBeNull()
    expect(data?.find((row) => row.id === sentVersion.id)?.sent_count).toBe(3)
    expect(data?.find((row) => row.id === unsentVersion.id)?.sent_count).toBe(0)
  })

  it('adds the sent cv label and upload date to job_applications_overview and keeps its columns', async () => {
    const user = await createTestUser()
    const version = await insertVersionOrFail(user, 'Envoyé en octobre')
    const jobApplicationId = await sendVersion(user, version.id)

    const { data, error } = await user.client
      .from('job_applications_overview')
      .select('sent_cv_label, sent_cv_uploaded_at, has_job_spec, intermediary_kind, last_activity_at')
      .eq('id', jobApplicationId)
      .single()

    expect(error).toBeNull()
    expect(data?.sent_cv_label).toBe('Envoyé en octobre')
    expect(data?.sent_cv_uploaded_at).toBe(version.uploaded_at)
    expect(data?.has_job_spec).toBe(false)
  })

  it('hides cvs, versions and the cv overviews of another user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    await insertCvWithVersion(owner, 'Privé')

    const [cvs, versions, cvsOverview, versionsOverview] = await Promise.all([
      intruder.client.from('cvs').select('id'),
      intruder.client.from('cv_versions').select('id'),
      intruder.client.from('cvs_overview').select('id'),
      intruder.client.from('cv_versions_overview').select('id'),
    ])

    expect(cvs.data).toEqual([])
    expect(versions.data).toEqual([])
    expect(cvsOverview.data).toEqual([])
    expect(versionsOverview.data).toEqual([])
  })

  it('refuses to read, overwrite or delete a file in another user cv folder', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const storagePath = `${owner.userId}/${randomUUID()}.pdf`
    const { error: uploadError } = await owner.client.storage
      .from('cvs')
      .upload(storagePath, buildPdfBytes(64), { contentType: 'application/pdf' })
    expect(uploadError).toBeNull()

    const download = await intruder.client.storage.from('cvs').download(storagePath)
    const overwrite = await intruder.client.storage
      .from('cvs')
      .upload(storagePath, buildPdfBytes(128), { contentType: 'application/pdf', upsert: true })
    await intruder.client.storage.from('cvs').remove([storagePath])

    expect(download.error).not.toBeNull()
    expect(overwrite.error).not.toBeNull()
    const { data: storedFiles } = await createServiceRoleTestClient().storage.from('cvs').list(owner.userId)
    expect(storedFiles?.map((storedFile) => storedFile.name)).toHaveLength(1)
    const { data: ownerDownload } = await owner.client.storage.from('cvs').download(storagePath)
    expect(ownerDownload?.size).toBe(64)
  })

  it('refuses a non pdf file and a pdf over 4 MB in the cvs bucket', async () => {
    const user = await createTestUser()

    const textUpload = await user.client.storage
      .from('cvs')
      .upload(`${user.userId}/${randomUUID()}.txt`, new TextEncoder().encode('pas un pdf'), { contentType: 'text/plain' })
    const oversizedUpload = await user.client.storage
      .from('cvs')
      .upload(`${user.userId}/${randomUUID()}.pdf`, buildPdfBytes(4 * 1024 * 1024 + 1), { contentType: 'application/pdf' })

    expect(textUpload.error).not.toBeNull()
    expect(oversizedUpload.error).not.toBeNull()
  })
})
