import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProfileSettings } from '@/domain/profile-settings'
import { ProfileForm } from './profile-form'

const profileSettings: ProfileSettings = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  links: [],
  followUpDelayDays: 7,
  anthropicApiKeyLastFour: null,
  professionalStatus: 'freelance',
}

describe('ProfileForm professional status', () => {
  it('offers the two statuses and checks the stored one', () => {
    render(<ProfileForm initialProfileSettings={profileSettings} updateProfileSettings={jest.fn()} />)

    const statusGroup = screen.getByRole('radiogroup', { name: 'Je suis' })
    expect(statusGroup).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Freelance' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'CDI' })).not.toBeChecked()
  })

  it('gives each status choice a 44 px touch target', () => {
    render(<ProfileForm initialProfileSettings={profileSettings} updateProfileSettings={jest.fn()} />)

    for (const statusName of ['Freelance', 'CDI']) {
      expect(screen.getByRole('radio', { name: statusName }).closest('label')).toHaveClass('min-h-11')
    }
  })

  it('lets the touch targets overlap the gaps so the radios keep the spacing of the other fields', () => {
    render(<ProfileForm initialProfileSettings={profileSettings} updateProfileSettings={jest.fn()} />)

    const statusOptionsRow = screen.getByRole('radio', { name: 'Freelance' }).closest('label')?.parentElement
    expect(statusOptionsRow).toHaveClass('-my-2.5')
  })

  it('saves the status picked with the rest of the settings', async () => {
    const updateProfileSettings = jest.fn().mockResolvedValue({ ok: true, data: { ...profileSettings, professionalStatus: 'employee' } })
    render(<ProfileForm initialProfileSettings={profileSettings} updateProfileSettings={updateProfileSettings} />)

    await userEvent.click(screen.getByRole('radio', { name: 'CDI' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateProfileSettings).toHaveBeenCalledWith(expect.objectContaining({ professionalStatus: 'employee' }))
  })
})
