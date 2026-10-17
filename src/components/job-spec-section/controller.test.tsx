import { act, render, renderHook, screen } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobSpec, JobSpecSaveOutcome } from '@/domain/job-spec'
import type { StackItem } from '@/domain/types'
import { useController } from './controller'
import { JobSpecSection } from './job-spec-section'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'
const SCANNED_PDF_MESSAGE = 'Aucune technologie trouvée dans ce document (PDF scanné ?). Ajoute la stack à la main.'

const extractedStack: StackItem[] = [
  { name: 'React', category: 'framework', origin: 'job_spec' },
  { name: 'Kafka', category: 'tool', origin: 'job_spec' },
]

const createPdfFile = (sizeInBytes = 2_000, mimeType = 'application/pdf'): File => {
  const pdfFile = new File(['%PDF-1.7'], 'fiche.pdf', { type: mimeType })
  Object.defineProperty(pdfFile, 'size', { value: sizeInBytes })
  return pdfFile
}

const createActions = (saveOutcome: JobSpecSaveOutcome = { pendingStack: extractedStack, aiErrorMessage: null }) => {
  const saveResult: ActionResult<JobSpecSaveOutcome> = { ok: true, data: saveOutcome }
  return {
    uploadJobSpecPdf: jest.fn().mockResolvedValue(saveResult),
    saveJobSpecText: jest.fn().mockResolvedValue(saveResult),
    confirmJobSpecStack: jest.fn().mockResolvedValue({ ok: true, data: null }),
    discardPendingJobSpecStack: jest.fn().mockResolvedValue({ ok: true, data: null }),
  }
}

const renderJobSpecSectionController = ({
  jobSpec = null,
  saveOutcome,
}: { jobSpec?: JobSpec | null; saveOutcome?: JobSpecSaveOutcome } = {}) => {
  const actions = createActions(saveOutcome)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({ jobApplicationId: JOB_APPLICATION_ID, jobSpec, ...actions, onDataChanged }),
  )
  return { result, onDataChanged, ...actions }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('job-spec-section useController', () => {
  it('refuses a 25 MB file on the client without uploading it', async () => {
    const { result, uploadJobSpecPdf } = renderJobSpecSectionController()
    await act(() => result.current.selectPdfFile(createPdfFile(25 * 1024 * 1024)))
    expect(result.current.errorMessage).toBe('PDF trop lourd (4 Mo maximum)')
    expect(uploadJobSpecPdf).not.toHaveBeenCalled()
  })

  it('refuses a png file on the client without uploading it', async () => {
    const { result, uploadJobSpecPdf } = renderJobSpecSectionController()
    await act(() => result.current.selectPdfFile(createPdfFile(2_000, 'image/png')))
    expect(result.current.errorMessage).toBe('Seuls les PDF sont acceptés')
    expect(uploadJobSpecPdf).not.toHaveBeenCalled()
  })

  it('uploads a valid pdf, shows the received stack as a draft and refreshes the page data', async () => {
    const { result, uploadJobSpecPdf, onDataChanged } = renderJobSpecSectionController()
    const pdfFile = createPdfFile()
    await act(() => result.current.selectPdfFile(pdfFile))
    expect(uploadJobSpecPdf).toHaveBeenCalledWith(JOB_APPLICATION_ID, expect.any(FormData))
    const sentFormData: FormData = uploadJobSpecPdf.mock.calls[0][1]
    expect(sentFormData.get('jobSpecPdf')).toBe(pdfFile)
    expect(result.current.draftStack).toEqual(extractedStack)
    expect(result.current.errorMessage).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('confirms the edited draft stack, then hides the draft', async () => {
    const { result, confirmJobSpecStack, onDataChanged } = renderJobSpecSectionController()
    await act(() => result.current.selectPdfFile(createPdfFile()))
    const editedStack: StackItem[] = [extractedStack[0], { name: 'Docker', category: 'tool', origin: 'job_spec' }]
    act(() => result.current.setDraftStack(editedStack))
    await act(() => result.current.confirmDraftStack())
    expect(confirmJobSpecStack).toHaveBeenCalledWith(JOB_APPLICATION_ID, editedStack)
    expect(result.current.draftStack).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(2)
  })

  it('discards the draft stack', async () => {
    const { result, discardPendingJobSpecStack } = renderJobSpecSectionController({
      jobSpec: { sourceKind: 'pdf', rawText: null, pendingStack: extractedStack, updatedAt: new Date() },
    })
    expect(result.current.draftStack).toEqual(extractedStack)
    await act(() => result.current.discardDraftStack())
    expect(discardPendingJobSpecStack).toHaveBeenCalledWith(JOB_APPLICATION_ID)
    expect(result.current.draftStack).toBeNull()
  })

  it('shows the scanned pdf message when the extraction finds no technology', async () => {
    const { result } = renderJobSpecSectionController({ saveOutcome: { pendingStack: [], aiErrorMessage: null } })
    await act(() => result.current.selectPdfFile(createPdfFile()))
    expect(result.current.noTechnologyFoundMessage).toBe(SCANNED_PDF_MESSAGE)
    expect(result.current.draftStack).toBeNull()
  })

  it('keeps the saved job spec and shows the ai error when the extraction fails', async () => {
    const { result, onDataChanged } = renderJobSpecSectionController({
      saveOutcome: { pendingStack: null, aiErrorMessage: "Claude n'a pas répondu à temps, réessaie." },
    })
    await act(() => result.current.selectPdfFile(createPdfFile()))
    expect(result.current.aiErrorMessage).toBe("Claude n'a pas répondu à temps, réessaie.")
    expect(result.current.draftStack).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('saves the pasted text, then clears the text area', async () => {
    const { result, saveJobSpecText } = renderJobSpecSectionController()
    act(() => result.current.setPastedText('  Stack : React, Kafka  '))
    await act(() => result.current.saveText())
    expect(saveJobSpecText).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'Stack : React, Kafka')
    expect(result.current.pastedText).toBe('')
    expect(result.current.draftStack).toEqual(extractedStack)
  })

  it('refuses a pasted text over 50 000 characters without calling the server', async () => {
    const { result, saveJobSpecText } = renderJobSpecSectionController()
    act(() => result.current.setPastedText('a'.repeat(50_001)))
    await act(() => result.current.saveText())
    expect(result.current.errorMessage).toBe('Texte trop long (50 000 caractères maximum).')
    expect(saveJobSpecText).not.toHaveBeenCalled()
  })

  it('shows the server message and keeps the draft when the confirmation is refused', async () => {
    const { result, confirmJobSpecStack, onDataChanged } = renderJobSpecSectionController({
      jobSpec: { sourceKind: 'pdf', rawText: null, pendingStack: extractedStack, updatedAt: new Date() },
    })
    confirmJobSpecStack.mockResolvedValue({ ok: false, errorMessage: 'Stack invalide' })
    await act(() => result.current.confirmDraftStack())
    expect(result.current.errorMessage).toBe('Stack invalide')
    expect(result.current.draftStack).toEqual(extractedStack)
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error and re-enables the buttons when an action throws', async () => {
    const { result, uploadJobSpecPdf } = renderJobSpecSectionController()
    uploadJobSpecPdf.mockRejectedValue(new Error('network'))
    await act(() => result.current.selectPdfFile(createPdfFile()))
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('clears the previous ai error and no technology message when a new action starts', async () => {
    const { result, uploadJobSpecPdf } = renderJobSpecSectionController({
      saveOutcome: { pendingStack: [], aiErrorMessage: "Claude n'a pas répondu à temps, réessaie." },
    })
    await act(() => result.current.selectPdfFile(createPdfFile()))
    expect(result.current.aiErrorMessage).not.toBeNull()
    expect(result.current.noTechnologyFoundMessage).not.toBeNull()
    uploadJobSpecPdf.mockResolvedValue({ ok: false, errorMessage: 'Candidature introuvable' })
    await act(() => result.current.selectPdfFile(createPdfFile()))
    expect(result.current.aiErrorMessage).toBeNull()
    expect(result.current.noTechnologyFoundMessage).toBeNull()
    expect(result.current.errorMessage).toBe('Candidature introuvable')
  })

  it('clears the previous ai error when the pasted text is refused on the client', async () => {
    const { result } = renderJobSpecSectionController({
      saveOutcome: { pendingStack: null, aiErrorMessage: "Claude n'a pas répondu à temps, réessaie." },
    })
    await act(() => result.current.selectPdfFile(createPdfFile()))
    act(() => result.current.setPastedText('   '))
    await act(() => result.current.saveText())
    expect(result.current.aiErrorMessage).toBeNull()
    expect(result.current.errorMessage).toBe('Colle le texte de la fiche métier')
  })
})

describe('JobSpecSection', () => {
  it('links « Voir le PDF » to the authenticated pdf route in a new tab', () => {
    render(
      <JobSpecSection
        jobApplicationId={JOB_APPLICATION_ID}
        jobSpec={{ sourceKind: 'pdf', rawText: null, pendingStack: null, updatedAt: new Date() }}
        {...createActions()}
      />,
    )
    const pdfLink = screen.getByRole('link', { name: 'Voir le PDF' })
    expect(pdfLink).toHaveAttribute('href', `/api/job-specs/${JOB_APPLICATION_ID}/pdf`)
    expect(pdfLink).toHaveAttribute('target', '_blank')
    expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('lets the user type more than 50 000 characters so the validation can report it', () => {
    render(<JobSpecSection jobApplicationId={JOB_APPLICATION_ID} jobSpec={null} {...createActions()} />)
    expect(screen.getByLabelText('Ou coller le texte de la fiche')).not.toHaveAttribute('maxLength')
  })

  it('shows a pending stack as a draft with the Valider and Ignorer buttons', () => {
    render(
      <JobSpecSection
        jobApplicationId={JOB_APPLICATION_ID}
        jobSpec={{ sourceKind: 'pdf', rawText: null, pendingStack: extractedStack, updatedAt: new Date() }}
        {...createActions()}
      />,
    )
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Kafka')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeInTheDocument()
  })
})
