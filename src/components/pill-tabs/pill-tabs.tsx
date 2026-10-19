import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { PillTabsProps } from './interfaces'

export const PillTabs = <TabKey extends string>({ label, tabs, selectedTab, onSelect, isDisabled = false }: PillTabsProps<TabKey>) => {
  const tabElements = useRef<(HTMLButtonElement | null)[]>([])

  const moveToTab = (targetIndex: number) => {
    tabElements.current[targetIndex]?.focus()
    onSelect(tabs[targetIndex].key)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = tabs.length - 1
    const targetIndexByKey: Record<string, number> = {
      ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
      ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
      Home: 0,
      End: lastIndex,
    }
    const targetIndex = targetIndexByKey[event.key]
    if (targetIndex === undefined) return
    event.preventDefault()
    moveToTab(targetIndex)
  }

  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-background p-1">
      {tabs.map((tab, index) => {
        const isSelected = tab.key === selectedTab
        return (
          <button
            key={tab.key}
            ref={(element) => {
              tabElements.current[index] = element
            }}
            type="button"
            role="tab"
            id={tab.tabId}
            aria-selected={isSelected}
            aria-controls={tab.panelId}
            tabIndex={isSelected ? 0 : -1}
            disabled={isDisabled}
            onClick={() => onSelect(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 motion-reduce:transition-none',
              isSelected ? 'bg-forest text-primary-foreground' : 'text-ink hover:bg-hairline',
            )}
          >
            {tab.count === undefined ? tab.label : `${tab.label} · ${tab.count}`}
          </button>
        )
      })}
    </div>
  )
}
