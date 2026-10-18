import type { JobApplicationOverview, UpdateJobApplication } from '@/domain/job-application'

export type MissionDetailsFormValues = {
  postedDailyRate: string
  requestedDailyRate: string
  location: string
  remotePolicy: string
  desiredStart: string
  actualStartDate: string
  duration: string
  notes: string
}

export type MissionDetailsFormValueName = keyof MissionDetailsFormValues

export type MissionDetailsFormControllerParameters = {
  jobApplication: JobApplicationOverview
  updateJobApplication: UpdateJobApplication
  onDataChanged: () => void
  onClose: () => void
}

export type MissionDetailsFormProps = Omit<MissionDetailsFormControllerParameters, 'onDataChanged'>
