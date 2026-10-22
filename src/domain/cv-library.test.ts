import {
  CV_MESSAGES,
  DEFAULT_CV_FILE_NAME,
  MAX_CV_PDF_BYTES,
  buildCvStoragePath,
  buildCvVersionPdfPath,
  buildDefaultTailoredCvLabel,
  formatCvCount,
  formatCvOutdatedMessage,
  formatCvSentCount,
  formatProposedMissionSentCv,
  formatSentCvShortLabel,
  formatSentCvVersionLabel,
  isCvDueForReview,
  isCvLibraryFull,
  readCvFileName,
  toCvOptions,
  validateCvLabel,
  validateCvPdfFile,
} from './cv-library'
import type { CvLibraryItem } from './cv-library'

const NOW = new Date('2026-10-22T08:00:00Z')
const NINETY_DAYS_AGO = new Date('2026-07-24T08:00:00Z')
const EIGHTY_NINE_DAYS_AGO = new Date('2026-07-25T08:00:00Z')

describe('validateCvPdfFile', () => {
  it.each([[null], [new Blob([])], [new Blob(['x'], { type: 'text/plain' })]])('asks for a pdf file for %p', (candidate) => {
    expect(validateCvPdfFile(candidate)).toEqual({ ok: false, errorMessage: 'Dépose un fichier PDF.' })
  })

  it('refuses a pdf over 4 MB and accepts exactly 4 MB', () => {
    const tooLargePdf = new Blob([new Uint8Array(MAX_CV_PDF_BYTES + 1)], { type: 'application/pdf' })
    const largestAllowedPdf = new Blob([new Uint8Array(MAX_CV_PDF_BYTES)], { type: 'application/pdf' })
    expect(validateCvPdfFile(tooLargePdf)).toEqual({ ok: false, errorMessage: 'PDF trop lourd (4 Mo maximum)' })
    expect(validateCvPdfFile(largestAllowedPdf)).toEqual({ ok: true, data: largestAllowedPdf })
  })
})

describe('validateCvLabel', () => {
  it('requires a label of at most 100 characters', () => {
    expect(validateCvLabel('  ')).toEqual({ ok: false, errorMessage: CV_MESSAGES.missingLabel })
    expect(validateCvLabel('a'.repeat(101)).ok).toBe(false)
    expect(validateCvLabel('a'.repeat(100)).ok).toBe(true)
  })

  it('trims the label', () => {
    expect(validateCvLabel('  CV DevOps  ')).toEqual({ ok: true, data: 'CV DevOps' })
  })
})

describe('buildDefaultTailoredCvLabel', () => {
  it('defaults the tailored label to the job application title, cut to 100 characters', () => {
    expect(buildDefaultTailoredCvLabel('Dev React')).toBe('CV sur mesure · Dev React')
    expect(buildDefaultTailoredCvLabel('a'.repeat(200))).toHaveLength(100)
  })
})

describe('cv review reminder', () => {
  it('is due for review when upload and confirmation are both 90 days old', () => {
    expect(isCvDueForReview({ reviewedAt: NINETY_DAYS_AGO, currentVersionUploadedAt: NINETY_DAYS_AGO }, NOW)).toBe(true)
  })

  it('is not due for review at 89 days', () => {
    expect(
      isCvDueForReview({ reviewedAt: EIGHTY_NINE_DAYS_AGO, currentVersionUploadedAt: EIGHTY_NINE_DAYS_AGO }, NOW),
    ).toBe(false)
  })

  it('is not due for review when the cv was confirmed recently', () => {
    expect(isCvDueForReview({ reviewedAt: new Date('2026-10-01T08:00:00Z'), currentVersionUploadedAt: NINETY_DAYS_AGO }, NOW)).toBe(false)
  })

  it('is never due for review without a current version', () => {
    expect(isCvDueForReview({ reviewedAt: NINETY_DAYS_AGO, currentVersionUploadedAt: null }, NOW)).toBe(false)
  })

  it('writes the outdated message with whole months', () => {
    expect(formatCvOutdatedMessage('CV DevOps', NINETY_DAYS_AGO, NOW)).toBe(
      "Ton CV DevOps n'a pas bougé depuis 3 mois. Un coup de neuf ?",
    )
  })
})

describe('formatting', () => {
  it.each([
    [0, 'Pas encore envoyé'],
    [1, 'Envoyé dans 1 candidature'],
    [3, 'Envoyé dans 3 candidatures'],
  ])('formats the sent count %p', (sentCount, expected) => {
    expect(formatCvSentCount(sentCount)).toBe(expected)
  })

  it('formats the cv count and the full library check', () => {
    expect(formatCvCount(3)).toBe('3 / 10')
    expect(isCvLibraryFull(9)).toBe(false)
    expect(isCvLibraryFull(10)).toBe(true)
  })

  it('formats the sent cv for the block, the mobile row and the proposed missions', () => {
    const sentCv = { versionId: 'v1', label: 'CV DevOps', uploadedAt: new Date('2026-03-05T10:00:00Z') }
    expect(formatSentCvVersionLabel(sentCv)).toBe('CV DevOps · version du 05/03/2026')
    expect(formatSentCvShortLabel(sentCv)).toBe('CV DevOps · 05/03/2026')
    expect(formatProposedMissionSentCv(sentCv.label, sentCv.uploadedAt)).toBe('CV : CV DevOps (05/03/2026)')
  })
})

describe('paths and options', () => {
  it('builds the storage path and the pdf route of a version', () => {
    expect(buildCvStoragePath('u1', 'v1')).toBe('u1/v1.pdf')
    expect(buildCvVersionPdfPath('v1')).toBe('/api/cv/versions/v1/pdf')
  })

  it('lists only cvs with a current version as options', () => {
    const buildCv = (id: string, hasVersion: boolean): CvLibraryItem => ({
      id,
      label: `CV ${id}`,
      reviewedAt: NOW,
      currentVersion: hasVersion ? { id: `v${id}`, uploadedAt: NOW, fileName: 'cv.pdf' } : null,
      sentCount: 0,
      previousSentVersions: [],
    })
    expect(toCvOptions([buildCv('a', true), buildCv('b', false), buildCv('c', true)])).toEqual([
      { id: 'a', label: 'CV a' },
      { id: 'c', label: 'CV c' },
    ])
  })

  it('reads the file name or falls back to cv.pdf', () => {
    expect(readCvFileName(new File(['x'], '  mon-cv.pdf  '))).toBe('mon-cv.pdf')
    expect(readCvFileName(new File(['x'], 'a'.repeat(300))).length).toBe(255)
    expect(readCvFileName(new File(['x'], '   '))).toBe(DEFAULT_CV_FILE_NAME)
    expect(readCvFileName(new Blob(['x']))).toBe(DEFAULT_CV_FILE_NAME)
  })
})
