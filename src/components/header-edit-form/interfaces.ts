import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'
import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview, UpdateJobApplication } from '@/domain/job-application'
import type { IntermediaryKind } from '@/domain/types'

export type SetEndClientParent = (endClientId: string, parentEndClientId: string | null) => Promise<ActionResult<null>>

export type UpdateIntermediaryKind = (intermediaryId: string, kind: IntermediaryKind) => Promise<ActionResult<null>>

export type HeaderEditFormValues = {
  title: string
  source: string
  postingUrl: string
  intermediaryName: string
  intermediaryKind: string
  endClientName: string
  endClientParentName: string
  appliedOn: string
}

export type HeaderEditFormValueName = keyof HeaderEditFormValues

export type HeaderEditFormControllerParameters = {
  jobApplication: JobApplicationOverview
  updateJobApplication: UpdateJobApplication
  setEndClientParent: SetEndClientParent
  updateIntermediaryKind: UpdateIntermediaryKind
  onDataChanged: () => void
  onClose: () => void
}

export type HeaderEditFormProps = Omit<HeaderEditFormControllerParameters, 'onDataChanged'> & {
  searchEntities: SearchEntities
}
