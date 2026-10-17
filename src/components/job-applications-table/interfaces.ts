import type { JobApplicationListItem } from '@/domain/job-application'

export type JobApplicationsTableControllerParameters = {
  jobApplications: JobApplicationListItem[]
}

export type JobApplicationsTableProps = JobApplicationsTableControllerParameters & {
  now: Date
}
