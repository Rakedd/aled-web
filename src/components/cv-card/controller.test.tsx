import { act, renderHook } from '@testing-library/react'
import type { CvLibraryItem } from '@/domain/cv-library'
import { useController } from './controller'

const cv: CvLibraryItem = {
  id: 'cv-1',
  label: 'CV Front',
  reviewedAt: new Date('2026-03-12T10:00:00Z'),
  currentVersion: { id: 'version-1', uploadedAt: new Date('2026-03-12T10:00:00Z'), fileName: 'cv.pdf' },
  sentCount: 0,
  previousSentVersions: [],
}

const createPdfFile = (mimeType = 'application/pdf') => new File(['%PDF-1.7'], 'nouveau.pdf', { type: mimeType })

const renderCardController = (failureMessage: string | null = null) => {
  const actionResult = failureMessage === null ? { ok: true, data: null } : { ok: false, errorMessage: failureMessage }
  const replaceCvFile = jest.fn().mockResolvedValue(actionResult)
  const renameCv = jest.fn().mockResolvedValue(actionResult)
  const deleteCv = jest.fn().mockResolvedValue(actionResult)
  const onDataChanged = jest.fn()
  const hook = renderHook(() => useController({ cv, replaceCvFile, renameCv, deleteCv, onDataChanged }))
  return { ...hook, replaceCvFile, renameCv, deleteCv, onDataChanged }
}

describe('CvCard useController', () => {
  it('replaces the file and refreshes the data', async () => {
    const { result, replaceCvFile, onDataChanged } = renderCardController()
    await act(() => result.current.replaceWithFile(createPdfFile()))
    expect(replaceCvFile).toHaveBeenCalledWith('cv-1', expect.any(FormData))
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses a non pdf replacement without calling the server', async () => {
    const { result, replaceCvFile } = renderCardController()
    await act(() => result.current.replaceWithFile(createPdfFile('image/png')))
    expect(result.current.errorMessage).toBe('Dépose un fichier PDF.')
    expect(replaceCvFile).not.toHaveBeenCalled()
  })

  it('saves a trimmed label and refuses an empty one', async () => {
    const { result, renameCv, onDataChanged } = renderCardController()
    act(() => result.current.startRenaming())
    act(() => result.current.setDraftLabel('   '))
    await act(() => result.current.saveLabel())
    expect(result.current.errorMessage).toBe('Donne un nom à ce CV.')
    expect(renameCv).not.toHaveBeenCalled()
    act(() => result.current.setDraftLabel('  CV Back  '))
    await act(() => result.current.saveLabel())
    expect(renameCv).toHaveBeenCalledWith('cv-1', 'CV Back')
    expect(result.current.isRenaming).toBe(false)
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('deletes the cv after confirmation and refreshes the data', async () => {
    const { result, deleteCv, onDataChanged } = renderCardController()
    act(() => result.current.setIsDeleteDialogOpen(true))
    await act(() => result.current.confirmDeletion())
    expect(deleteCv).toHaveBeenCalledWith('cv-1')
    expect(result.current.isDeleteDialogOpen).toBe(false)
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('shows the error and keeps the card when an action fails', async () => {
    const { result, onDataChanged } = renderCardController('CV introuvable')
    await act(() => result.current.replaceWithFile(createPdfFile()))
    expect(result.current.errorMessage).toBe('CV introuvable')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('keeps the rename field open when the rename fails', async () => {
    const { result } = renderCardController('CV introuvable')
    act(() => result.current.startRenaming())
    await act(() => result.current.saveLabel())
    expect(result.current.isRenaming).toBe(true)
    expect(result.current.errorMessage).toBe('CV introuvable')
  })
})
