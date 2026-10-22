import type { ActionResult } from './action-result'
import { pluralizeFrench } from './french-plural'
import { rejectWith, validateRequiredText } from './input-validation'
import { countParisCalendarDaysBetween, formatParisDate } from './paris-time'

export const CVS_BUCKET = 'cvs'
export const CV_PDF_MIME_TYPE = 'application/pdf'
export const MAX_CV_PDF_MEGABYTES = 4
export const MAX_CV_PDF_BYTES = MAX_CV_PDF_MEGABYTES * 1024 * 1024
export const MAXIMUM_CV_COUNT = 10
export const MAXIMUM_CV_LABEL_LENGTH = 100
export const MAXIMUM_CV_FILE_NAME_LENGTH = 255
export const DEFAULT_CV_FILE_NAME = 'cv.pdf'
export const CV_REVIEW_INTERVAL_DAYS = 90
export const DAYS_PER_REVIEW_MONTH = 30

export const CV_FORM_FIELD_NAMES = { pdf: 'cvPdf', label: 'cvLabel', addToLibrary: 'addToLibrary' } as const

export const CV_MESSAGES = {
  missingPdf: 'Dépose un fichier PDF.',
  pdfTooLarge: `PDF trop lourd (${MAX_CV_PDF_MEGABYTES} Mo maximum)`,
  invalidPdf: "Ce fichier n'est pas un PDF valide.",
  libraryFull: 'Tu as déjà 10 CV. Supprimes-en un pour en ajouter un nouveau.',
  libraryFullAfterTailoredUpload: 'Le CV est rattaché à la candidature, mais ta bibliothèque est pleine (10 CV).',
  missingLabel: 'Donne un nom à ce CV.',
  missingLibraryChoice: 'Choisis un CV dans ta bibliothèque.',
  cvNotFound: 'CV introuvable',
  cvVersionNotFound: 'Version de CV introuvable',
  openFailed: "Impossible d'ouvrir le CV pour le moment.",
} as const

export type CvCurrentVersion = { id: string; uploadedAt: Date; fileName: string }

export type CvPreviousSentVersion = { id: string; uploadedAt: Date; sentCount: number }

export type CvLibraryItem = {
  id: string
  label: string
  reviewedAt: Date
  currentVersion: CvCurrentVersion | null
  sentCount: number
  previousSentVersions: CvPreviousSentVersion[]
}

export type CvOption = Pick<CvLibraryItem, 'id' | 'label'>

export type SentCv = { versionId: string; label: string; uploadedAt: Date }

export type CvReviewDates = { reviewedAt: Date; currentVersionUploadedAt: Date | null }

export type TailoredCvUploadOutcome = { libraryErrorMessage: string | null }

export const validateCvLabel = (candidate: unknown): ActionResult<string> =>
  validateRequiredText(candidate, { label: 'Nom du CV', maximumLength: MAXIMUM_CV_LABEL_LENGTH }, CV_MESSAGES.missingLabel)

export const validateCvPdfFile = (candidate: unknown): ActionResult<Blob> => {
  if (!(candidate instanceof Blob) || candidate.size === 0 || candidate.type !== CV_PDF_MIME_TYPE) {
    return rejectWith(CV_MESSAGES.missingPdf)
  }
  if (candidate.size > MAX_CV_PDF_BYTES) return rejectWith(CV_MESSAGES.pdfTooLarge)
  return { ok: true, data: candidate }
}

export const readCvFileName = (pdfFile: Blob): string => {
  const trimmedFileName = pdfFile instanceof File ? pdfFile.name.trim() : ''
  return trimmedFileName.length === 0 ? DEFAULT_CV_FILE_NAME : trimmedFileName.slice(0, MAXIMUM_CV_FILE_NAME_LENGTH)
}

export const buildCvStoragePath = (userId: string, versionId: string): string => `${userId}/${versionId}.pdf`

export const buildCvVersionPdfPath = (versionId: string): string => `/api/cvs/versions/${versionId}/pdf`

export const buildDefaultTailoredCvLabel = (jobApplicationTitle: string): string =>
  `CV sur mesure · ${jobApplicationTitle}`.slice(0, MAXIMUM_CV_LABEL_LENGTH)

export const isCvLibraryFull = (cvCount: number): boolean => cvCount >= MAXIMUM_CV_COUNT

export const findCvLastChangeDate = ({ reviewedAt, currentVersionUploadedAt }: CvReviewDates): Date =>
  currentVersionUploadedAt !== null && currentVersionUploadedAt.getTime() > reviewedAt.getTime()
    ? currentVersionUploadedAt
    : reviewedAt

export const isCvDueForReview = (reviewDates: CvReviewDates, now: Date): boolean =>
  reviewDates.currentVersionUploadedAt !== null &&
  countParisCalendarDaysBetween(findCvLastChangeDate(reviewDates), now) >= CV_REVIEW_INTERVAL_DAYS

export const formatCvOutdatedMessage = (cvLabel: string, lastChangeDate: Date, now: Date): string => {
  const monthsWithoutChange = Math.floor(countParisCalendarDaysBetween(lastChangeDate, now) / DAYS_PER_REVIEW_MONTH)
  return `Ton ${cvLabel} n'a pas bougé depuis ${monthsWithoutChange} mois. Un coup de neuf ?`
}

export const formatCvCount = (cvCount: number): string => `${cvCount} / ${MAXIMUM_CV_COUNT}`

export const formatCvSentCount = (sentCount: number): string =>
  sentCount === 0
    ? 'Pas encore envoyé'
    : `Envoyé dans ${sentCount} ${pluralizeFrench(sentCount, 'candidature', 'candidatures')}`

export const formatSentCvVersionLabel = ({ label, uploadedAt }: SentCv): string =>
  `${label} · version du ${formatParisDate(uploadedAt)}`

export const formatSentCvShortLabel = ({ label, uploadedAt }: SentCv): string =>
  `${label} · ${formatParisDate(uploadedAt)}`

export const formatProposedMissionSentCv = (sentCvLabel: string, sentCvUploadedAt: Date): string =>
  `CV : ${sentCvLabel} (${formatParisDate(sentCvUploadedAt)})`

export const toCvOptions = (cvs: CvLibraryItem[]): CvOption[] =>
  cvs.filter((cv) => cv.currentVersion !== null).map(({ id, label }) => ({ id, label }))
