import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfDropZone } from './pdf-drop-zone'

const createPdfFile = () => new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' })

const renderDropZone = (
  overrides: { selectedFileName?: string | null; isDisabled?: boolean; maximumMegabytes?: number } = {},
) => {
  const onSelectFile = jest.fn()
  render(
    <PdfDropZone
      inputId="pdf-input"
      label="Fichier PDF"
      selectedFileName={overrides.selectedFileName ?? null}
      isDisabled={overrides.isDisabled ?? false}
      onSelectFile={onSelectFile}
      maximumMegabytes={overrides.maximumMegabytes}
    />,
  )
  return { onSelectFile }
}

const getDropZone = () => screen.getByLabelText('Fichier PDF').parentElement as HTMLElement

describe('PdfDropZone', () => {
  it('accepts only pdf files and shows the limit', () => {
    renderDropZone()
    expect(screen.getByLabelText('Fichier PDF')).toHaveAttribute('accept', 'application/pdf')
    expect(screen.getByText('PDF uniquement, 4 Mo maximum.')).toBeInTheDocument()
  })

  it('reports the file picked with the input', async () => {
    const { onSelectFile } = renderDropZone()
    const pdfFile = createPdfFile()
    await userEvent.upload(screen.getByLabelText('Fichier PDF'), pdfFile)
    expect(onSelectFile).toHaveBeenCalledWith(pdfFile)
  })

  it('reports the file dropped on the zone', () => {
    const { onSelectFile } = renderDropZone()
    const pdfFile = createPdfFile()
    fireEvent.drop(getDropZone(), {
      dataTransfer: { files: [pdfFile] },
    })
    expect(onSelectFile).toHaveBeenCalledWith(pdfFile)
  })

  it('announces the selected file name in French and disables the input when asked', () => {
    renderDropZone({ selectedFileName: 'mon-cv.pdf', isDisabled: true })
    expect(screen.getByRole('status')).toHaveTextContent('Fichier choisi : mon-cv.pdf')
    expect(screen.getByLabelText('Fichier PDF')).toBeDisabled()
  })

  it('hides the native input visually and offers a French picker button instead', () => {
    renderDropZone()
    const fileInput = screen.getByLabelText('Fichier PDF')
    expect(fileInput).toHaveClass('sr-only')
    expect(fileInput).toHaveAccessibleDescription('PDF uniquement, 4 Mo maximum.')
    expect(screen.getByText('Choisir un PDF').closest('label')).toHaveAttribute('for', 'pdf-input')
    expect(screen.getByText('ou glisse-le ici')).toBeInTheDocument()
  })

  it('keeps the file name area empty until a file is chosen', () => {
    renderDropZone()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('highlights the zone while a file is dragged over it', () => {
    renderDropZone()
    fireEvent.dragOver(getDropZone())
    expect(getDropZone()).toHaveAttribute('data-dragging-over', 'true')
    fireEvent.dragLeave(getDropZone(), { relatedTarget: document.body })
    expect(getDropZone()).toHaveAttribute('data-dragging-over', 'false')
  })

  it('ignores a file dropped while disabled', () => {
    const { onSelectFile } = renderDropZone({ isDisabled: true })
    fireEvent.drop(getDropZone(), { dataTransfer: { files: [createPdfFile()] } })
    expect(onSelectFile).not.toHaveBeenCalled()
  })

  it('shows a custom size limit', () => {
    renderDropZone({ maximumMegabytes: 8 })
    expect(screen.getByText('PDF uniquement, 8 Mo maximum.')).toBeInTheDocument()
  })
})
