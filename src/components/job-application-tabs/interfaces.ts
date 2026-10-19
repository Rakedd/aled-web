import type { ReactNode } from 'react'
import type { JobApplicationTab } from '@/domain/job-application-tabs'

export type JobApplicationTabsProps = {
  initialTab: JobApplicationTab
  interviewCount: number
  activityLogEntryCount: number
  panels: Record<JobApplicationTab, ReactNode>
}

export type JobApplicationTabsControllerParameters = {
  initialTab: JobApplicationTab
  onTabChanged: (tab: JobApplicationTab) => void
}
