import type { DragEvent } from 'react'
import { Label } from '@/components/ui/label'
import { CV_PDF_MIME_TYPE, MAX_CV_PDF_MEGABYTES } from '@/domain/cv-library'
import type { PdfDropZoneProps } from './interfaces'

export const PdfDropZone = ({ inputId, label, selectedFileName, isDisabled, onSelectFile }: PdfDropZoneProps) => {
  const handleDrop = (dragEvent: DragEvent<HTMLDivElement>) => {
    dragEvent.preventDefault()
    if (isDisabled) return
    onSelectFile(dragEvent.dataTransfer.files[0] ?? null)
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-dashed border-input p-3"
      onDragOver={(dragEvent) => dragEvent.preventDefault()}
      onDrop={handleDrop}
    >
      <Label htmlFor={inputId}>{label}</Label>
      <input
        id={inputId}
        type="file"
        accept={CV_PDF_MIME_TYPE}
        className="max-w-full text-sm"
        disabled={isDisabled}
        onChange={(changeEvent) => {
          onSelectFile(changeEvent.target.files?.[0] ?? null)
          changeEvent.target.value = ''
        }}
      />
      {selectedFileName && <p className="text-sm">Fichier choisi : {selectedFileName}</p>}
      <p className="text-xs text-muted-foreground">PDF uniquement, {MAX_CV_PDF_MEGABYTES} Mo maximum.</p>
    </div>
  )
}
