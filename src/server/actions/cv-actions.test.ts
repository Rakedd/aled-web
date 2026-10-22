/**
 * @jest-environment node
 */
import { CV_MESSAGES, MAXIMUM_CV_COUNT } from '@/domain/cv-library'
import {
  countCvs,
  createCvFromVersion,
  deleteCvRow,
  findCvRow,
  listCvLibraryItems,
  markCvReviewed,
  releaseCvVersions,
  renameCvRow,
  replaceCvCurrentVersion,
  setSentCvVersion,
  storeCvVersion,
} from '@/server/repositories/cvs-repository'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import {
  attachLibraryCvToJobApplication,
  confirmCvStillGood,
  createCv,
  deleteCv,
  detachSentCvFromJobApplication,
  listCvs,
  renameCv,
  replaceCvFile,
  uploadTailoredCvForJobApplication,
} from './cv-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/job-application-ownership', () => ({ isJobApplicationOwnedByUser: jest.fn() }))
jest.mock('@/server/repositories/cvs-repository', () => ({
  listCvLibraryItems: jest.fn(),
  countCvs: jest.fn(),
  findCvRow: jest.fn(),
  storeCvVersion: jest.fn(),
  createCvFromVersion: jest.fn(),
  replaceCvCurrentVersion: jest.fn(),
  renameCvRow: jest.fn(),
  deleteCvRow: jest.fn(),
  markCvReviewed: jest.fn(),
  setSentCvVersion: jest.fn(),
  releaseCvVersions: jest.fn(),
}))

const CV_ID = '0b6f2c1e-3a4d-4e5f-8a9b-1c2d3e4f5a6b'
const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'
const fakeSupabaseClient = {} as FreeclutchSupabaseClient

const createCvFormData = ({ withSignature = true, addToLibrary }: { withSignature?: boolean; addToLibrary?: boolean } = {}) => {
  const formData = new FormData()
  formData.append('cvLabel', 'CV React')
  formData.append('cvPdf', new File([withSignature ? '%PDF-1.7' : 'not a pdf'], 'cv.pdf', { type: 'application/pdf' }))
  if (addToLibrary !== undefined) formData.append('addToLibrary', String(addToLibrary))
  return formData
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(isJobApplicationOwnedByUser).mockResolvedValue(true)
  jest.mocked(countCvs).mockResolvedValue(2)
  jest.mocked(storeCvVersion).mockResolvedValue('new-version')
  jest.mocked(createCvFromVersion).mockResolvedValue({ ok: true, data: { id: CV_ID } })
  jest.mocked(findCvRow).mockResolvedValue({ ok: true, data: { label: 'CV React', currentVersionId: 'current-version' } })
  jest.mocked(replaceCvCurrentVersion).mockResolvedValue({ ok: true, data: { previousVersionId: 'previous-version' } })
  jest.mocked(setSentCvVersion).mockResolvedValue({ ok: true, data: { previousVersionId: 'previous-version' } })
  jest.mocked(releaseCvVersions).mockResolvedValue(undefined)
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('listCvs', () => {
  it('lists the cvs of the user', async () => {
    jest.mocked(listCvLibraryItems).mockResolvedValue([])
    await expect(listCvs()).resolves.toEqual({ ok: true, data: [] })
    expect(listCvLibraryItems).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('returns the load failure message when the repository throws', async () => {
    jest.mocked(listCvLibraryItems).mockRejectedValue(new Error('down'))
    await expect(listCvs()).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de charger tes CV pour le moment. Réessaie dans quelques minutes.',
    })
  })
})

describe('createCv', () => {
  it('creates the cv from a stored version', async () => {
    await expect(createCv(createCvFormData())).resolves.toEqual({ ok: true, data: { id: CV_ID } })
    expect(storeCvVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', {
      cvId: null,
      label: 'CV React',
      pdfBytes: expect.any(Uint8Array),
      fileName: 'cv.pdf',
    })
    expect(createCvFromVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', 'CV React', 'new-version')
    expect(releaseCvVersions).not.toHaveBeenCalled()
  })

  it('refuses a file without the pdf signature and stores nothing', async () => {
    await expect(createCv(createCvFormData({ withSignature: false }))).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.invalidPdf,
    })
    expect(storeCvVersion).not.toHaveBeenCalled()
    expect(countCvs).not.toHaveBeenCalled()
  })

  it('refuses a missing label without storing anything', async () => {
    const formData = createCvFormData()
    formData.set('cvLabel', ' ')
    await expect(createCv(formData)).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.missingLabel })
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('refuses a new cv when the library already has 10 cvs without uploading', async () => {
    jest.mocked(countCvs).mockResolvedValue(MAXIMUM_CV_COUNT)
    await expect(createCv(createCvFormData())).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.libraryFull })
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('releases the stored version when the database refuses the cv', async () => {
    jest.mocked(createCvFromVersion).mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.libraryFull })
    await expect(createCv(createCvFormData())).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.libraryFull })
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['new-version'])
  })

  it('releases the stored version and fails when creating the cv throws', async () => {
    jest.mocked(createCvFromVersion).mockRejectedValue(new Error('down'))
    await expect(createCv(createCvFormData())).resolves.toEqual({
      ok: false,
      errorMessage: "Impossible d'enregistrer le CV pour le moment. Réessaie dans quelques minutes.",
    })
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['new-version'])
  })
})

describe('replaceCvFile', () => {
  it('releases the previous version after a replacement', async () => {
    await expect(replaceCvFile(CV_ID, createCvFormData())).resolves.toEqual({ ok: true, data: null })
    expect(storeCvVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', {
      cvId: CV_ID,
      label: 'CV React',
      pdfBytes: expect.any(Uint8Array),
      fileName: 'cv.pdf',
    })
    expect(replaceCvCurrentVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', CV_ID, 'new-version')
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['previous-version'])
  })

  it('releases the new version when the replaced cv vanished', async () => {
    jest.mocked(replaceCvCurrentVersion).mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    await expect(replaceCvFile(CV_ID, createCvFormData())).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvNotFound,
    })
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['new-version'])
  })

  it('stores nothing when the cv does not exist', async () => {
    jest.mocked(findCvRow).mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    await expect(replaceCvFile(CV_ID, createCvFormData())).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvNotFound,
    })
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('stays successful and logs when releasing the previous version fails', async () => {
    jest.mocked(releaseCvVersions).mockRejectedValue(new Error('rpc down'))
    await expect(replaceCvFile(CV_ID, createCvFormData())).resolves.toEqual({ ok: true, data: null })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Cv version release failed after cv replacement', expect.anything())
  })

  it('refuses a file without the pdf signature and stores nothing', async () => {
    await expect(replaceCvFile(CV_ID, createCvFormData({ withSignature: false }))).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.invalidPdf,
    })
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('rejects a malformed cv id without touching the database', async () => {
    await expect(replaceCvFile('not-a-uuid', createCvFormData())).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvNotFound,
    })
    expect(findCvRow).not.toHaveBeenCalled()
    expect(storeCvVersion).not.toHaveBeenCalled()
  })
})

describe('renameCv', () => {
  it('renames the cv with the trimmed label', async () => {
    jest.mocked(renameCvRow).mockResolvedValue({ ok: true, data: null })
    await expect(renameCv(CV_ID, ' CV Node ')).resolves.toEqual({ ok: true, data: null })
    expect(renameCvRow).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', CV_ID, 'CV Node')
  })

  it('rejects a malformed cv id without touching the database', async () => {
    await expect(renameCv('not-a-uuid', 'CV Node')).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    expect(renameCvRow).not.toHaveBeenCalled()
  })

  it('rejects an empty label', async () => {
    await expect(renameCv(CV_ID, ' ')).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.missingLabel })
    expect(renameCvRow).not.toHaveBeenCalled()
  })
})

describe('deleteCv', () => {
  it('releases the versions of the deleted cv', async () => {
    jest.mocked(deleteCvRow).mockResolvedValue({ ok: true, data: { versionIds: ['version-a', 'version-b'] } })
    await expect(deleteCv(CV_ID)).resolves.toEqual({ ok: true, data: null })
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['version-a', 'version-b'])
  })

  it('stays successful and logs when releasing the versions fails', async () => {
    jest.mocked(deleteCvRow).mockResolvedValue({ ok: true, data: { versionIds: ['version-a'] } })
    jest.mocked(releaseCvVersions).mockRejectedValue(new Error('rpc down'))
    await expect(deleteCv(CV_ID)).resolves.toEqual({ ok: true, data: null })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Cv version release failed after cv deletion', expect.anything())
  })

  it('releases nothing when the cv does not exist', async () => {
    jest.mocked(deleteCvRow).mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    await expect(deleteCv(CV_ID)).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    expect(releaseCvVersions).not.toHaveBeenCalled()
  })

  it('rejects a malformed cv id without touching the database', async () => {
    await expect(deleteCv('not-a-uuid')).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    expect(deleteCvRow).not.toHaveBeenCalled()
  })
})

describe('confirmCvStillGood', () => {
  it('marks the cv as reviewed', async () => {
    jest.mocked(markCvReviewed).mockResolvedValue({ ok: true, data: null })
    await expect(confirmCvStillGood(CV_ID)).resolves.toEqual({ ok: true, data: null })
    expect(markCvReviewed).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', CV_ID)
  })

  it('rejects a malformed cv id without touching the database', async () => {
    await expect(confirmCvStillGood('not-a-uuid')).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    expect(markCvReviewed).not.toHaveBeenCalled()
  })
})

describe('attachLibraryCvToJobApplication', () => {
  it('attaches the current version and releases the previous one', async () => {
    await expect(attachLibraryCvToJobApplication(JOB_APPLICATION_ID, CV_ID)).resolves.toEqual({ ok: true, data: null })
    expect(setSentCvVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', JOB_APPLICATION_ID, 'current-version')
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['previous-version'])
  })

  it('refuses a cv without current version', async () => {
    jest.mocked(findCvRow).mockResolvedValue({ ok: true, data: { label: 'CV React', currentVersionId: null } })
    await expect(attachLibraryCvToJobApplication(JOB_APPLICATION_ID, CV_ID)).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvNotFound,
    })
    expect(setSentCvVersion).not.toHaveBeenCalled()
  })

  it('stays successful and logs when releasing the previous version fails', async () => {
    jest.mocked(releaseCvVersions).mockRejectedValue(new Error('rpc down'))
    await expect(attachLibraryCvToJobApplication(JOB_APPLICATION_ID, CV_ID)).resolves.toEqual({ ok: true, data: null })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Cv version release failed after sent cv change', expect.anything())
  })

  it('rejects a malformed cv id without touching the database', async () => {
    await expect(attachLibraryCvToJobApplication(JOB_APPLICATION_ID, 'not-a-uuid')).resolves.toEqual({
      ok: false,
      errorMessage: CV_MESSAGES.cvNotFound,
    })
    expect(findCvRow).not.toHaveBeenCalled()
  })
})

describe('detachSentCvFromJobApplication', () => {
  it('clears the sent version and releases the previous one', async () => {
    await expect(detachSentCvFromJobApplication(JOB_APPLICATION_ID)).resolves.toEqual({ ok: true, data: null })
    expect(setSentCvVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', JOB_APPLICATION_ID, null)
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['previous-version'])
  })
})

describe('uploadTailoredCvForJobApplication', () => {
  it('refuses a file without the pdf signature and stores nothing', async () => {
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ withSignature: false })),
    ).resolves.toEqual({ ok: false, errorMessage: CV_MESSAGES.invalidPdf })
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('stores nothing when the job application is not owned by the user', async () => {
    jest.mocked(isJobApplicationOwnedByUser).mockResolvedValue(false)
    const uploadResult = await uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData())
    expect(uploadResult.ok).toBe(false)
    expect(storeCvVersion).not.toHaveBeenCalled()
  })

  it('attaches the tailored cv before creating the library cv', async () => {
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ addToLibrary: true })),
    ).resolves.toEqual({ ok: true, data: { libraryErrorMessage: null } })
    const attachOrder = jest.mocked(setSentCvVersion).mock.invocationCallOrder[0]
    const createOrder = jest.mocked(createCvFromVersion).mock.invocationCallOrder[0]
    expect(attachOrder).toBeLessThan(createOrder)
    expect(storeCvVersion).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', expect.objectContaining({ cvId: null }))
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['previous-version'])
  })

  it('does not create a library cv unless asked', async () => {
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ addToLibrary: false })),
    ).resolves.toEqual({ ok: true, data: { libraryErrorMessage: null } })
    expect(createCvFromVersion).not.toHaveBeenCalled()
  })

  it('keeps the tailored cv attached and reports the full library', async () => {
    jest.mocked(countCvs).mockResolvedValue(MAXIMUM_CV_COUNT)
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ addToLibrary: true })),
    ).resolves.toEqual({ ok: true, data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload } })
    expect(setSentCvVersion).toHaveBeenCalled()
    expect(createCvFromVersion).not.toHaveBeenCalled()
  })

  it('reports the full library when the database refuses the library cv', async () => {
    jest.mocked(createCvFromVersion).mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.libraryFull })
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ addToLibrary: true })),
    ).resolves.toEqual({ ok: true, data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload } })
  })

  it('keeps the attachment and logs when creating the library cv throws', async () => {
    jest.mocked(createCvFromVersion).mockRejectedValue(new Error('down'))
    await expect(
      uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData({ addToLibrary: true })),
    ).resolves.toEqual({
      ok: true,
      data: { libraryErrorMessage: "Impossible d'enregistrer le CV pour le moment. Réessaie dans quelques minutes." },
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Library cv creation failed after tailored cv upload', expect.anything())
  })

  it('releases the new version when the job application vanished', async () => {
    jest.mocked(setSentCvVersion).mockResolvedValue({ ok: false, errorMessage: 'Candidature introuvable' })
    await expect(uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData())).resolves.toEqual({
      ok: false,
      errorMessage: 'Candidature introuvable',
    })
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['new-version'])
  })

  it('releases the new version and fails when attaching throws', async () => {
    jest.mocked(setSentCvVersion).mockRejectedValue(new Error('down'))
    const uploadResult = await uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData())
    expect(uploadResult.ok).toBe(false)
    expect(releaseCvVersions).toHaveBeenCalledWith(fakeSupabaseClient, ['new-version'])
  })

  it('stays successful and logs when releasing the previous version fails', async () => {
    jest.mocked(releaseCvVersions).mockRejectedValue(new Error('rpc down'))
    await expect(uploadTailoredCvForJobApplication(JOB_APPLICATION_ID, createCvFormData())).resolves.toEqual({
      ok: true,
      data: { libraryErrorMessage: null },
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Cv version release failed after sent cv change', expect.anything())
  })
})
