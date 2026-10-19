import { useState } from 'react'
import type { JobApplicationTab } from '@/domain/job-application-tabs'
import type { JobApplicationTabsControllerParameters } from './interfaces'

export const useController = ({ initialTab, onTabChanged }: JobApplicationTabsControllerParameters) => {
  const [selectedTab, setSelectedTab] = useState<JobApplicationTab>(initialTab)

  const selectTab = (tab: JobApplicationTab) => {
    setSelectedTab(tab)
    onTabChanged(tab)
  }

  return { selectedTab, selectTab }
}
