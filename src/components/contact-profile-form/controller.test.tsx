import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { ContactProfile } from '@/domain/contacts'
import { CONTACT_NAME_ALREADY_TAKEN_MESSAGE } from '@/domain/entities'
import { useController } from './controller'

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const PROFILE: ContactProfile = {
  id: 'contact-1',
  fullName: 'Jeanne Martin',
  phone: '0102030405',
  email: 'jeanne@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/jeanne',
  intermediaryId: 'intermediary-1',
  intermediaryName: 'Free-Work',
  referredBy: 'Paul Durand',
  notes: 'Rappeler en janvier',
}

const renderProfileController = (updateResult: ActionResult<null> = SUCCESS) => {
  const updateContactProfile = jest.fn().mockResolvedValue(updateResult)
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(() => useController({ profile: PROFILE, updateContactProfile, onDataChanged, onClose }))
  return { ...renderedHook, updateContactProfile, onDataChanged, onClose }
}

describe('contact-profile-form useController', () => {
  it('saves all profile fields', async () => {
    const { result, updateContactProfile, onDataChanged, onClose } = renderProfileController()
    act(() => result.current.setFormValue('fullName', 'Jeanne Martin-Durand'))
    act(() => result.current.setFormValue('intermediaryName', 'Malt'))
    act(() => result.current.setFormValue('phone', '0611223344'))
    act(() => result.current.setFormValue('email', 'jeanne@malt.com'))
    act(() => result.current.setFormValue('linkedinUrl', 'https://www.linkedin.com/in/jeanne-md'))
    act(() => result.current.setFormValue('referredBy', 'Marc Petit'))
    act(() => result.current.setFormValue('notes', 'Préfère les appels le matin'))
    await act(() => result.current.save())
    expect(updateContactProfile).toHaveBeenCalledWith('contact-1', {
      fullName: 'Jeanne Martin-Durand',
      intermediaryName: 'Malt',
      phone: '0611223344',
      email: 'jeanne@malt.com',
      linkedinUrl: 'https://www.linkedin.com/in/jeanne-md',
      referredBy: 'Marc Petit',
      notes: 'Préfère les appels le matin',
    })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears a field emptied by the user', async () => {
    const { result, updateContactProfile } = renderProfileController()
    act(() => result.current.setFormValue('phone', ''))
    act(() => result.current.setFormValue('notes', '  '))
    await act(() => result.current.save())
    expect(updateContactProfile).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({ phone: null, notes: null, email: 'jeanne@example.com' }),
    )
  })

  it('shows the duplicate name message', async () => {
    const { result, onClose } = renderProfileController({ ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE })
    act(() => result.current.setFormValue('fullName', 'Paul Durand'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Un autre contact porte déjà ce nom')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes without calling the server when nothing changed', async () => {
    const { result, updateContactProfile, onClose } = renderProfileController()
    await act(() => result.current.save())
    expect(updateContactProfile).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refuses an empty name', async () => {
    const { result, updateContactProfile } = renderProfileController()
    act(() => result.current.setFormValue('fullName', ''))
    await act(() => result.current.save())
    expect(updateContactProfile).not.toHaveBeenCalled()
    expect(result.current.errorMessage).not.toBeNull()
  })
})
