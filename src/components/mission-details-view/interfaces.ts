import type { JobApplicationOverview } from '@/domain/job-application'

export type MissionDetailsViewProps = {
  jobApplication: Pick<
    JobApplicationOverview,
    | 'postedDailyRate'
    | 'requestedDailyRate'
    | 'location'
    | 'remotePolicy'
    | 'desiredStart'
    | 'actualStartDate'
    | 'duration'
    | 'notes'
    | 'postingRawText'
  >
}
