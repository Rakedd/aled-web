export type PdfDropZoneProps = {
  inputId: string
  label: string
  selectedFileName: string | null
  isDisabled: boolean
  onSelectFile: (pdfFile: File | null) => void
}
