'use client'

import { PillTabs } from '@/components/pill-tabs'
import {
  JOB_APPLICATION_TAB_LABELS,
  JOB_APPLICATION_TAB_SEARCH_PARAMETER,
  JOB_APPLICATION_TABS,
  type JobApplicationTab,
} from '@/domain/job-application-tabs'
import { useController } from './controller'
import type { JobApplicationTabsProps } from './interfaces'

const buildTabId = (tab: JobApplicationTab) => `job-application-tab-${tab}`

const buildPanelId = (tab: JobApplicationTab) => `job-application-panel-${tab}`

const reflectTabInUrl = (tab: JobApplicationTab) => {
  const searchParameters = new URLSearchParams(window.location.search)
  searchParameters.set(JOB_APPLICATION_TAB_SEARCH_PARAMETER, tab)
  window.history.replaceState(null, '', `?${searchParameters.toString()}${window.location.hash}`)
}

export const JobApplicationTabs = ({ initialTab, interviewCount, activityLogEntryCount, panels }: JobApplicationTabsProps) => {
  const { selectedTab, selectTab } = useController({ initialTab, onTabChanged: reflectTabInUrl })

  const tabCounts: Record<JobApplicationTab, number | undefined> = {
    apercu: undefined,
    mission: undefined,
    entretiens: interviewCount,
    journal: activityLogEntryCount,
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PillTabs
        label="Sections de la candidature"
        tabs={JOB_APPLICATION_TABS.map((tab) => ({
          key: tab,
          label: JOB_APPLICATION_TAB_LABELS[tab],
          count: tabCounts[tab],
          tabId: buildTabId(tab),
          panelId: buildPanelId(tab),
        }))}
        selectedTab={selectedTab}
        onSelect={selectTab}
      />
      {JOB_APPLICATION_TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={buildPanelId(tab)}
          aria-labelledby={buildTabId(tab)}
          hidden={tab !== selectedTab}
          className="min-w-0"
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  )
}
