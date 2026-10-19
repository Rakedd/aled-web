export type JobApplicationStatus =
  | 'applied'
  | 'intermediary_contact'
  | 'cv_submitted'
  | 'interview_scheduled'
  | 'interview_done'
  | 'contract_received'
  | 'signed'
  | 'ko_after_contact'
  | 'ko_cv'
  | 'ko_interview'
  | 'no_news_abandoned'

export const PIPELINE_STATUSES: readonly JobApplicationStatus[] = [
  'applied',
  'intermediary_contact',
  'cv_submitted',
  'interview_scheduled',
  'interview_done',
  'contract_received',
  'signed',
]

export const JOB_APPLICATION_STATUS_LABELS: Record<JobApplicationStatus, string> = {
  applied: 'Postulé',
  intermediary_contact: 'Échange intermédiaire',
  cv_submitted: 'CV positionné',
  interview_scheduled: 'Entretien planifié',
  interview_done: 'Entretien passé',
  contract_received: 'Contrat reçu',
  signed: 'Signé',
  ko_after_contact: 'KO après échange',
  ko_cv: 'KO CV',
  ko_interview: 'KO entretien',
  no_news_abandoned: 'Sans nouvelles / abandonnée',
}

const TERMINAL_STATUSES: readonly JobApplicationStatus[] = [
  'signed',
  'ko_after_contact',
  'ko_cv',
  'ko_interview',
  'no_news_abandoned',
]

export const ALL_JOB_APPLICATION_STATUSES: readonly JobApplicationStatus[] = [
  ...PIPELINE_STATUSES,
  ...TERMINAL_STATUSES.filter((terminalStatus) => !PIPELINE_STATUSES.includes(terminalStatus)),
]

const SUGGESTED_KO_STATUSES_BY_STATUS: Partial<Record<JobApplicationStatus, JobApplicationStatus[]>> = {
  applied: ['ko_after_contact', 'no_news_abandoned'],
  intermediary_contact: ['ko_after_contact', 'no_news_abandoned'],
  cv_submitted: ['ko_cv', 'no_news_abandoned'],
  interview_scheduled: ['ko_interview', 'no_news_abandoned'],
  interview_done: ['ko_interview', 'no_news_abandoned'],
  contract_received: ['no_news_abandoned'],
}

export const isJobApplicationStatus = (candidate: unknown): candidate is JobApplicationStatus =>
  typeof candidate === 'string' && Object.hasOwn(JOB_APPLICATION_STATUS_LABELS, candidate)

export const isTerminalStatus = (status: JobApplicationStatus): boolean =>
  TERMINAL_STATUSES.includes(status)

export const isActiveStatus = (status: JobApplicationStatus): boolean => !isTerminalStatus(status)

export const getNextPipelineStatus = (status: JobApplicationStatus): JobApplicationStatus | null => {
  const currentIndex = PIPELINE_STATUSES.indexOf(status)
  if (currentIndex === -1) return null
  return PIPELINE_STATUSES[currentIndex + 1] ?? null
}

export const getSuggestedKoStatuses = (status: JobApplicationStatus): JobApplicationStatus[] => [
  ...(SUGGESTED_KO_STATUSES_BY_STATUS[status] ?? []),
]

export const countActiveJobApplications = (jobApplications: { status: JobApplicationStatus }[]): number =>
  jobApplications.filter((jobApplication) => isActiveStatus(jobApplication.status)).length
