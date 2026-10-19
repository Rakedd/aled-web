import type { ReactNode } from 'react'
import type { JobApplicationListItem } from '@/domain/job-application'
import type { TodoAlert } from '@/domain/todo-alerts'

export type JobApplicationsTableControllerParameters = {
  jobApplications: JobApplicationListItem[]
  alerts: TodoAlert[]
}

export type JobApplicationsTableProps = JobApplicationsTableControllerParameters & {
  todoDetails: ReactNode
  now: Date
}
