import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { ContactDetails } from '@/domain/entities'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildContactDetails, buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { useController } from './controller'

const SUCCESS: ActionResult<null> = { ok: true, data: null }

type ContactServerData = { jobApplication: JobApplicationOverview; contactDetails: ContactDetails | null }

const renderContactController = ({
  jobApplication = buildJobApplicationOverview(),
  contactDetails = buildContactDetails(),
}: Partial<ContactServerData> = {}) => {
  const updateJobApplication = jest.fn().mockResolvedValue(SUCCESS)
  const updateContactDetails = jest.fn().mockResolvedValue(SUCCESS)
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(
    (serverData: ContactServerData) =>
      useController({ ...serverData, updateJobApplication, updateContactDetails, onDataChanged, onClose }),
    { initialProps: { jobApplication, contactDetails } },
  )
  return { ...renderedHook, updateJobApplication, updateContactDetails, onDataChanged, onClose }
}

describe('contact-edit-form useController', () => {
  it('fills the contact name and details', () => {
    const { result } = renderContactController()
    expect(result.current.formValues).toEqual({
      contactName: 'Jeanne Martin',
      phone: '0102030405',
      email: 'jeanne@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/jeanne',
    })
    expect(result.current.areContactDetailsDisabled).toBe(false)
  })

  it('saves edited details through updateContactDetails, then refreshes and closes', async () => {
    const { result, updateContactDetails, updateJobApplication, onDataChanged, onClose } = renderContactController()
    act(() => result.current.setFormValue('phone', '0611223344'))
    act(() => result.current.setFormValue('linkedinUrl', ''))
    await act(() => result.current.save())
    expect(updateContactDetails).toHaveBeenCalledWith('contact-1', {
      fullName: 'Jeanne Martin',
      phone: '0611223344',
      email: 'jeanne@example.com',
      linkedinUrl: null,
    })
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('links another contact through updateJobApplication and leaves the details aside', async () => {
    const { result, updateContactDetails, updateJobApplication } = renderContactController()
    act(() => result.current.setFormValue('phone', '0611223344'))
    act(() => result.current.setFormValue('contactName', 'Paul Durand'))
    expect(result.current.areContactDetailsDisabled).toBe(true)
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { contactName: 'Paul Durand' })
    expect(updateContactDetails).not.toHaveBeenCalled()
  })

  it('keeps the typed details as a draft while the name changes and restores them when it is reverted', async () => {
    const { result, updateContactDetails } = renderContactController()
    act(() => result.current.setFormValue('phone', '0611223344'))
    act(() => result.current.setFormValue('contactName', 'Paul Durand'))
    expect(result.current.formValues.phone).toBe('0611223344')
    act(() => result.current.setFormValue('contactName', 'Jeanne Martin'))
    expect(result.current.areContactDetailsDisabled).toBe(false)
    expect(result.current.formValues.phone).toBe('0611223344')
    await act(() => result.current.save())
    expect(updateContactDetails).toHaveBeenCalledWith('contact-1', expect.objectContaining({ phone: '0611223344' }))
  })

  it('ignores details that belong to another contact than the linked one', async () => {
    const { result, updateContactDetails, onClose } = renderContactController({
      contactDetails: buildContactDetails({ id: 'contact-2', phone: '0799999999' }),
    })
    expect(result.current.formValues.phone).toBe('')
    expect(result.current.areContactDetailsDisabled).toBe(true)
    act(() => result.current.setFormValue('phone', '0611223344'))
    await act(() => result.current.save())
    expect(updateContactDetails).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('detaches a cleared contact by sending a null name', async () => {
    const { result, updateJobApplication } = renderContactController()
    act(() => result.current.setFormValue('contactName', ''))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { contactName: null })
  })

  it('goes back to reading without sending anything on cancel', () => {
    const { result, updateContactDetails, updateJobApplication, onClose } = renderContactController()
    act(() => result.current.setFormValue('email', 'paul@example.com'))
    act(() => result.current.cancel())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(updateContactDetails).not.toHaveBeenCalled()
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('closes without sending when nothing changed', async () => {
    const { result, updateContactDetails, onClose } = renderContactController()
    await act(() => result.current.save())
    expect(updateContactDetails).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refuses a malformed e-mail with E-mail invalide', async () => {
    const { result, updateContactDetails } = renderContactController()
    act(() => result.current.setFormValue('email', 'pas-un-email'))
    await act(() => result.current.save())
    expect(updateContactDetails).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('E-mail invalide')
  })

  it('only offers the name when the application has no contact', () => {
    const { result } = renderContactController({
      jobApplication: buildJobApplicationOverview({ contactId: null, contactName: null }),
      contactDetails: null,
    })
    expect(result.current.formValues).toEqual({ contactName: '', phone: '', email: '', linkedinUrl: '' })
    expect(result.current.areContactDetailsDisabled).toBe(true)
  })

  it('keeps the detail being edited across a refresh and adopts the untouched ones', async () => {
    const { result, rerender, updateContactDetails } = renderContactController()
    act(() => result.current.setFormValue('phone', '0699999999'))
    rerender({
      jobApplication: buildJobApplicationOverview(),
      contactDetails: buildContactDetails({ phone: '0700000000', email: 'jeanne.martin@example.com' }),
    })
    expect(result.current.formValues.phone).toBe('0699999999')
    expect(result.current.formValues.email).toBe('jeanne.martin@example.com')
    await act(() => result.current.save())
    expect(updateContactDetails).toHaveBeenCalledWith('contact-1', {
      fullName: 'Jeanne Martin',
      phone: '0699999999',
      email: 'jeanne.martin@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/jeanne',
    })
  })
})
