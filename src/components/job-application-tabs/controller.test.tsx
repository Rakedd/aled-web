import { act, renderHook } from '@testing-library/react'
import type { JobApplicationTab } from '@/domain/job-application-tabs'
import { useController } from './controller'

const renderTabsController = (initialTab: JobApplicationTab) => {
  const onTabChanged = jest.fn()
  const { result, rerender } = renderHook(
    ({ initialTab: currentInitialTab }: { initialTab: JobApplicationTab }) =>
      useController({ initialTab: currentInitialTab, onTabChanged }),
    { initialProps: { initialTab } },
  )
  return { result, rerender, onTabChanged }
}

describe('JobApplicationTabs controller', () => {
  it('starts on the initial tab', () => {
    const { result } = renderTabsController('entretiens')

    expect(result.current.selectedTab).toBe('entretiens')
  })

  it('selects a tab and reports the change', () => {
    const { result, onTabChanged } = renderTabsController('apercu')

    act(() => result.current.selectTab('mission'))

    expect(result.current.selectedTab).toBe('mission')
    expect(onTabChanged).toHaveBeenCalledWith('mission')
  })

  it('keeps the selected tab when re-rendered with another initial tab', () => {
    const { result, rerender } = renderTabsController('entretiens')

    act(() => result.current.selectTab('journal'))
    rerender({ initialTab: 'apercu' })

    expect(result.current.selectedTab).toBe('journal')
  })
})
