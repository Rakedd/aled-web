import { JOB_APPLICATION_STATUS_LABELS, isTerminalStatus, type JobApplicationStatus } from './job-application-status'
import type { JobApplicationListItem } from './job-application'
import { normalizeEntityName } from './entity-names'

export type JobApplicationsTableFilters = {
  searchText: string
  statuses: JobApplicationStatus[]
  sources: string[]
  showTerminal: boolean
}

export type JobApplicationsSortKey =
  | 'title'
  | 'intermediaryName'
  | 'contactName'
  | 'endClientLabel'
  | 'source'
  | 'status'
  | 'appliedOn'
  | 'lastActivityAt'

export type JobApplicationsSort = {
  key: JobApplicationsSortKey
  direction: 'asc' | 'desc'
}

type SortableValue = string | number | null

const STATUS_DISPLAY_ORDER = Object.keys(JOB_APPLICATION_STATUS_LABELS)

const getSearchableTexts = (jobApplication: JobApplicationListItem): (string | null)[] => [
  jobApplication.title,
  jobApplication.source,
  jobApplication.intermediaryName,
  jobApplication.contactName,
  jobApplication.endClientName,
  jobApplication.endClientParentName,
  jobApplication.endClientLabel,
]

const matchesSearchText = (jobApplication: JobApplicationListItem, searchText: string): boolean => {
  const normalizedSearchText = normalizeEntityName(searchText)
  if (normalizedSearchText === '') return true
  return getSearchableTexts(jobApplication).some(
    (searchableText) => searchableText !== null && normalizeEntityName(searchableText).includes(normalizedSearchText),
  )
}

const matchesFilters = (jobApplication: JobApplicationListItem, filters: JobApplicationsTableFilters): boolean => {
  if (!filters.showTerminal && isTerminalStatus(jobApplication.status)) return false
  if (filters.statuses.length > 0 && !filters.statuses.includes(jobApplication.status)) return false
  if (filters.sources.length > 0 && (jobApplication.source === null || !filters.sources.includes(jobApplication.source))) {
    return false
  }
  return matchesSearchText(jobApplication, filters.searchText)
}

const getSortableValue = (jobApplication: JobApplicationListItem, sortKey: JobApplicationsSortKey): SortableValue => {
  switch (sortKey) {
    case 'appliedOn':
      return jobApplication.appliedOn.getTime()
    case 'lastActivityAt':
      return jobApplication.lastActivityAt?.getTime() ?? null
    case 'status':
      return STATUS_DISPLAY_ORDER.indexOf(jobApplication.status)
    default:
      return jobApplication[sortKey]
  }
}

const compareNonNullValues = (firstValue: string | number, secondValue: string | number): number =>
  typeof firstValue === 'number' && typeof secondValue === 'number'
    ? firstValue - secondValue
    : String(firstValue).localeCompare(String(secondValue), 'fr', { sensitivity: 'base' })

const compareJobApplications = (
  firstJobApplication: JobApplicationListItem,
  secondJobApplication: JobApplicationListItem,
  sort: JobApplicationsSort,
): number => {
  const firstValue = getSortableValue(firstJobApplication, sort.key)
  const secondValue = getSortableValue(secondJobApplication, sort.key)
  if (firstValue === null && secondValue === null) return 0
  if (firstValue === null) return 1
  if (secondValue === null) return -1
  const ascendingComparison = compareNonNullValues(firstValue, secondValue)
  return sort.direction === 'asc' ? ascendingComparison : -ascendingComparison
}

export const filterAndSortJobApplications = <JobApplication extends JobApplicationListItem>(
  jobApplications: JobApplication[],
  filters: JobApplicationsTableFilters,
  sort: JobApplicationsSort,
): JobApplication[] =>
  jobApplications
    .filter((jobApplication) => matchesFilters(jobApplication, filters))
    .sort((firstJobApplication, secondJobApplication) =>
      compareJobApplications(firstJobApplication, secondJobApplication, sort),
    )
