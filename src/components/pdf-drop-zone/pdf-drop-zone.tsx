'use client'

import { Upload } from 'lucide-react'
import { type ChangeEvent, type DragEvent, useId, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CV_PDF_MIME_TYPE, MAX_CV_PDF_MEGABYTES } from '@/domain/cv-library'
import { cn } from '@/lib/utils'
import type { PdfDropZoneProps } from './interfaces'

const PDF_DROP_ZONE_MESSAGES = {
  chooseFile: 'Choisir un PDF',
  dropHint: 'ou glisse-le ici',
  selectedFile: (fileName: string) => `Fichier choisi : ${fileName}`,
  limits: (maximumMegabytes: number) => `PDF uniquement, ${maximumMegabytes} Mo maximum.`,
}

export const PdfDropZone = ({
  inputId,
  label,
  selectedFileName,
  isDisabled,
  onSelectFile,
  maximumMegabytes = MAX_CV_PDF_MEGABYTES,
}: PdfDropZoneProps) => {
  const limitsId = useId()
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleDragOver = (dragEvent: DragEvent<HTMLDivElement>) => {
    dragEvent.preventDefault()
    if (!isDisabled) setIsDraggingOver(true)
  }

  const handleDragLeave = (dragEvent: DragEvent<HTMLDivElement>) => {
    const isStillInsideZone =
      dragEvent.relatedTarget instanceof Node && dragEvent.currentTarget.contains(dragEvent.relatedTarget)
    if (!isStillInsideZone) setIsDraggingOver(false)
  }

  const handleDrop = (dragEvent: DragEvent<HTMLDivElement>) => {
    dragEvent.preventDefault()
    setIsDraggingOver(false)
    if (isDisabled) return
    onSelectFile(dragEvent.dataTransfer.files[0] ?? null)
  }

  const handleInputChange = (changeEvent: ChangeEvent<HTMLInputElement>) => {
    onSelectFile(changeEvent.target.files?.[0] ?? null)
    changeEvent.target.value = ''
  }

  return (
    <div
      data-dragging-over={isDraggingOver}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-dashed border-control-border bg-surface-soft p-4 transition-colors motion-reduce:transition-none',
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50',
        isDraggingOver && 'border-primary bg-forest-soft',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Label htmlFor={inputId}>{label}</Label>
      <input
        id={inputId}
        type="file"
        accept={CV_PDF_MIME_TYPE}
        className="sr-only"
        disabled={isDisabled}
        aria-describedby={limitsId}
        onChange={handleInputChange}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label
          htmlFor={inputId}
          aria-hidden="true"
          className={buttonVariants({
            variant: 'outline',
            className: cn('h-11 cursor-pointer sm:h-10', isDisabled && 'pointer-events-none opacity-50'),
          })}
        >
          <Upload strokeWidth={1.75} />
          {PDF_DROP_ZONE_MESSAGES.chooseFile}
        </label>
        <span className="text-sm text-ink-muted">{PDF_DROP_ZONE_MESSAGES.dropHint}</span>
      </div>
      <p role="status" className="text-sm font-medium break-words text-ink empty:hidden">
        {selectedFileName === null ? null : PDF_DROP_ZONE_MESSAGES.selectedFile(selectedFileName)}
      </p>
      <p id={limitsId} className="text-xs text-muted-foreground">
        {PDF_DROP_ZONE_MESSAGES.limits(maximumMegabytes)}
      </p>
    </div>
  )
}
