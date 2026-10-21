import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { CONTACT_NAME_ALREADY_TAKEN_MESSAGE, ENTITY_VALIDATION_MESSAGES } from '@/domain/entities'
import { useController } from './controller'

const renderNewContactFormController = (
  creationResult: ActionResult<{ id: string }> = { ok: true, data: { id: 'contact-1' } },
) => {
  const createContact = jest.fn().mockResolvedValue(creationResult)
  const navigateTo = jest.fn()
  const { result } = renderHook(() => useController({ createContact, navigateTo }))
  return { result, createContact, navigateTo }
}

describe('new-contact-form useController', () => {
  it('requires a name', async () => {
    const { result, createContact } = renderNewContactFormController()
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe(ENTITY_VALIDATION_MESSAGES.missingContactName)
    expect(createContact).not.toHaveBeenCalled()
  })

  it('sends the filled fields with empty ones as null', async () => {
    const { result, createContact } = renderNewContactFormController()
    act(() => result.current.setFormValue('fullName', 'Jeanne Martin'))
    act(() => result.current.setFormValue('intermediaryName', 'Free-Work'))
    act(() => result.current.setFormValue('phone', '06 12 34 56 78'))
    await act(() => result.current.submit())
    expect(createContact).toHaveBeenCalledWith({
      fullName: 'Jeanne Martin',
      phone: '06 12 34 56 78',
      email: null,
      linkedinUrl: null,
      intermediaryName: 'Free-Work',
      referredBy: null,
      notes: null,
    })
  })

  it('navigates to the new contact page on success', async () => {
    const { result, navigateTo } = renderNewContactFormController()
    act(() => result.current.setFormValue('fullName', 'Jeanne Martin'))
    await act(() => result.current.submit())
    expect(navigateTo).toHaveBeenCalledWith('/contacts/contact-1')
  })

  it('shows the duplicate name message', async () => {
    const { result, navigateTo } = renderNewContactFormController({
      ok: false,
      errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE,
    })
    act(() => result.current.setFormValue('fullName', 'Jeanne Martin'))
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Un autre contact porte déjà ce nom')
    expect(result.current.isSubmitting).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('starts with the initial agency name when provided', () => {
    const { result } = renderHook(() =>
      useController({ createContact: jest.fn(), navigateTo: jest.fn(), initialIntermediaryName: 'Free-Work' }),
    )
    expect(result.current.formValues.intermediaryName).toBe('Free-Work')
  })
})
