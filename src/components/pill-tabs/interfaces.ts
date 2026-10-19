export type PillTabItem<TabKey extends string> = {
  key: TabKey
  label: string
  count?: number
  tabId: string
  panelId: string
}

export type PillTabsProps<TabKey extends string> = {
  label: string
  tabs: PillTabItem<TabKey>[]
  selectedTab: TabKey
  onSelect: (tab: TabKey) => void
  isDisabled?: boolean
}
