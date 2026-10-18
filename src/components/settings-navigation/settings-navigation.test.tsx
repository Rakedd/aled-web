import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SettingsNavigation } from './settings-navigation'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

describe('SettingsNavigation', () => {
  it('links the profile and the Free-Work opportunities under /preferences', () => {
    jest.mocked(usePathname).mockReturnValue('/preferences')
    render(<SettingsNavigation />)

    expect(screen.getByRole('navigation', { name: 'Navigation des préférences' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/preferences')
    expect(screen.getByRole('link', { name: 'Opportunités · Free-Work' })).toHaveAttribute(
      'href',
      '/preferences/opportunites/free-work',
    )
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the Free-Work link active on its page', () => {
    jest.mocked(usePathname).mockReturnValue('/preferences/opportunites/free-work')
    render(<SettingsNavigation />)

    expect(screen.getByRole('link', { name: 'Opportunités · Free-Work' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current')
  })
})
