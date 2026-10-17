/**
 * @jest-environment node
 */
import { AI_ERROR_MESSAGES } from './ai-errors'
import {
  buildJobSpecPdfPath,
  hasPdfSignature,
  JOB_SPEC_MESSAGES,
  MAX_JOB_SPEC_PDF_BYTES,
  validateJobSpecPdfFile,
  validateJobSpecText,
} from './job-spec'

const createFileOfSize = (sizeInBytes: number, mimeType: string): File => {
  const file = new File(['%PDF-'], 'fiche.pdf', { type: mimeType })
  Object.defineProperty(file, 'size', { value: sizeInBytes })
  return file
}

describe('validateJobSpecPdfFile', () => {
  it('caps job spec pdfs at 4 MB', () => {
    expect(MAX_JOB_SPEC_PDF_BYTES).toBe(4_194_304)
  })

  it('accepts a pdf of exactly 4 MB', () => {
    const pdfFile = createFileOfSize(MAX_JOB_SPEC_PDF_BYTES, 'application/pdf')
    expect(validateJobSpecPdfFile(pdfFile)).toEqual({ ok: true, data: pdfFile })
  })

  it('refuses a pdf over 4 MB', () => {
    expect(validateJobSpecPdfFile(createFileOfSize(MAX_JOB_SPEC_PDF_BYTES + 1, 'application/pdf'))).toEqual({
      ok: false,
      errorMessage: 'PDF trop lourd (4 Mo maximum)',
    })
  })

  it('refuses a file that is not declared as a pdf', () => {
    expect(validateJobSpecPdfFile(createFileOfSize(1_000, 'image/png'))).toEqual({
      ok: false,
      errorMessage: 'Seuls les PDF sont acceptés',
    })
  })

  it('refuses a missing or empty file', () => {
    expect(validateJobSpecPdfFile(null)).toEqual({ ok: false, errorMessage: JOB_SPEC_MESSAGES.missingPdf })
    expect(validateJobSpecPdfFile('fiche.pdf')).toEqual({ ok: false, errorMessage: JOB_SPEC_MESSAGES.missingPdf })
    expect(validateJobSpecPdfFile(createFileOfSize(0, 'application/pdf'))).toEqual({
      ok: false,
      errorMessage: JOB_SPEC_MESSAGES.missingPdf,
    })
  })
})

describe('hasPdfSignature', () => {
  it('recognizes bytes starting with %PDF-', () => {
    expect(hasPdfSignature(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true)
  })

  it('rejects bytes that do not start with %PDF-', () => {
    expect(hasPdfSignature(new TextEncoder().encode('<html>%PDF-'))).toBe(false)
    expect(hasPdfSignature(new TextEncoder().encode('%PDF'))).toBe(false)
  })
})

describe('buildJobSpecPdfPath', () => {
  it('points to the authenticated pdf route of the job application', () => {
    expect(buildJobSpecPdfPath('6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00')).toBe(
      '/api/job-specs/6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00/pdf',
    )
  })
})

describe('validateJobSpecText', () => {
  it('trims the pasted text', () => {
    expect(validateJobSpecText('  Mission React  ')).toEqual({ ok: true, data: 'Mission React' })
  })

  it('refuses a blank or malformed text', () => {
    expect(validateJobSpecText('   ')).toEqual({ ok: false, errorMessage: JOB_SPEC_MESSAGES.emptyText })
    expect(validateJobSpecText(42)).toEqual({ ok: false, errorMessage: JOB_SPEC_MESSAGES.emptyText })
  })

  it('refuses a text over 50 000 characters', () => {
    expect(validateJobSpecText('a'.repeat(50_001))).toEqual({
      ok: false,
      errorMessage: AI_ERROR_MESSAGES.input_too_long,
    })
  })
})
