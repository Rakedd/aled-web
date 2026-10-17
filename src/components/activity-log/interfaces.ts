import type { ActionResult } from '@/domain/action-result'
import type { ActivityLogEntry, ActivityLogEntryInput } from '@/domain/activity-log'

export type AddActivityLogEntry = (
  jobApplicationId: string,
  input: ActivityLogEntryInput,
) => Promise<ActionResult<null>>

export type ListActivityLogEntries = (jobApplicationId: string) => Promise<ActionResult<ActivityLogEntry[]>>

export type ActivityLogControllerParameters = {
  jobApplicationId: string
  initialEntries: ActivityLogEntry[]
  addActivityLogEntry: AddActivityLogEntry
  listActivityLogEntries: ListActivityLogEntries
  onDataChanged: () => void
}

export type ActivityLogProps = Omit<ActivityLogControllerParameters, 'onDataChanged'>
