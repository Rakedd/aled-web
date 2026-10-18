import { useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { type ProfileLink, type ProfileSettings, validateProfileSettingsInput } from '@/domain/profile-settings'
import type { EditableProfileLinkField, ProfileFormControllerParameters, ProfileFormStatus } from './interfaces'

const PROFILE_SETTINGS_SAVED_MESSAGE = 'Préférences enregistrées'
const EMPTY_PROFILE_LINK: ProfileLink = { label: '', url: '' }

export const useController = ({ initialProfileSettings, updateProfileSettings }: ProfileFormControllerParameters) => {
  const [firstName, setFirstName] = useState(initialProfileSettings.firstName)
  const [lastName, setLastName] = useState(initialProfileSettings.lastName)
  const [followUpDelayDaysText, setFollowUpDelayDaysText] = useState(String(initialProfileSettings.followUpDelayDays))
  const [links, setLinks] = useState<ProfileLink[]>(initialProfileSettings.links)
  const [status, setStatus] = useState<ProfileFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const addLink = () => setLinks((currentLinks) => [...currentLinks, EMPTY_PROFILE_LINK])

  const updateLink = (linkIndex: number, changedField: EditableProfileLinkField, changedValue: string) =>
    setLinks((currentLinks) =>
      currentLinks.map((currentLink, currentLinkIndex) =>
        currentLinkIndex === linkIndex ? { ...currentLink, [changedField]: changedValue } : currentLink,
      ),
    )

  const removeLink = (linkIndex: number) =>
    setLinks((currentLinks) => currentLinks.filter((_, currentLinkIndex) => currentLinkIndex !== linkIndex))

  const applySavedProfileSettings = (savedProfileSettings: ProfileSettings) => {
    setFirstName(savedProfileSettings.firstName)
    setLastName(savedProfileSettings.lastName)
    setFollowUpDelayDaysText(String(savedProfileSettings.followUpDelayDays))
    setLinks(savedProfileSettings.links)
  }

  const submit = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    const validationResult = validateProfileSettingsInput({
      firstName,
      lastName,
      links,
      followUpDelayDays: Number(followUpDelayDaysText),
    })
    if (!validationResult.ok) {
      setErrorMessage(validationResult.errorMessage)
      return
    }
    setStatus('saving')
    try {
      const updateResult = await updateProfileSettings(validationResult.data)
      if (!updateResult.ok) {
        setErrorMessage(updateResult.errorMessage)
        return
      }
      applySavedProfileSettings(updateResult.data)
      setSuccessMessage(PROFILE_SETTINGS_SAVED_MESSAGE)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setStatus('idle')
    }
  }

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email: initialProfileSettings.email,
    followUpDelayDaysText,
    setFollowUpDelayDaysText,
    links,
    addLink,
    updateLink,
    removeLink,
    status,
    errorMessage,
    successMessage,
    submit,
  }
}
