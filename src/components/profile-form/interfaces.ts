import type { ActionResult } from '@/domain/action-result'
import type { ProfileLink, ProfileSettings, ProfileSettingsInput } from '@/domain/profile-settings'

export type UpdateProfileSettings = (profileSettingsInput: ProfileSettingsInput) => Promise<ActionResult<ProfileSettings>>

export type ProfileFormStatus = 'idle' | 'saving'

export type EditableProfileLinkField = keyof ProfileLink

export type ProfileFormControllerParameters = {
  initialProfileSettings: ProfileSettings
  updateProfileSettings: UpdateProfileSettings
}

export type ProfileFormProps = ProfileFormControllerParameters
