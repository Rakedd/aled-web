import type { ActionResult } from './action-result'
import { AI_ERROR_MESSAGES } from './ai-errors'
import { rejectWith } from './input-validation'
import { MAX_PASTED_TEXT_LENGTH } from './job-posting-extraction'
import type { StackItem } from './types'

export const MAX_JOB_SPEC_PDF_MEGABYTES = 4

export const MAX_JOB_SPEC_PDF_BYTES = MAX_JOB_SPEC_PDF_MEGABYTES * 1024 * 1024

export const JOB_SPEC_PDF_MIME_TYPE = 'application/pdf'

export const JOB_SPEC_PDF_FORM_FIELD_NAME = 'jobSpecPdf'

const PDF_SIGNATURE_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]

export type JobSpecSourceKind = 'pdf' | 'text'

export type JobSpec = {
  sourceKind: JobSpecSourceKind
  rawText: string | null
  pendingStack: StackItem[] | null
  updatedAt: Date
}

export type JobSpecSaveOutcome = {
  pendingStack: StackItem[] | null
  aiErrorMessage: string | null
}

export const JOB_SPEC_MESSAGES = {
  pdfTooLarge: `PDF trop lourd (${MAX_JOB_SPEC_PDF_MEGABYTES} Mo maximum)`,
  pdfOnly: 'Seuls les PDF sont acceptés',
  missingPdf: 'Choisis un fichier PDF',
  emptyText: 'Colle le texte de la fiche métier',
  notFound: 'Fiche métier introuvable',
  noPdfToShow: "Cette fiche métier n'a pas de PDF",
} as const

export const NO_TECHNOLOGY_FOUND_MESSAGES: Record<JobSpecSourceKind, string> = {
  pdf: 'Aucune technologie trouvée dans ce document (PDF scanné ?). Ajoute la stack à la main.',
  text: 'Aucune technologie trouvée dans ce texte. Ajoute la stack à la main.',
}

export const buildJobSpecPdfPath = (jobApplicationId: string): string => `/api/job-specs/${jobApplicationId}/pdf`

export const validateJobSpecPdfFile = (candidate: unknown): ActionResult<Blob> => {
  if (!(candidate instanceof Blob) || candidate.size === 0) return rejectWith(JOB_SPEC_MESSAGES.missingPdf)
  if (candidate.type !== JOB_SPEC_PDF_MIME_TYPE) return rejectWith(JOB_SPEC_MESSAGES.pdfOnly)
  if (candidate.size > MAX_JOB_SPEC_PDF_BYTES) return rejectWith(JOB_SPEC_MESSAGES.pdfTooLarge)
  return { ok: true, data: candidate }
}

export const hasPdfSignature = (fileBytes: Uint8Array): boolean =>
  PDF_SIGNATURE_BYTES.every((signatureByte, byteIndex) => fileBytes[byteIndex] === signatureByte)

export const validateJobSpecText = (candidate: unknown): ActionResult<string> => {
  const trimmedText = typeof candidate === 'string' ? candidate.trim() : ''
  if (trimmedText.length === 0) return rejectWith(JOB_SPEC_MESSAGES.emptyText)
  if (trimmedText.length > MAX_PASTED_TEXT_LENGTH) return rejectWith(AI_ERROR_MESSAGES.input_too_long)
  return { ok: true, data: trimmedText }
}
