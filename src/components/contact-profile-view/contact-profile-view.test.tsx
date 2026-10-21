import { render, screen } from '@testing-library/react'
import type { ContactProfile } from '@/domain/contacts'
import { ContactProfileView } from './contact-profile-view'

const FULL_PROFILE: ContactProfile = {
  id: 'contact-1',
  fullName: 'Jeanne Martin',
  phone: '01 02 03 04 05',
  email: 'jeanne@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/jeanne',
  intermediaryId: 'intermediary-1',
  intermediaryName: 'Free-Work',
  referredBy: null,
  notes: null,
}

describe('ContactProfileView', () => {
  it('shows call, email and LinkedIn actions only when the information exists', () => {
    const { rerender } = render(<ContactProfileView profile={FULL_PROFILE} />)
    expect(screen.getByRole('link', { name: 'Appeler' })).toHaveAttribute('href', 'tel:0102030405')
    expect(screen.getByRole('link', { name: 'E-mail' })).toHaveAttribute('href', 'mailto:jeanne@example.com')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/jeanne')

    rerender(<ContactProfileView profile={{ ...FULL_PROFILE, phone: null, email: null, linkedinUrl: null }} />)
    expect(screen.queryByRole('link', { name: 'Appeler' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'E-mail' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument()
  })

  it('links the agency to its page', () => {
    render(<ContactProfileView profile={FULL_PROFILE} />)
    expect(screen.getByRole('link', { name: 'Free-Work' })).toHaveAttribute('href', '/agences/intermediary-1')
  })
})
