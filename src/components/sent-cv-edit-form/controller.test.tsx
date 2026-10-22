import { act, renderHook } from '@testing-library/react'
import { CV_FORM_FIELD_NAMES, CV_MESSAGES, type CvOption } from '@/domain/cv-library'
import { useController } from './controller'

const CV_OPTIONS: CvOption[] = [
  { id: 'cv-1', label: 'CV DevOps' },
  { id: 'cv-2', label: 'CV Front' },
]

const createPdfFile = () => new File(['%PDF-1.7'], 'mon-cv.pdf', { type: 'application/pdf' })

const renderSentCvController = (cvOptions: CvOption[] = CV_OPTIONS) => {
  const attachLibraryCvToJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  const uploadTailoredCvForJobApplication = jest
    .fn()
    .mockResolvedValue({ ok: true, data: { libraryErrorMessage: null } })
  const detachSentCvFromJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(() =>
    useController({
      jobApplicationId: 'application-1',
      jobApplicationTitle: 'Développeur React',
      cvOptions,
      attachLibraryCvToJobApplication,
      uploadTailoredCvForJobApplication,
      detachSentCvFromJobApplication,
      onDataChanged,
      onClose,
    }),
  )
  return {
    ...renderedHook,
    attachLibraryCvToJobApplication,
    uploadTailoredCvForJobApplication,
    detachSentCvFromJobApplication,
    onDataChanged,
    onClose,
  }
}

describe('SentCvEditForm useController', () => {
  it('attaches the chosen library cv and closes after refresh', async () => {
    const { result, attachLibraryCvToJobApplication, onDataChanged, onClose } = renderSentCvController()
    act(() => result.current.setSelectedCvId('cv-2'))
    await act(() => result.current.save())
    expect(attachLibraryCvToJobApplication).toHaveBeenCalledWith('application-1', 'cv-2')
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks to choose a library cv before saving', async () => {
    const { result, attachLibraryCvToJobApplication } = renderSentCvController()
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe(CV_MESSAGES.missingLibraryChoice)
    expect(attachLibraryCvToJobApplication).not.toHaveBeenCalled()
  })

  it('starts on the tailored upload when the library is empty', () => {
    expect(renderSentCvController([]).result.current.source).toBe('tailored')
    expect(renderSentCvController().result.current.source).toBe('library')
  })

  it('prefills the tailored label with the job application title', () => {
    const { result } = renderSentCvController()
    expect(result.current.tailoredLabel).toBe('CV sur mesure · Développeur React')
  })

  it('sends the label, the file and the library checkbox', async () => {
    const { result, uploadTailoredCvForJobApplication, onClose } = renderSentCvController()
    act(() => result.current.setSource('tailored'))
    act(() => result.current.setTailoredLabel('  CV Mission  '))
    act(() => result.current.selectTailoredPdfFile(createPdfFile()))
    act(() => result.current.setIsAddedToLibrary(true))
    await act(() => result.current.save())
    const [jobApplicationId, sentFormData] = uploadTailoredCvForJobApplication.mock.calls[0] as [string, FormData]
    expect(jobApplicationId).toBe('application-1')
    expect(sentFormData.get(CV_FORM_FIELD_NAMES.label)).toBe('CV Mission')
    expect((sentFormData.get(CV_FORM_FIELD_NAMES.pdf) as File).name).toBe('mon-cv.pdf')
    expect(sentFormData.get(CV_FORM_FIELD_NAMES.addToLibrary)).toBe('true')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not add a tailored cv to the library unless asked', async () => {
    const { result, uploadTailoredCvForJobApplication } = renderSentCvController()
    expect(result.current.isAddedToLibrary).toBe(false)
    act(() => result.current.setSource('tailored'))
    act(() => result.current.selectTailoredPdfFile(createPdfFile()))
    await act(() => result.current.save())
    const sentFormData = uploadTailoredCvForJobApplication.mock.calls[0][1] as FormData
    expect(sentFormData.get(CV_FORM_FIELD_NAMES.addToLibrary)).toBe('false')
  })

  it('refuses a tailored upload without file', async () => {
    const { result, uploadTailoredCvForJobApplication } = renderSentCvController()
    act(() => result.current.setSource('tailored'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe(CV_MESSAGES.missingPdf)
    expect(uploadTailoredCvForJobApplication).not.toHaveBeenCalled()
  })

  it('stays open with the full library notice after a tailored upload', async () => {
    const { result, uploadTailoredCvForJobApplication, onDataChanged, onClose } = renderSentCvController()
    uploadTailoredCvForJobApplication.mockResolvedValue({
      ok: true,
      data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload },
    })
    act(() => result.current.setSource('tailored'))
    act(() => result.current.selectTailoredPdfFile(createPdfFile()))
    await act(() => result.current.save())
    expect(result.current.libraryNoticeMessage).toBe(CV_MESSAGES.libraryFullAfterTailoredUpload)
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes the sent cv', async () => {
    const { result, detachSentCvFromJobApplication, onDataChanged, onClose } = renderSentCvController()
    await act(() => result.current.detach())
    expect(detachSentCvFromJobApplication).toHaveBeenCalledWith('application-1')
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the confirmation dialog when removing the sent cv', async () => {
    const { result } = renderSentCvController()
    act(() => result.current.setIsDetachDialogOpen(true))
    expect(result.current.isDetachDialogOpen).toBe(true)
    await act(() => result.current.detach())
    expect(result.current.isDetachDialogOpen).toBe(false)
  })

  it('shows the server error and keeps the form open', async () => {
    const { result, attachLibraryCvToJobApplication, onDataChanged, onClose } = renderSentCvController()
    attachLibraryCvToJobApplication.mockResolvedValue({ ok: false, errorMessage: CV_MESSAGES.cvNotFound })
    act(() => result.current.setSelectedCvId('cv-1'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe(CV_MESSAGES.cvNotFound)
    expect(onDataChanged).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
