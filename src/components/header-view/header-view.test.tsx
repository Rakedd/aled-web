import { render, screen } from '@testing-library/react'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { HeaderView } from './header-view'

const HAYS_APPLICATION = buildJobApplicationOverview({
  title: 'Développeur React / Next.js senior',
  endClientLabel: 'BNP Paribas AM',
  intermediaryName: 'Hays',
  intermediaryKind: 'esn',
  source: 'Free-Work',
  appliedOn: new Date('2026-10-06T08:00:00Z'),
  postingUrl: 'https://www.free-work.com/fr/job/123',
})

const renderHeaderView = (jobApplication: JobApplicationOverview = HAYS_APPLICATION) =>
  render(<HeaderView jobApplication={jobApplication} />)

const getSummaryLine = (expectedText: string) =>
  screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === expectedText)

describe('HeaderView', () => {
  it('shows the application title as the page heading', () => {
    renderHeaderView()
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React / Next.js senior' })).toBeInTheDocument()
  })

  it('shows the end client, intermediary, source, Paris date and posting link on one line', () => {
    renderHeaderView()
    expect(getSummaryLine("BNP Paribas AM · via Hays (ESN) · Free-Work · 06/10/2026 · Voir l'annonce")).toBeInTheDocument()
  })

  it('omits the missing parts and shows Client inconnu without an end client', () => {
    renderHeaderView({ ...HAYS_APPLICATION, endClientLabel: null, source: null, postingUrl: null })
    expect(getSummaryLine('Client inconnu · via Hays (ESN) · 06/10/2026')).toBeInTheDocument()
  })

  it('omits the intermediary when there is none', () => {
    renderHeaderView({ ...HAYS_APPLICATION, intermediaryName: null, intermediaryKind: null, source: '  ', postingUrl: null })
    expect(getSummaryLine('BNP Paribas AM · 06/10/2026')).toBeInTheDocument()
  })

  it('opens the posting in a new tab without giving it access to the page', () => {
    renderHeaderView()
    const postingLink = screen.getByRole('link', { name: "Voir l'annonce" })
    expect(postingLink).toHaveAttribute('href', 'https://www.free-work.com/fr/job/123')
    expect(postingLink).toHaveAttribute('target', '_blank')
    expect(postingLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each(['javascript:alert(1)', 'pas une adresse'])('shows no posting link for %s', (postingUrl) => {
    renderHeaderView({ ...HAYS_APPLICATION, postingUrl })
    expect(screen.queryByRole('link', { name: "Voir l'annonce" })).not.toBeInTheDocument()
  })
})
