import type { ContactDetails } from '@/domain/entities'

export type ContactViewProps = {
  contactName: string | null
  contactDetails: ContactDetails | null
  loadErrorMessage: string | null
}
