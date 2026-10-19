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

  const getTargetIndex = (key: string, currentIndex: number) => {
    const lastIndex = tabs.length - 1
    switch (key) {
      case 'ArrowRight':
        return currentIndex === lastIndex ? 0 : currentIndex + 1
      case 'ArrowLeft':
        return currentIndex === 0 ? lastIndex : currentIndex - 1
      case 'Home':
        return 0
      case 'End':
        return lastIndex
      default:
        return null
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const targetIndex = getTargetIndex(event.key, currentIndex)
    if (targetIndex === null) return
    event.preventDefault()
    if (isDisabled) return
    moveToTab(targetIndex)
  }

  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-card p-1">
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
            aria-disabled={isDisabled || undefined}
            onClick={() => !isDisabled && onSelect(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-reduce:transition-none',
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
