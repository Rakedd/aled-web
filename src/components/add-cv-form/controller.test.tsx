import { act, renderHook } from '@testing-library/react'
import { CV_FORM_FIELD_NAMES } from '@/domain/cv-library'
import { useController } from './controller'

const createPdfFile = (mimeType = 'application/pdf') => new File(['%PDF-1.7'], 'mon-cv.pdf', { type: mimeType })

const renderAddCvFormController = (createCv = jest.fn().mockResolvedValue({ ok: true, data: { id: 'cv-1' } })) => {
  const onCreated = jest.fn()
  const hook = renderHook(() => useController({ createCv, onCreated }))
  return { ...hook, createCv, onCreated }
}

describe('AddCvForm useController', () => {
  it('requires a label', async () => {
    const { result, createCv } = renderAddCvFormController()
    act(() => result.current.selectPdfFile(createPdfFile()))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Donne un nom à ce CV.')
    expect(createCv).not.toHaveBeenCalled()
  })

  it('refuses a non pdf file as soon as it is chosen', () => {
    const { result } = renderAddCvFormController()
    act(() => result.current.selectPdfFile(createPdfFile('image/png')))
    expect(result.current.errorMessage).toBe('Dépose un fichier PDF.')
    expect(result.current.pdfFile).toBeNull()
  })

  it('sends the label and the file in the form data', async () => {
    const pdfFile = createPdfFile()
    const { result, createCv, onCreated } = renderAddCvFormController()
    act(() => result.current.setLabel('  CV Front  '))
    act(() => result.current.selectPdfFile(pdfFile))
    await act(() => result.current.submit())
    const sentFormData = createCv.mock.calls[0][0] as FormData
    expect(sentFormData.get(CV_FORM_FIELD_NAMES.label)).toBe('CV Front')
    expect((sentFormData.get(CV_FORM_FIELD_NAMES.pdf) as File).name).toBe('mon-cv.pdf')
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('shows the server refusal', async () => {
    const libraryFullMessage = 'Tu as déjà 10 CV. Supprimes-en un pour en ajouter un nouveau.'
    const createCv = jest.fn().mockResolvedValue({ ok: false, errorMessage: libraryFullMessage })
    const { result, onCreated } = renderAddCvFormController(createCv)
    act(() => result.current.setLabel('CV Front'))
    act(() => result.current.selectPdfFile(createPdfFile()))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe(libraryFullMessage)
    expect(onCreated).not.toHaveBeenCalled()
  })
})
