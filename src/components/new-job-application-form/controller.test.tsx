import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobPostingExtraction } from '@/domain/job-posting-extraction'
import { useController } from './controller'

const EXTRACTION: JobPostingExtraction = {
  title: 'Développeur React senior',
  intermediaryName: 'Free-Work',
  contactName: 'Jeanne Martin',
  contactEmail: 'jeanne@example.com',
  contactPhone: '0102030405',
  endClientName: 'Société Générale',
  postedDailyRate: 650,
  location: 'Paris',
  remotePolicy: '2 jours par semaine',
  desiredStart: 'Dès que possible',
  duration: '6 mois',
  stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
}

const renderNewJobApplicationFormController = ({
  extractionResult = { ok: true, data: EXTRACTION },
  creationResult = { ok: true, data: { id: 'application-1' } },
}: {
  extractionResult?: ActionResult<JobPostingExtraction>
  creationResult?: ActionResult<{ id: string }>
} = {}) => {
  const extractJobPosting = jest.fn().mockResolvedValue(extractionResult)
  const createJobApplication = jest.fn().mockResolvedValue(creationResult)
  const navigateTo = jest.fn()
  const { result } = renderHook(() => useController({ extractJobPosting, createJobApplication, navigateTo }))
  return { result, extractJobPosting, createJobApplication, navigateTo }
}

describe('new-job-application-form useController', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-17T23:30:00Z') })
  })
  afterEach(() => jest.useRealTimers())

  it('starts on the paste step', () => {
    const { result } = renderNewJobApplicationFormController()
    expect(result.current.step).toBe('paste')
  })

  it('refuses an empty pasted text without calling the server', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('   '))
    await act(() => result.current.extract())
    expect(extractJobPosting).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe("Colle le texte de l'annonce ou passe en saisie manuelle")
    expect(result.current.step).toBe('paste')
  })

  it('refuses a pasted text over 50 000 characters without calling the server', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('a'.repeat(50_001)))
    await act(() => result.current.extract())
    expect(extractJobPosting).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Texte trop long (50 000 caractères maximum).')
  })

  it('prefills the form from the extraction without creating anything', async () => {
    const { result, extractJobPosting, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    expect(extractJobPosting).toHaveBeenCalledWith('Annonce React')
    expect(result.current.step).toBe('form')
    expect(result.current.formValues).toMatchObject({
      title: 'Développeur React senior',
      intermediaryName: 'Free-Work',
      contactName: 'Jeanne Martin',
      contactEmail: 'jeanne@example.com',
      contactPhone: '0102030405',
      endClientName: 'Société Générale',
      postedDailyRate: '650',
      location: 'Paris',
      remotePolicy: '2 jours par semaine',
      desiredStart: 'Dès que possible',
      duration: '6 mois',
      stack: EXTRACTION.stack,
      postingRawText: 'Annonce React',
      status: 'applied',
      appliedOn: '2026-10-18',
      source: '',
    })
    expect(createJobApplication).not.toHaveBeenCalled()
  })

  it('shows an empty form with the pasted text kept and the error visible when the extraction fails', async () => {
    const { result } = renderNewJobApplicationFormController({
      extractionResult: { ok: false, errorMessage: 'Claude est saturé, réessaie dans une minute.' },
    })
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    expect(result.current.step).toBe('form')
    expect(result.current.formValues.title).toBe('')
    expect(result.current.formValues.stack).toEqual([])
    expect(result.current.formValues.postingRawText).toBe('Annonce React')
    expect(result.current.pastedText).toBe('Annonce React')
    expect(result.current.errorMessage).toBe('Claude est saturé, réessaie dans une minute.')
  })

  it('shows a generic error and stops waiting when the extraction call throws', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController()
    extractJobPosting.mockRejectedValue(new Error('network'))
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isExtracting).toBe(false)
    expect(result.current.step).toBe('form')
  })

  it('switches to an empty manual form without calling the AI', () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    expect(result.current.step).toBe('form')
    expect(result.current.formValues.title).toBe('')
    expect(result.current.formValues.status).toBe('applied')
    expect(result.current.errorMessage).toBeNull()
    expect(extractJobPosting).not.toHaveBeenCalled()
  })

  it('refuses to submit without a title', async () => {
    const { result, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    await act(() => result.current.submit())
    expect(createJobApplication).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Le titre est obligatoire')
  })

  it('refuses an invalid contact e-mail and daily rate', async () => {
    const { result, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', 'Mission'))
    act(() => result.current.setTextFormValue('contactEmail', 'pas-un-email'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('E-mail invalide')
    act(() => result.current.setTextFormValue('contactEmail', ''))
    act(() => result.current.setTextFormValue('postedDailyRate', 'abc'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('TJM invalide')
    expect(createJobApplication).not.toHaveBeenCalled()
  })

  it('creates the application once even after two quick submits, then redirects', async () => {
    const { result, createJobApplication, navigateTo } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', ' Mission React '))
    act(() => result.current.setTextFormValue('postedDailyRate', '600'))
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()])
    })
    expect(createJobApplication).toHaveBeenCalledTimes(1)
    expect(createJobApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mission React',
        postedDailyRate: 600,
        status: 'applied',
        appliedOn: new Date('2026-10-17T22:00:00Z'),
        source: null,
        postingRawText: null,
        stack: [],
      }),
    )
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('/candidatures/application-1')
  })

  it('shows the server error and allows a new attempt', async () => {
    const { result, createJobApplication, navigateTo } = renderNewJobApplicationFormController({
      creationResult: { ok: false, errorMessage: 'Impossible d\'enregistrer' },
    })
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', 'Mission'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe("Impossible d'enregistrer")
    expect(result.current.isSubmitting).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
    await act(() => result.current.submit())
    expect(createJobApplication).toHaveBeenCalledTimes(2)
  })

  it('shows a generic error and stops waiting when the creation call throws', async () => {
    const { result, createJobApplication, navigateTo } = renderNewJobApplicationFormController()
    createJobApplication.mockRejectedValue(new Error('network'))
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', 'Mission'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSubmitting).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
