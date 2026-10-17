import type { ActionResult } from '@/domain/action-result'
import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'
import type { ContactDetails, ContactDetailsInput } from '@/domain/entities'
import type { JobApplicationInput, JobApplicationOverview } from '@/domain/job-application'
import type { StackItem } from '@/domain/types'

export type UpdateJobApplication = (
  jobApplicationId: string,
  input: Partial<JobApplicationInput>,
) => Promise<ActionResult<null>>

export type SetEndClientParent = (endClientId: string, parentEndClientId: string | null) => Promise<ActionResult<null>>

export type GetContactDetails = (contactId: string) => Promise<ActionResult<ContactDetails>>

export type UpdateContactDetails = (contactId: string, input: ContactDetailsInput) => Promise<ActionResult<null>>

export type MissionInfoFormValues = {
  title: string
  source: string
  postingUrl: string
  postedDailyRate: string
  requestedDailyRate: string
  location: string
  remotePolicy: string
  desiredStart: string
  duration: string
  appliedOn: string
  actualStartDate: string
  notes: string
  intermediaryName: string
  contactName: string
  endClientName: string
  endClientParentName: string
  stack: StackItem[]
}

export type MissionInfoTextValueName = Exclude<keyof MissionInfoFormValues, 'stack'>

export type ContactFormValues = {
  phone: string
  email: string
  linkedinUrl: string
}

export type ContactFormValueName = keyof ContactFormValues

export type MissionInfoFormControllerParameters = {
  jobApplication: JobApplicationOverview
  updateJobApplication: UpdateJobApplication
  setEndClientParent: SetEndClientParent
  getContactDetails: GetContactDetails
  updateContactDetails: UpdateContactDetails
  onDataChanged: () => void
}

export type MissionInfoFormProps = Omit<MissionInfoFormControllerParameters, 'onDataChanged'> & {
  searchEntities: SearchEntities
}
