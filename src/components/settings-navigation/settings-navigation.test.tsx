import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SettingsNavigation } from './settings-navigation'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

describe('SettingsNavigation', () => {
  it('links the profile and the opportunities under /preferences', () => {
    jest.mocked(usePathname).mockReturnValue('/preferences')
    render(<SettingsNavigation />)

    expect(screen.getByRole('navigation', { name: 'Navigation des préférences' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/preferences')
    expect(screen.getByRole('link', { name: 'Opportunités' })).toHaveAttribute('href', '/preferences/opportunites')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the opportunities link active on its page', () => {
    jest.mocked(usePathname).mockReturnValue('/preferences/opportunites')
    render(<SettingsNavigation />)

    expect(screen.getByRole('link', { name: 'Opportunités' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current')
  })
})
