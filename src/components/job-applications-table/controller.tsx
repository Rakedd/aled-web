import { useState } from 'react'
import {
  filterAndSortJobApplications,
  type JobApplicationsSort,
  type JobApplicationsSortKey,
  type JobApplicationsTableFilters,
} from '@/domain/job-applications-filters'
import { isTerminalStatus, type JobApplicationStatus } from '@/domain/job-application-status'
import { countTodoAlertsByKind } from '@/domain/todo-alerts'
import type { AlertKind } from '@/domain/types'
import type { JobApplicationsTableControllerParameters } from './interfaces'

const INITIAL_FILTERS: JobApplicationsTableFilters = { searchText: '', statuses: [], sources: [], showTerminal: false, alertKind: null }
const INITIAL_SORT: JobApplicationsSort = { key: 'lastActivityAt', direction: 'desc' }

const toggleValueInList = <Value,>(values: Value[], toggledValue: Value): Value[] =>
  values.includes(toggledValue) ? values.filter((value) => value !== toggledValue) : [...values, toggledValue]

export const useController = ({ jobApplications, alerts }: JobApplicationsTableControllerParameters) => {
  const [filters, setFilters] = useState<JobApplicationsTableFilters>(INITIAL_FILTERS)
  const [sort, setSort] = useState<JobApplicationsSort>(INITIAL_SORT)
  const [isTodoListExpanded, setIsTodoListExpanded] = useState(false)

  const availableSources = [
    ...new Set(jobApplications.flatMap(({ source }) => (source === null ? [] : [source]))),
  ].sort((firstSource, secondSource) => firstSource.localeCompare(secondSource, 'fr', { sensitivity: 'base' }))

  const kindCounts = countTodoAlertsByKind(alerts)
  const selectedAlertKind = kindCounts.some(({ kind }) => kind === filters.alertKind) ? filters.alertKind : null

  const visibleJobApplications = filterAndSortJobApplications(
    jobApplications,
    { ...filters, alertKind: selectedAlertKind },
    sort,
    alerts,
  )

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

  const toggleAlertKind = (kind: AlertKind) =>
    setFilters((currentFilters) => ({ ...currentFilters, alertKind: selectedAlertKind === kind ? null : kind }))

  const toggleTodoListExpanded = () => setIsTodoListExpanded((currentIsExpanded) => !currentIsExpanded)

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
    kindCounts,
    selectedAlertKind,
    isTodoListExpanded,
    toggleAlertKind,
    toggleTodoListExpanded,
    setSearchText,
    setShowTerminal,
    toggleStatus,
    toggleSource,
    toggleSort,
  }
}
