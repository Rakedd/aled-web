import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCvStoragePath, CV_MESSAGES, CVS_BUCKET, MAXIMUM_CV_COUNT } from '@/domain/cv-library'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import {
  countCvs,
  createCvFromVersion,
  createCvVersionDownloadUrl,
  deleteCvRow,
  findCvRow,
  findSentCvVersionId,
  listCvLibraryItems,
  markCvReviewed,
  releaseCvVersions,
  renameCvRow,
  replaceCvCurrentVersion,
  setSentCvVersion,
  storeCvVersion,
} from '@/server/repositories/cvs-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import type { Database } from '@/server/supabase/database-types'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`cv-library-${randomUUID()}@test.local`)

const buildPdfBytes = (content: string): Uint8Array => new TextEncoder().encode(`%PDF-1.7 ${content}`)

const storeVersionOrFail = (user: TestUser, label: string, content: string, cvId: string | null = null): Promise<string> =>
  storeCvVersion(user.client, user.userId, { cvId, label, pdfBytes: buildPdfBytes(content), fileName: `${label}.pdf` })

const unwrapOrFail = <Data>(result: { ok: true; data: Data } | { ok: false; errorMessage: string }): Data => {
  if (!result.ok) throw new Error(result.errorMessage)
  return result.data
}

const addCvOrFail = async (user: TestUser, label: string, content = label): Promise<{ cvId: string; versionId: string }> => {
  const versionId = await storeVersionOrFail(user, label, content)
  const { id: cvId } = unwrapOrFail(await createCvFromVersion(user.client, user.userId, label, versionId))
  return { cvId, versionId }
}

const replaceCurrentVersionOrFail = async (user: TestUser, cvId: string, label: string, content: string) => {
  const newVersionId = await storeVersionOrFail(user, label, content, cvId)
  const { previousVersionId } = unwrapOrFail(await replaceCvCurrentVersion(user.client, user.userId, cvId, newVersionId))
  return { newVersionId, previousVersionId }
}

const createSentJobApplication = async (user: TestUser, versionId: string | null): Promise<string> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
  if (versionId !== null) unwrapOrFail(await setSentCvVersion(user.client, user.userId, jobApplicationId, versionId))
  return jobApplicationId
}

const isFileStored = async (user: TestUser, versionId: string): Promise<boolean> => {
  const { error } = await createServiceRoleTestClient()
    .storage.from(CVS_BUCKET)
    .download(buildCvStoragePath(user.userId, versionId))
  return error === null
}

const isVersionStored = async (versionId: string): Promise<boolean> => {
  const { data, error } = await createServiceRoleTestClient().from('cv_versions').select('id').eq('id', versionId).maybeSingle()
  if (error) throw error
  return data !== null
}

const readVersionRowOrFail = async (versionId: string) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('cv_versions')
    .select('label, cv_id')
    .eq('id', versionId)
    .single()
  if (error) throw error
  return data
}

const fetchDownloadedText = async (user: TestUser, versionId: string): Promise<string> => {
  const signedUrl = unwrapOrFail(await createCvVersionDownloadUrl(user.client, user.userId, versionId))
  return (await fetch(signedUrl)).text()
}

describe('cvs repository', () => {
  it('lists cvs from the most recently updated with their sent count and previous sent versions', async () => {
    const user = await createTestUser()
    const first = await addCvOrFail(user, 'Premier')
    const second = await addCvOrFail(user, 'Second')
    await createSentJobApplication(user, first.versionId)
    const { newVersionId } = await replaceCurrentVersionOrFail(user, first.cvId, 'Premier', 'nouvelle version')
    await createSentJobApplication(user, newVersionId)

    const items = await listCvLibraryItems(user.client, user.userId)

    expect(items.map((item) => item.id)).toEqual([first.cvId, second.cvId])
    expect(items[0]).toMatchObject({ label: 'Premier', sentCount: 2, currentVersion: { id: newVersionId, fileName: 'Premier.pdf' } })
    expect(items[0]?.previousSentVersions).toEqual([{ id: first.versionId, uploadedAt: expect.any(Date), sentCount: 1 }])
    expect(items[1]).toMatchObject({ sentCount: 0, previousSentVersions: [] })
    expect(await countCvs(user.client, user.userId)).toBe(2)
  })

  it('deletes the previous current version and its file when replacing an unsent cv', async () => {
    const user = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(user, 'Principal')
    expect(await isFileStored(user, versionId)).toBe(true)

    const { newVersionId, previousVersionId } = await replaceCurrentVersionOrFail(user, cvId, 'Principal', 'v2')
    await releaseCvVersions(user.client, [previousVersionId])

    expect(previousVersionId).toBe(versionId)
    expect(await isVersionStored(versionId)).toBe(false)
    expect(await isFileStored(user, versionId)).toBe(false)
    expect(await isFileStored(user, newVersionId)).toBe(true)
  })

  it('keeps the previous version sent to a job application when replacing the cv', async () => {
    const user = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(user, 'Principal', 'ancien contenu')
    const jobApplicationId = await createSentJobApplication(user, versionId)
    const { data: oldReview } = await user.client.from('cvs').update({ reviewed_at: '2026-01-01T00:00:00Z' }).eq('id', cvId).select('reviewed_at').single()

    const { newVersionId, previousVersionId } = await replaceCurrentVersionOrFail(user, cvId, 'Principal', 'nouveau contenu')
    await releaseCvVersions(user.client, [previousVersionId])

    const [item] = await listCvLibraryItems(user.client, user.userId)
    expect(item?.currentVersion?.id).toBe(newVersionId)
    expect(item?.previousSentVersions.map((version) => version.id)).toEqual([versionId])
    expect(await findSentCvVersionId(user.client, user.userId, jobApplicationId)).toBe(versionId)
    expect(await fetchDownloadedText(user, versionId)).toBe('%PDF-1.7 ancien contenu')
    expect(await isFileStored(user, versionId)).toBe(true)
    expect(item?.reviewedAt.getTime()).toBeGreaterThan(new Date(oldReview?.reviewed_at as string).getTime())
  })

  it('deletes unsent versions and keeps sent ones without cv when deleting a cv', async () => {
    const user = await createTestUser()
    const { cvId, versionId: sentVersionId } = await addCvOrFail(user, 'Principal')
    await createSentJobApplication(user, sentVersionId)
    const { newVersionId: currentVersionId } = await replaceCurrentVersionOrFail(user, cvId, 'Principal', 'courante')
    const strayVersionId = await storeVersionOrFail(user, 'Principal', 'orpheline', cvId)

    const { versionIds } = unwrapOrFail(await deleteCvRow(user.client, user.userId, cvId))
    await releaseCvVersions(user.client, versionIds)

    expect([...versionIds].sort()).toEqual([sentVersionId, currentVersionId, strayVersionId].sort())
    expect(await isVersionStored(currentVersionId)).toBe(false)
    expect(await isFileStored(user, currentVersionId)).toBe(false)
    expect(await isVersionStored(strayVersionId)).toBe(false)
    expect(await isFileStored(user, strayVersionId)).toBe(false)
    expect(await isFileStored(user, sentVersionId)).toBe(true)
    expect((await readVersionRowOrFail(sentVersionId)).cv_id).toBeNull()
    expect(await listCvLibraryItems(user.client, user.userId)).toEqual([])
  })

  it('releases the current version of a cv even when that version lost its cv link', async () => {
    const user = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(user, 'Principal')
    const { error } = await createServiceRoleTestClient().from('cv_versions').update({ cv_id: null }).eq('id', versionId)
    if (error) throw error

    const { versionIds } = unwrapOrFail(await deleteCvRow(user.client, user.userId, cvId))
    await releaseCvVersions(user.client, versionIds)

    expect(versionIds).toEqual([versionId])
    expect(await isVersionStored(versionId)).toBe(false)
    expect(await isFileStored(user, versionId)).toBe(false)
  })

  it('deletes the previously sent tailored version when another cv is sent', async () => {
    const user = await createTestUser()
    const tailoredVersionId = await storeVersionOrFail(user, 'Sur mesure', 'tailored')
    const { versionId: libraryVersionId } = await addCvOrFail(user, 'Principal')
    const jobApplicationId = await createSentJobApplication(user, tailoredVersionId)

    const { previousVersionId } = unwrapOrFail(await setSentCvVersion(user.client, user.userId, jobApplicationId, libraryVersionId))
    await releaseCvVersions(user.client, [previousVersionId])

    expect(previousVersionId).toBe(tailoredVersionId)
    expect(await isVersionStored(tailoredVersionId)).toBe(false)
    expect(await isFileStored(user, tailoredVersionId)).toBe(false)
    expect(await isFileStored(user, libraryVersionId)).toBe(true)
  })

  it('keeps the previously sent version when it is still the current version of a cv', async () => {
    const user = await createTestUser()
    const { versionId } = await addCvOrFail(user, 'Principal')
    const otherVersionId = (await addCvOrFail(user, 'Autre')).versionId
    const jobApplicationId = await createSentJobApplication(user, versionId)

    const { previousVersionId } = unwrapOrFail(await setSentCvVersion(user.client, user.userId, jobApplicationId, otherVersionId))
    await releaseCvVersions(user.client, [previousVersionId])

    expect(previousVersionId).toBe(versionId)
    expect(await isVersionStored(versionId)).toBe(true)
    expect(await isFileStored(user, versionId)).toBe(true)
  })

  it('deletes the tailored version when the sent cv is removed', async () => {
    const user = await createTestUser()
    const tailoredVersionId = await storeVersionOrFail(user, 'Sur mesure', 'tailored')
    const jobApplicationId = await createSentJobApplication(user, tailoredVersionId)

    const { previousVersionId } = unwrapOrFail(await setSentCvVersion(user.client, user.userId, jobApplicationId, null))
    await releaseCvVersions(user.client, [previousVersionId, previousVersionId, null])

    expect(await findSentCvVersionId(user.client, user.userId, jobApplicationId)).toBeNull()
    expect(await isVersionStored(tailoredVersionId)).toBe(false)
    expect(await isFileStored(user, tailoredVersionId)).toBe(false)
  })

  it('keeps the label of the time on a job application after renaming or deleting the cv', async () => {
    const user = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(user, 'Principal')
    const jobApplicationId = await createSentJobApplication(user, versionId)
    const readSentCvLabel = async () => {
      const overview = unwrapOrFail(await findJobApplicationOverview(user.client, user.userId, jobApplicationId))
      return overview.sentCv?.label
    }

    unwrapOrFail(await renameCvRow(user.client, user.userId, cvId, 'Renommé'))
    expect(await readSentCvLabel()).toBe('Principal')

    const { versionIds } = unwrapOrFail(await deleteCvRow(user.client, user.userId, cvId))
    await releaseCvVersions(user.client, versionIds)
    expect(await readSentCvLabel()).toBe('Principal')
    expect(await isFileStored(user, versionId)).toBe(true)
  })

  it('renames the unsent current version but keeps the label of sent versions', async () => {
    const user = await createTestUser()
    const { cvId, versionId: sentVersionId } = await addCvOrFail(user, 'Principal')
    await createSentJobApplication(user, sentVersionId)
    const { newVersionId } = await replaceCurrentVersionOrFail(user, cvId, 'Principal', 'v2')

    unwrapOrFail(await renameCvRow(user.client, user.userId, cvId, 'Renommé'))

    const [item] = await listCvLibraryItems(user.client, user.userId)
    expect(item?.label).toBe('Renommé')
    expect((await readVersionRowOrFail(newVersionId)).label).toBe('Renommé')
    expect((await readVersionRowOrFail(sentVersionId)).label).toBe('Principal')
  })

  it('removes the uploaded file when the version row cannot be inserted', async () => {
    const user = await createTestUser()
    const listUserFolder = async () => {
      const { data, error } = await createServiceRoleTestClient().storage.from(CVS_BUCKET).list(user.userId)
      if (error) throw error
      return data.map((storedFile) => storedFile.name)
    }
    const fileNamesBefore = await listUserFolder()

    await expect(storeVersionOrFail(user, 'Orpheline', 'contenu', randomUUID())).rejects.toThrow()

    expect(await listUserFolder()).toEqual(fileNamesBefore)
    const { count, error } = await createServiceRoleTestClient()
      .from('cv_versions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.userId)
    if (error) throw error
    expect(count).toBe(0)
  })

  it('maps the database limit to the full library message', async () => {
    const user = await createTestUser()
    for (let index = 0; index < MAXIMUM_CV_COUNT; index += 1) await addCvOrFail(user, `CV ${index}`)
    const eleventhVersionId = await storeVersionOrFail(user, 'Onzième', 'onzieme')

    const result = await createCvFromVersion(user.client, user.userId, 'Onzième', eleventhVersionId)

    expect(result).toEqual({ ok: false, errorMessage: CV_MESSAGES.libraryFull })
    expect(await countCvs(user.client, user.userId)).toBe(MAXIMUM_CV_COUNT)
  })

  it('resets reviewed_at when the cv is marked as reviewed', async () => {
    const user = await createTestUser()
    const { cvId } = await addCvOrFail(user, 'Principal')
    await user.client.from('cvs').update({ reviewed_at: '2026-01-01T00:00:00Z' }).eq('id', cvId)

    unwrapOrFail(await markCvReviewed(user.client, user.userId, cvId))

    const [item] = await listCvLibraryItems(user.client, user.userId)
    expect(Date.now() - (item?.reviewedAt.getTime() ?? 0)).toBeLessThan(60_000)
  })

  it('returns not found for a cv, a version or a job application of another user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(owner, 'Principal')
    const ownerJobApplicationId = await createSentJobApplication(owner, versionId)
    const intruderJobApplicationId = await createSentJobApplication(intruder, null)
    const cvNotFound = { ok: false, errorMessage: CV_MESSAGES.cvNotFound }

    expect(await findCvRow(intruder.client, intruder.userId, cvId)).toEqual(cvNotFound)
    expect(await renameCvRow(intruder.client, intruder.userId, cvId, 'Piraté')).toEqual(cvNotFound)
    expect(await markCvReviewed(intruder.client, intruder.userId, cvId)).toEqual(cvNotFound)
    expect(await replaceCvCurrentVersion(intruder.client, intruder.userId, cvId, randomUUID())).toEqual(cvNotFound)
    expect(await deleteCvRow(intruder.client, intruder.userId, cvId)).toEqual(cvNotFound)
    expect(await createCvVersionDownloadUrl(intruder.client, intruder.userId, versionId)).toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvVersionNotFound,
    })
    expect(await setSentCvVersion(intruder.client, intruder.userId, intruderJobApplicationId, versionId)).toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvVersionNotFound,
    })
    expect(await setSentCvVersion(intruder.client, intruder.userId, ownerJobApplicationId, null)).toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })
    expect(await findSentCvVersionId(owner.client, owner.userId, ownerJobApplicationId)).toBe(versionId)
    expect(await listCvLibraryItems(owner.client, owner.userId)).toHaveLength(1)
  })
})
