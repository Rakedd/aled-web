import { act, renderHook, waitFor } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { ContactDetails } from '@/domain/entities'
import type { JobApplicationOverview } from '@/domain/job-application'
import { useController } from './controller'

const JOB_APPLICATION: JobApplicationOverview = {
  id: 'application-1',
  userId: 'user-1',
  title: 'Développeur React',
  source: 'Free-Work',
  postingUrl: null,
  postingRawText: 'Texte original',
  status: 'applied',
  intermediaryId: 'intermediary-1',
  contactId: 'contact-1',
  endClientId: 'end-client-1',
  postedDailyRate: 650,
  requestedDailyRate: null,
  location: 'Paris',
  remotePolicy: null,
  desiredStart: null,
  duration: '6 mois',
  appliedOn: new Date('2026-10-10T08:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
  createdAt: new Date('2026-10-10T08:00:00Z'),
  updatedAt: new Date('2026-10-10T08:00:00Z'),
  lastActivityAt: null,
  hasJobSpec: false,
  intermediaryName: 'Free-Work',
  contactName: 'Jeanne Martin',
  endClientName: 'Société Générale',
  endClientParentName: 'Groupe SG',
  endClientLabel: 'Société Générale (Groupe SG)',
}

const CONTACT_DETAILS: ContactDetails = {
  id: 'contact-1',
  fullName: 'Jeanne Martin',
  phone: '0102030405',
  email: 'jeanne@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/jeanne',
}

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const renderMissionInfoController = ({
  jobApplication = JOB_APPLICATION,
  contactDetailsResult = { ok: true, data: CONTACT_DETAILS },
}: {
  jobApplication?: JobApplicationOverview
  contactDetailsResult?: ActionResult<ContactDetails>
} = {}) => {
  const updateJobApplication = jest.fn().mockResolvedValue(SUCCESS)
  const setEndClientParent = jest.fn().mockResolvedValue(SUCCESS)
  const getContactDetails = jest.fn().mockResolvedValue(contactDetailsResult)
  const updateContactDetails = jest.fn().mockResolvedValue(SUCCESS)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({
      jobApplication,
      updateJobApplication,
      setEndClientParent,
      getContactDetails,
      updateContactDetails,
      onDataChanged,
    }),
  )
  return { result, updateJobApplication, setEndClientParent, getContactDetails, updateContactDetails, onDataChanged }
}

describe('mission-info-form useController', () => {
  it('starts without changes and sends nothing when saving', async () => {
    const { result, updateJobApplication } = renderMissionInfoController()
    expect(result.current.hasChanges).toBe(false)
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('sends only the modified fields', async () => {
    const { result, updateJobApplication, onDataChanged } = renderMissionInfoController()
    act(() => result.current.setTextFormValue('location', 'Lyon'))
    act(() => result.current.setTextFormValue('requestedDailyRate', '700'))
    expect(result.current.hasChanges).toBe(true)
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { location: 'Lyon', requestedDailyRate: 700 })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('sends null for a cleared field and detaches a cleared entity name', async () => {
    const { result, updateJobApplication } = renderMissionInfoController()
    act(() => result.current.setTextFormValue('duration', ''))
    act(() => result.current.setTextFormValue('intermediaryName', ''))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { duration: null, intermediaryName: null })
  })

  it('sends the stack when it changes', async () => {
    const { result, updateJobApplication } = renderMissionInfoController()
    const newStack = [...JOB_APPLICATION.stack, { name: 'Node', category: 'language' as const, origin: 'posting' as const }]
    act(() => result.current.setStack(newStack))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { stack: newStack })
  })

  it.each(['-50', 'abc', '12.5'])('refuses the invalid daily rate %s with TJM invalide', async (dailyRateText) => {
    const { result, updateJobApplication } = renderMissionInfoController()
    act(() => result.current.setTextFormValue('requestedDailyRate', dailyRateText))
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('TJM invalide')
  })

  it('unlinks the group through setEndClientParent when only the group is cleared', async () => {
    const { result, updateJobApplication, setEndClientParent } = renderMissionInfoController()
    act(() => result.current.setTextFormValue('endClientParentName', ''))
    await act(() => result.current.save())
    expect(setEndClientParent).toHaveBeenCalledWith('end-client-1', null)
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('sends the group through updateJobApplication when it is renamed', async () => {
    const { result, updateJobApplication, setEndClientParent } = renderMissionInfoController()
    act(() => result.current.setTextFormValue('endClientParentName', 'Groupe BNP'))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { endClientParentName: 'Groupe BNP' })
    expect(setEndClientParent).not.toHaveBeenCalled()
  })

  it('shows the server message and does not refresh when the update is refused', async () => {
    const { result, updateJobApplication, onDataChanged } = renderMissionInfoController()
    updateJobApplication.mockResolvedValue({ ok: false, errorMessage: 'Candidature introuvable' })
    act(() => result.current.setTextFormValue('location', 'Lyon'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Candidature introuvable')
    expect(onDataChanged).not.toHaveBeenCalled()
    expect(result.current.isSaving).toBe(false)
  })

  it('shows the generic error when the update throws', async () => {
    const { result, updateJobApplication } = renderMissionInfoController()
    updateJobApplication.mockRejectedValue(new Error('network'))
    act(() => result.current.setTextFormValue('location', 'Lyon'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSaving).toBe(false)
  })

  it('loads the contact phone, e-mail and LinkedIn', async () => {
    const { result, getContactDetails } = renderMissionInfoController()
    await waitFor(() => expect(result.current.isContactLoaded).toBe(true))
    expect(getContactDetails).toHaveBeenCalledWith('contact-1')
    expect(result.current.contactFormValues).toEqual({
      phone: '0102030405',
      email: 'jeanne@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/jeanne',
    })
  })

  it('does not load a contact when the application has none', () => {
    const { getContactDetails, result } = renderMissionInfoController({
      jobApplication: { ...JOB_APPLICATION, contactId: null, contactName: null },
    })
    expect(getContactDetails).not.toHaveBeenCalled()
    expect(result.current.isContactLoaded).toBe(false)
  })

  it('shows an error when the contact cannot be loaded', async () => {
    const { result } = renderMissionInfoController({
      contactDetailsResult: { ok: false, errorMessage: 'Contact introuvable' },
    })
    await waitFor(() => expect(result.current.contactErrorMessage).toBe('Contact introuvable'))
    expect(result.current.isContactLoaded).toBe(false)
  })

  it('saves edited contact details through updateContactDetails', async () => {
    const { result, updateContactDetails, onDataChanged } = renderMissionInfoController()
    await waitFor(() => expect(result.current.isContactLoaded).toBe(true))
    act(() => result.current.setContactFormValue('phone', '0611223344'))
    act(() => result.current.setContactFormValue('linkedinUrl', ''))
    await act(() => result.current.saveContact())
    expect(updateContactDetails).toHaveBeenCalledWith('contact-1', {
      fullName: 'Jeanne Martin',
      phone: '0611223344',
      email: 'jeanne@example.com',
      linkedinUrl: null,
    })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses a malformed contact e-mail with E-mail invalide', async () => {
    const { result, updateContactDetails } = renderMissionInfoController()
    await waitFor(() => expect(result.current.isContactLoaded).toBe(true))
    act(() => result.current.setContactFormValue('email', 'pas-un-email'))
    await act(() => result.current.saveContact())
    expect(updateContactDetails).not.toHaveBeenCalled()
    expect(result.current.contactErrorMessage).toBe('E-mail invalide')
  })

  it('shows the generic error when the contact update throws', async () => {
    const { result, updateContactDetails } = renderMissionInfoController()
    await waitFor(() => expect(result.current.isContactLoaded).toBe(true))
    updateContactDetails.mockRejectedValue(new Error('network'))
    await act(() => result.current.saveContact())
    expect(result.current.contactErrorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isSavingContact).toBe(false)
  })
})
