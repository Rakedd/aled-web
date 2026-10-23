import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { ProfileSettings } from '@/domain/profile-settings'
import { useController } from './controller'

const initialProfileSettings: ProfileSettings = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  links: [],
  followUpDelayDays: 7,
  anthropicApiKeyLastFour: null,
  professionalStatus: null,
}

const renderProfileFormController = (
  updateProfileSettingsResult: ActionResult<ProfileSettings> = { ok: true, data: initialProfileSettings },
) => {
  const updateProfileSettings = jest.fn().mockResolvedValue(updateProfileSettingsResult)
  const { result } = renderHook(() => useController({ initialProfileSettings, updateProfileSettings }))
  return { result, updateProfileSettings }
}

describe('profile-form useController', () => {
  it('starts from the stored settings', () => {
    const { result } = renderProfileFormController()
    expect(result.current.firstName).toBe('Ada')
    expect(result.current.followUpDelayDaysText).toBe('7')
    expect(result.current.links).toEqual([])
  })

  it.each(['0', '61', '', '7.5'])('refuses the follow-up delay %p without calling the server', async (followUpDelayDaysText) => {
    const { result, updateProfileSettings } = renderProfileFormController()
    act(() => result.current.setFollowUpDelayDaysText(followUpDelayDaysText))
    await act(() => result.current.submit())
    expect(updateProfileSettings).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Entre 1 et 60 jours')
  })

  it('refuses a link that does not start with https://', async () => {
    const { result, updateProfileSettings } = renderProfileFormController()
    act(() => result.current.addLink())
    act(() => result.current.updateLink(0, 'label', 'Free-Work'))
    act(() => result.current.updateLink(0, 'url', 'http://www.free-work.com/fr/ada'))
    await act(() => result.current.submit())
    expect(updateProfileSettings).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Un lien doit commencer par https://')
  })

  it('sends the validated settings and shows the saved settings', async () => {
    const savedProfileSettings: ProfileSettings = {
      ...initialProfileSettings,
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
      followUpDelayDays: 10,
    }
    const { result, updateProfileSettings } = renderProfileFormController({ ok: true, data: savedProfileSettings })
    act(() => result.current.setFollowUpDelayDaysText('10'))
    act(() => result.current.addLink())
    act(() => result.current.updateLink(0, 'label', ' LinkedIn '))
    act(() => result.current.updateLink(0, 'url', 'https://www.linkedin.com/in/ada'))
    await act(() => result.current.submit())
    expect(updateProfileSettings).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
      followUpDelayDays: 10,
      professionalStatus: null,
    })
    expect(result.current.links).toEqual(savedProfileSettings.links)
    expect(result.current.successMessage).toBe('Préférences enregistrées')
    expect(result.current.errorMessage).toBeNull()
  })

  it('sends the professional status picked by the user', async () => {
    const { result, updateProfileSettings } = renderProfileFormController()
    expect(result.current.professionalStatus).toBeNull()
    act(() => result.current.setProfessionalStatus('employee'))
    await act(() => result.current.submit())
    expect(updateProfileSettings).toHaveBeenCalledWith(expect.objectContaining({ professionalStatus: 'employee' }))
  })

  it('removes a link', () => {
    const { result } = renderProfileFormController()
    act(() => result.current.addLink())
    act(() => result.current.addLink())
    act(() => result.current.updateLink(1, 'label', 'Second'))
    act(() => result.current.removeLink(0))
    expect(result.current.links).toEqual([{ label: 'Second', url: '' }])
  })

  it('leaves the saving state and shows the generic error when the action throws', async () => {
    const updateProfileSettings = jest.fn().mockRejectedValue(new Error('Network down'))
    const { result } = renderHook(() => useController({ initialProfileSettings, updateProfileSettings }))
    await act(() => result.current.submit())
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.successMessage).toBeNull()
  })

  it('relays the server error message', async () => {
    const { result } = renderProfileFormController({ ok: false, errorMessage: 'Service indisponible' })
    await act(() => result.current.submit())
    expect(result.current.errorMessage).toBe('Service indisponible')
    expect(result.current.successMessage).toBeNull()
  })
})
