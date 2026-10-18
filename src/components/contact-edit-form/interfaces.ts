import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { ContactDetails, ContactDetailsInput } from '@/domain/entities'
import type { JobApplicationOverview, UpdateJobApplication } from '@/domain/job-application'

export type UpdateContactDetails = (contactId: string, input: ContactDetailsInput) => Promise<ActionResult<null>>

export type ContactEditFormValues = {
  contactName: string
  phone: string
  email: string
  linkedinUrl: string
}

export type ContactEditFormValueName = keyof ContactEditFormValues

export type ContactEditFormControllerParameters = {
  jobApplication: JobApplicationOverview
  contactDetails: ContactDetails | null
  updateJobApplication: UpdateJobApplication
  updateContactDetails: UpdateContactDetails
  onDataChanged: () => void
  onClose: () => void
}

export type ContactEditFormProps = Omit<ContactEditFormControllerParameters, 'onDataChanged'> & {
  searchEntities: SearchEntities
}
