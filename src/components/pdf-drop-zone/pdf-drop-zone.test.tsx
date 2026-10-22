import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfDropZone } from './pdf-drop-zone'

const createPdfFile = () => new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' })

const renderDropZone = (overrides: { selectedFileName?: string | null; isDisabled?: boolean } = {}) => {
  const onSelectFile = jest.fn()
  render(
    <PdfDropZone
      inputId="pdf-input"
      label="Fichier PDF"
      selectedFileName={overrides.selectedFileName ?? null}
      isDisabled={overrides.isDisabled ?? false}
      onSelectFile={onSelectFile}
    />,
  )
  return { onSelectFile }
}

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
    fireEvent.drop(screen.getByLabelText('Fichier PDF').parentElement as HTMLElement, {
      dataTransfer: { files: [pdfFile] },
    })
    expect(onSelectFile).toHaveBeenCalledWith(pdfFile)
  })

  it('shows the selected file name and disables the input when asked', () => {
    renderDropZone({ selectedFileName: 'mon-cv.pdf', isDisabled: true })
    expect(screen.getByText('Fichier choisi : mon-cv.pdf')).toBeInTheDocument()
    expect(screen.getByLabelText('Fichier PDF')).toBeDisabled()
  })
})
