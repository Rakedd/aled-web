import type { ActionResult } from '@/domain/action-result'
import type { ContactProfileInput } from '@/domain/contacts'
import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'

export type CreateContact = (input: ContactProfileInput) => Promise<ActionResult<{ id: string }>>

export type NewContactFormValues = {
  fullName: string
  intermediaryName: string
  phone: string
  email: string
  linkedinUrl: string
}

export type NewContactFormControllerParameters = {
  createContact: CreateContact
  navigateTo: (path: string) => void
}

export type NewContactFormProps = {
  createContact: CreateContact
  searchEntities: SearchEntities
}
