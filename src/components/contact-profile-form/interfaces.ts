import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { ContactProfile, ContactProfileInput } from '@/domain/contacts'

export type UpdateContactProfile = (contactId: string, input: ContactProfileInput) => Promise<ActionResult<null>>

export type ContactProfileFormValues = {
  fullName: string
  intermediaryName: string
  phone: string
  email: string
  linkedinUrl: string
  referredBy: string
  notes: string
}

export type ContactProfileFormControllerParameters = {
  profile: ContactProfile
  updateContactProfile: UpdateContactProfile
  onDataChanged: () => void
  onClose: () => void
}

export type ContactProfileFormProps = ContactProfileFormControllerParameters & {
  searchEntities: SearchEntities
}
