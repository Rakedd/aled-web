import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { AppShell } from './app-shell'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

const mockedUsePathname = jest.mocked(usePathname)

const renderShell = (opportunitiesToProcessCount: number, pathname = '/opportunites') => {
  mockedUsePathname.mockReturnValue(pathname)
  return render(
    <AppShell userEmail="me@example.com" signOut={jest.fn()} opportunitiesToProcessCount={opportunitiesToProcessCount}>
      <p>contenu</p>
    </AppShell>,
  )
}

describe('AppShell', () => {
  it('lists the menu in order with the matching destinations', () => {
    renderShell(0)
    const menuLinks = screen.getByRole('navigation', { name: 'Navigation principale' }).querySelectorAll('a')
    expect(Array.from(menuLinks).map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Mes candidatures', '/candidatures'],
      ['Mon calendrier', '/calendar'],
      ['Mes opportunités', '/opportunites'],
      ['Préférences', '/preferences'],
    ])
  })

  it('points the logo to the home page', () => {
    renderShell(0)
    expect(screen.getByRole('link', { name: 'Aled' })).toHaveAttribute('href', '/')
  })

  it('shows the to-process count on Mes opportunités', () => {
    renderShell(3)
    expect(screen.getByRole('link', { name: /Mes opportunités.*3 à traiter/ })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the count in a peach pill while keeping the accessible name', () => {
    renderShell(3)
    expect(screen.getByText('3')).toHaveAttribute('data-tone', 'peach')
    expect(screen.getByRole('link', { name: /^Mes opportunités\s*, 3 à traiter$/ })).toBeInTheDocument()
  })

  it('offers the sign-out button', () => {
    renderShell(0)
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('hides the count when nothing is to process', () => {
    renderShell(0)
    expect(screen.getByRole('link', { name: 'Mes opportunités' })).toBeInTheDocument()
  })

  it('marks Mes candidatures active on an application page', () => {
    renderShell(0, '/candidatures/abc')
    expect(screen.getByRole('link', { name: 'Mes candidatures' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Préférences' })).not.toHaveAttribute('aria-current')
  })

  it('does not mark Mes candidatures active on a look-alike path', () => {
    renderShell(0, '/candidaturesx')
    expect(screen.getByRole('link', { name: 'Mes candidatures' })).not.toHaveAttribute('aria-current')
  })

  it('marks Préférences active on a preferences sub-page', () => {
    renderShell(0, '/preferences/opportunites/free-work')
    expect(screen.getByRole('link', { name: 'Préférences' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks nothing active on the home page', () => {
    renderShell(0, '/')
    expect(screen.getByRole('navigation', { name: 'Navigation principale' }).querySelector('[aria-current]')).toBeNull()
  })
})
