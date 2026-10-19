import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PillTabs } from './pill-tabs'

type TestTab = 'a' | 'b' | 'c'

const TABS = [
  { key: 'a' as const, label: 'A', tabId: 'tab-a', panelId: 'panel' },
  { key: 'b' as const, label: 'B', count: 2, tabId: 'tab-b', panelId: 'panel' },
  { key: 'c' as const, label: 'C', tabId: 'tab-c', panelId: 'panel' },
]

const TabsHarness = ({ initialTab, onSelect }: { initialTab: TestTab; onSelect: (tab: TestTab) => void }) => {
  const [selectedTab, setSelectedTab] = useState<TestTab>(initialTab)

  return (
    <PillTabs
      label="Test"
      tabs={TABS}
      selectedTab={selectedTab}
      onSelect={(tab) => {
        setSelectedTab(tab)
        onSelect(tab)
      }}
    />
  )
}

describe('PillTabs', () => {
  it('names a tab with its count and links it to its panel', () => {
    render(<TabsHarness initialTab="a" onSelect={jest.fn()} />)

    expect(screen.getByRole('tablist', { name: 'Test' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'B · 2' })).toHaveAttribute('aria-controls', 'panel')
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('id', 'tab-a')
  })

  it('exposes only the selected tab in the tab order', () => {
    render(<TabsHarness initialTab="b" onSelect={jest.fn()} />)

    expect(screen.getByRole('tab', { name: 'B · 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'B · 2' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '-1')
  })

  it('wraps from the last tab to the first with ArrowRight and moves the focus', async () => {
    const onSelect = jest.fn()
    render(<TabsHarness initialTab="c" onSelect={onSelect} />)
    screen.getByRole('tab', { name: 'C' }).focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(onSelect).toHaveBeenCalledWith('a')
    expect(screen.getByRole('tab', { name: 'A' })).toHaveFocus()
  })

  it('wraps from the first tab to the last with ArrowLeft', async () => {
    const onSelect = jest.fn()
    render(<TabsHarness initialTab="a" onSelect={onSelect} />)
    screen.getByRole('tab', { name: 'A' }).focus()

    await userEvent.keyboard('{ArrowLeft}')

    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('selects the last tab with End and the first with Home', async () => {
    const onSelect = jest.fn()
    render(<TabsHarness initialTab="b" onSelect={onSelect} />)
    screen.getByRole('tab', { name: 'B · 2' }).focus()

    await userEvent.keyboard('{End}')
    expect(onSelect).toHaveBeenLastCalledWith('c')
    expect(screen.getByRole('tab', { name: 'C' })).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(onSelect).toHaveBeenLastCalledWith('a')
  })

  it('selects a tab on click', async () => {
    const onSelect = jest.fn()
    render(<TabsHarness initialTab="a" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('tab', { name: 'B · 2' }))

    expect(onSelect).toHaveBeenCalledWith('b')
  })
})
