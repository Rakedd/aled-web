import { render, screen } from '@testing-library/react'
import { AppShell } from './app-shell'

jest.mock('next/navigation', () => ({ usePathname: () => '/opportunites' }))

const renderShell = (opportunitiesToProcessCount: number) =>
  render(
    <AppShell userEmail="me@example.com" signOut={jest.fn()} opportunitiesToProcessCount={opportunitiesToProcessCount}>
      <p>contenu</p>
    </AppShell>,
  )

describe('AppShell', () => {
  it('lists Opportunités between Candidatures and Calendrier with the to-process count', () => {
    renderShell(3)
    const labels = screen.getAllByRole('link').map((link) => link.textContent)
    expect(labels.indexOf('Candidatures')).toBeLessThan(labels.findIndex((label) => label?.startsWith('Opportunités')))
    expect(screen.getByRole('link', { name: /Opportunités.*3 à traiter/ })).toHaveAttribute('aria-current', 'page')
  })

  it('hides the count when nothing is to process', () => {
    renderShell(0)
    expect(screen.getByRole('link', { name: 'Opportunités' })).toBeInTheDocument()
  })
})
