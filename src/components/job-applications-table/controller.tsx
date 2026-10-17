import { useState } from 'react'
import {
  filterAndSortJobApplications,
  type JobApplicationsSort,
  type JobApplicationsSortKey,
  type JobApplicationsTableFilters,
} from '@/domain/job-applications-filters'
import { isTerminalStatus, type JobApplicationStatus } from '@/domain/job-application-status'
import type { JobApplicationsTableControllerParameters } from './interfaces'

const INITIAL_FILTERS: JobApplicationsTableFilters = { searchText: '', statuses: [], sources: [], showTerminal: false }
const INITIAL_SORT: JobApplicationsSort = { key: 'lastActivityAt', direction: 'desc' }

const toggleValueInList = <Value,>(values: Value[], toggledValue: Value): Value[] =>
  values.includes(toggledValue) ? values.filter((value) => value !== toggledValue) : [...values, toggledValue]

export const useController = ({ jobApplications }: JobApplicationsTableControllerParameters) => {
  const [filters, setFilters] = useState<JobApplicationsTableFilters>(INITIAL_FILTERS)
  const [sort, setSort] = useState<JobApplicationsSort>(INITIAL_SORT)

  const availableSources = [
    ...new Set(jobApplications.flatMap(({ source }) => (source === null ? [] : [source]))),
  ].sort((firstSource, secondSource) => firstSource.localeCompare(secondSource, 'fr', { sensitivity: 'base' }))

  const visibleJobApplications = filterAndSortJobApplications(jobApplications, filters, sort)

  const setSearchText = (searchText: string) => setFilters((currentFilters) => ({ ...currentFilters, searchText }))

  const setShowTerminal = (showTerminal: boolean) =>
    setFilters((currentFilters) => ({
      ...currentFilters,
      showTerminal,
      statuses: showTerminal ? currentFilters.statuses : currentFilters.statuses.filter((status) => !isTerminalStatus(status)),
    }))

  const toggleStatus = (status: JobApplicationStatus) =>
    setFilters((currentFilters) => ({ ...currentFilters, statuses: toggleValueInList(currentFilters.statuses, status) }))

  const toggleSource = (source: string) =>
    setFilters((currentFilters) => ({ ...currentFilters, sources: toggleValueInList(currentFilters.sources, source) }))

  const toggleSort = (key: JobApplicationsSortKey) =>
    setSort((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc',
    }))

  return {
    filters,
    sort,
    availableSources,
    visibleJobApplications,
    setSearchText,
    setShowTerminal,
    toggleStatus,
    toggleSource,
    toggleSort,
  }
}
