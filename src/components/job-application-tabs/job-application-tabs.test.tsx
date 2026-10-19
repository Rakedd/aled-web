import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { JobApplicationTab } from '@/domain/job-application-tabs'
import { JobApplicationTabs } from './job-application-tabs'

const PANELS: Record<JobApplicationTab, ReactNode> = {
  apercu: <input aria-label="Note d'aperçu" />,
  mission: <p>Contenu mission</p>,
  entretiens: <p>Contenu entretiens</p>,
  journal: <p>Contenu journal</p>,
}

const renderTabs = (initialTab: JobApplicationTab = 'apercu') =>
  render(<JobApplicationTabs initialTab={initialTab} interviewCount={2} activityLogEntryCount={5} panels={PANELS} />)

const getPanelOf = (tab: HTMLElement) => {
  const panelId = tab.getAttribute('aria-controls')
  const panel = panelId === null ? null : document.getElementById(panelId)
  if (panel === null) throw new Error('Panel not found')
  return panel
}

describe('JobApplicationTabs', () => {
  let replaceStateSpy: jest.SpyInstance

  beforeEach(() => {
    replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => undefined)
  })

  afterEach(() => {
    replaceStateSpy.mockRestore()
    window.history.pushState(null, '', '/')
  })

  it('names the four tabs with their counts', () => {
    renderTabs()

    expect(screen.getByRole('tablist', { name: 'Sections de la candidature' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Aperçu' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mission' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Entretiens · 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Journal · 5' })).toBeInTheDocument()
  })

  it('opens on the initial tab and hides the three other panels', () => {
    renderTabs('entretiens')

    const interviewsTab = screen.getByRole('tab', { name: 'Entretiens · 2' })
    expect(interviewsTab).toHaveAttribute('aria-selected', 'true')
    expect(getPanelOf(interviewsTab)).toBeVisible()
    expect(getPanelOf(interviewsTab)).not.toHaveAttribute('hidden')
    for (const otherTabName of ['Aperçu', 'Mission', 'Journal · 5']) {
      expect(getPanelOf(screen.getByRole('tab', { name: otherTabName }))).toHaveAttribute('hidden')
    }
  })

  it('selects Aperçu with ArrowRight from Journal and moves the focus', async () => {
    renderTabs('journal')
    screen.getByRole('tab', { name: 'Journal · 5' }).focus()

    await userEvent.keyboard('{ArrowRight}')

    const overviewTab = screen.getByRole('tab', { name: 'Aperçu' })
    expect(overviewTab).toHaveAttribute('aria-selected', 'true')
    expect(overviewTab).toHaveFocus()
    expect(getPanelOf(overviewTab)).toBeVisible()
  })

  it('reflects the selected tab in the URL and keeps the other url parts', async () => {
    window.history.pushState(null, '', '/?statut=ouvert&onglet=apercu#ancre')
    renderTabs()

    await userEvent.click(screen.getByRole('tab', { name: 'Mission' }))

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '?statut=ouvert&onglet=mission#ancre')
  })

  it('keeps a value typed in a panel across tab changes', async () => {
    renderTabs()

    await userEvent.type(screen.getByRole('textbox', { name: "Note d'aperçu" }), 'brouillon')
    await userEvent.click(screen.getByRole('tab', { name: 'Journal · 5' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Aperçu' }))

    expect(screen.getByRole('textbox', { name: "Note d'aperçu" })).toHaveValue('brouillon')
  })

  it('labels the visible panel with its tab', () => {
    renderTabs('mission')

    const missionTab = screen.getByRole('tab', { name: 'Mission' })
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', missionTab.id)
    expect(screen.getByRole('tabpanel')).toBe(getPanelOf(missionTab))
  })
})
