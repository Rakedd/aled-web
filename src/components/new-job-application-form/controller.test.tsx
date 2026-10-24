import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobPostingExtraction } from '@/domain/job-posting-extraction'
import type { PositionedJobApplication } from '@/domain/duplicate-positioning'
import { useController } from './controller'

const POSITIONED_BY_OTHER_AGENCY: PositionedJobApplication = {
  id: 'application-9',
  title: 'Lead React',
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-07T08:00:00Z'),
}

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
  hasAnthropicApiKey = true,
  positionedJobApplications = [],
}: {
  extractionResult?: ActionResult<JobPostingExtraction>
  creationResult?: ActionResult<{ id: string }>
  hasAnthropicApiKey?: boolean
  positionedJobApplications?: PositionedJobApplication[]
} = {}) => {
  const extractJobPosting = jest.fn().mockResolvedValue(extractionResult)
  const createJobApplication = jest.fn().mockResolvedValue(creationResult)
  const navigateTo = jest.fn()
  const { result } = renderHook(() =>
    useController({ extractJobPosting, createJobApplication, navigateTo, hasAnthropicApiKey, positionedJobApplications }),
  )
  return { result, extractJobPosting, createJobApplication, navigateTo }
}

describe('new-job-application-form useController', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-17T23:30:00Z') })
  })
  afterEach(() => jest.useRealTimers())

  it('offers to cancel a manual entry, but not a prefill by Claude', async () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    expect(result.current.canCancelManualEntry).toBe(true)

    const prefilled = renderNewJobApplicationFormController()
    act(() => prefilled.result.current.setPastedText('Annonce React'))
    await act(() => prefilled.result.current.extract())
    expect(prefilled.result.current.canCancelManualEntry).toBe(false)
  })

  it('goes back to the paste step with the pasted text kept when the untouched manual entry is cancelled', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('Annonce React à Lyon'))
    act(() => result.current.switchToManualEntry())

    act(() => result.current.requestManualEntryCancellation())

    expect(result.current.step).toBe('paste')
    expect(result.current.pastedText).toBe('Annonce React à Lyon')
    expect(result.current.isManualEntryCancellationConfirmationShown).toBe(false)
  })

  it('keeps the text edited in the manual entry when going back to the paste step', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('postingRawText', 'Annonce collée après coup'))

    act(() => result.current.requestManualEntryCancellation())

    expect(result.current.step).toBe('paste')
    expect(result.current.pastedText).toBe('Annonce collée après coup')
  })

  it('asks for confirmation before discarding what was typed, and keeps the entry when the user changes their mind', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', 'Lead React'))

    act(() => result.current.requestManualEntryCancellation())
    expect(result.current.step).toBe('form')
    expect(result.current.isManualEntryCancellationConfirmationShown).toBe(true)

    act(() => result.current.keepManualEntry())
    expect(result.current.isManualEntryCancellationConfirmationShown).toBe(false)
    expect(result.current.formValues.title).toBe('Lead React')
  })

  it('discards what was typed once the cancellation is confirmed, then starts a fresh manual entry', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('title', 'Lead React'))
    act(() => result.current.requestManualEntryCancellation())

    act(() => result.current.confirmManualEntryCancellation())

    expect(result.current.step).toBe('paste')
    expect(result.current.isManualEntryCancellationConfirmationShown).toBe(false)
    act(() => result.current.switchToManualEntry())
    expect(result.current.formValues.title).toBe('')
  })

  it('asks the paste step to take the focus back after a cancellation', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.switchToManualEntry())
    const focusRequestBefore = result.current.pastedTextFocusRequest

    act(() => result.current.requestManualEntryCancellation())

    expect(result.current.pastedTextFocusRequest).toBe(focusRequestBefore + 1)
  })

  it('warns as soon as the typed end client was positioned by another agency 10 days ago', () => {
    const { result } = renderNewJobApplicationFormController({ positionedJobApplications: [POSITIONED_BY_OTHER_AGENCY] })
    act(() => result.current.switchToManualEntry())
    expect(result.current.duplicatePositioningRisks).toEqual([])
    act(() => result.current.setTextFormValue('intermediaryName', 'Free-Work'))
    act(() => result.current.setTextFormValue('endClientName', 'societe generale'))
    expect(result.current.duplicatePositioningRisks).toEqual([POSITIONED_BY_OTHER_AGENCY])
  })

  it('stops warning when the typed agency is the same', () => {
    const { result } = renderNewJobApplicationFormController({ positionedJobApplications: [POSITIONED_BY_OTHER_AGENCY] })
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('endClientName', 'Société Générale'))
    expect(result.current.duplicatePositioningRisks).toHaveLength(1)
    act(() => result.current.setTextFormValue('intermediaryName', 'Autre ESN'))
    expect(result.current.duplicatePositioningRisks).toEqual([])
  })

  it('does not warn when the application date is cleared', () => {
    const { result } = renderNewJobApplicationFormController({ positionedJobApplications: [POSITIONED_BY_OTHER_AGENCY] })
    act(() => result.current.switchToManualEntry())
    act(() => result.current.setTextFormValue('endClientName', 'Société Générale'))
    act(() => result.current.setTextFormValue('appliedOn', ''))
    expect(result.current.duplicatePositioningRisks).toEqual([])
  })

  it('starts on the paste step', () => {
    const { result } = renderNewJobApplicationFormController()
    expect(result.current.step).toBe('paste')
  })

  it('flags the form as prefilled only after a successful extraction', async () => {
    const { result } = renderNewJobApplicationFormController()
    expect(result.current.isPrefilledByClaude).toBe(false)
    act(() => result.current.setPastedText('Mission React à Paris'))
    await act(() => result.current.extract())
    expect(result.current.isPrefilledByClaude).toBe(true)
  })

  it('does not flag the form as prefilled after a failed extraction', async () => {
    const { result } = renderNewJobApplicationFormController({
      extractionResult: { ok: false, errorMessage: 'Échec' },
    })
    act(() => result.current.setPastedText('Mission React à Paris'))
    await act(() => result.current.extract())
    expect(result.current.isPrefilledByClaude).toBe(false)
  })

  it('never calls the AI without a Claude key', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController({ hasAnthropicApiKey: false })
    act(() => result.current.setPastedText('Mission React à Paris'))
    await act(() => result.current.extract())
    expect(extractJobPosting).not.toHaveBeenCalled()
    expect(result.current.step).toBe('paste')
    expect(result.current.isExtracting).toBe(false)
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

  it('keeps the pasted text in the manual form', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('Annonce React'))
    act(() => result.current.switchToManualEntry())
    expect(result.current.formValues.postingRawText).toBe('Annonce React')
  })

  it('offers to retry a failed extraction on the editable posting text and prefills on success', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController({
      extractionResult: { ok: false, errorMessage: 'Claude est saturé, réessaie dans une minute.' },
    })
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    expect(result.current.hasExtractionFailed).toBe(true)
    act(() => result.current.setTextFormValue('source', 'Malt'))
    act(() => result.current.setTextFormValue('postingRawText', 'Annonce React corrigée'))
    extractJobPosting.mockResolvedValue({ ok: true, data: EXTRACTION })
    await act(() => result.current.extract())
    expect(extractJobPosting).toHaveBeenLastCalledWith('Annonce React corrigée')
    expect(result.current.hasExtractionFailed).toBe(false)
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.formValues).toMatchObject({
      title: 'Développeur React senior',
      source: 'Malt',
      postingRawText: 'Annonce React corrigée',
    })
  })

  it('forgets edited contact fields when the form is prefilled again by the AI', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController({
      extractionResult: { ok: false, errorMessage: 'Claude est saturé, réessaie dans une minute.' },
    })
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    act(() => result.current.setTextFormValue('contactPhone', '0699999999'))
    expect(result.current.userEditedContactFields).toEqual(['phone'])
    extractJobPosting.mockResolvedValue({ ok: true, data: EXTRACTION })
    await act(() => result.current.extract())
    expect(result.current.formValues.contactPhone).toBe('0102030405')
    expect(result.current.userEditedContactFields).toEqual([])
  })

  it('applies the same guards when retrying with a blank posting text', async () => {
    const { result, extractJobPosting } = renderNewJobApplicationFormController({
      extractionResult: { ok: false, errorMessage: 'Claude est saturé, réessaie dans une minute.' },
    })
    act(() => result.current.setPastedText('Annonce'))
    await act(() => result.current.extract())
    act(() => result.current.setTextFormValue('postingRawText', '  '))
    await act(() => result.current.extract())
    expect(extractJobPosting).toHaveBeenCalledTimes(1)
    expect(result.current.errorMessage).toBe("Colle le texte de l'annonce ou passe en saisie manuelle")
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
      null,
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

  const existingContactSuggestion = {
    id: 'contact-1',
    name: 'Jeanne Martin',
    label: 'Jeanne Martin · Acme',
    parentName: null,
    contactDetails: { phone: '0611223344', email: 'jeanne@acme.fr', linkedinUrl: 'https://www.linkedin.com/in/jeanne' },
  }

  it('prefills phone, email and LinkedIn when an existing contact is chosen', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.selectContactSuggestion(existingContactSuggestion))
    expect(result.current.formValues).toMatchObject({
      contactPhone: '0611223344',
      contactEmail: 'jeanne@acme.fr',
      contactLinkedinUrl: 'https://www.linkedin.com/in/jeanne',
    })
  })

  it('marks a contact field as edited when the user types in it', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setTextFormValue('contactPhone', '0699999999'))
    act(() => result.current.setTextFormValue('contactLinkedinUrl', 'https://www.linkedin.com/in/x'))
    act(() => result.current.setTextFormValue('title', 'Titre'))
    expect(result.current.userEditedContactFields).toEqual(['phone', 'linkedinUrl'])
  })

  it('does not mark AI-prefilled contact fields as edited', async () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    expect(result.current.formValues.contactEmail).toBe('jeanne@example.com')
    expect(result.current.userEditedContactFields).toEqual([])
  })

  it('resets edited fields when another contact is chosen', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setTextFormValue('contactEmail', 'autre@x.fr'))
    act(() => result.current.selectContactSuggestion(existingContactSuggestion))
    expect(result.current.userEditedContactFields).toEqual([])
    expect(result.current.formValues.contactEmail).toBe('jeanne@acme.fr')
    expect(result.current.formValues.contactPhone).toBe('0611223344')
  })

  it('clears details prefilled from a chosen contact when the name is retyped', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.selectContactSuggestion(existingContactSuggestion))
    act(() => result.current.setTextFormValue('contactName', 'Bob'))
    expect(result.current.formValues).toMatchObject({
      contactName: 'Bob',
      contactPhone: '',
      contactEmail: '',
      contactLinkedinUrl: '',
    })
  })

  it('keeps contact details the user edited when the name is retyped', () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.selectContactSuggestion(existingContactSuggestion))
    act(() => result.current.setTextFormValue('contactEmail', 'bob@x.fr'))
    act(() => result.current.setTextFormValue('contactName', 'Bob'))
    expect(result.current.formValues).toMatchObject({
      contactEmail: 'bob@x.fr',
      contactPhone: '',
      contactLinkedinUrl: '',
    })
  })

  it('keeps AI-prefilled contact details when the name is edited', async () => {
    const { result } = renderNewJobApplicationFormController()
    act(() => result.current.setPastedText('Annonce React'))
    await act(() => result.current.extract())
    act(() => result.current.setTextFormValue('contactName', 'Bob'))
    expect(result.current.formValues).toMatchObject({ contactEmail: 'jeanne@example.com', contactPhone: '0102030405' })
  })

  it('sends the LinkedIn url and the edited fields', async () => {
    const { result, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.setTextFormValue('title', 'Mission'))
    act(() => result.current.setTextFormValue('contactName', 'Jeanne Martin'))
    act(() => result.current.setTextFormValue('contactLinkedinUrl', 'https://www.linkedin.com/in/jeanne'))
    await act(() => result.current.submit())
    expect(createJobApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactLinkedinUrl: 'https://www.linkedin.com/in/jeanne',
        userEditedContactFields: ['linkedinUrl'],
      }),
      null,
    )
  })

  it('sends the chosen cv id with the job application', async () => {
    const { result, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.setTextFormValue('title', 'Mission'))
    act(() => result.current.setSentCvId('cv-1'))
    await act(() => result.current.submit())
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mission' }), 'cv-1')
  })

  it('sends null when Aucun is kept', async () => {
    const { result, createJobApplication } = renderNewJobApplicationFormController()
    act(() => result.current.setTextFormValue('title', 'Mission'))
    act(() => result.current.setSentCvId('cv-1'))
    act(() => result.current.setSentCvId(''))
    await act(() => result.current.submit())
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mission' }), null)
  })
})
