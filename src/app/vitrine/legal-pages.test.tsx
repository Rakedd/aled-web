import { render, screen } from '@testing-library/react'
import PrivacyPolicyPage from './confidentialite/page'
import LegalNoticePage from './mentions-legales/page'

describe('legal pages', () => {
  it('shows the legal notice with its host', () => {
    render(<LegalNoticePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeInTheDocument()
    expect(screen.getByText(/Vercel Inc\./)).toBeInTheDocument()
  })

  it('shows the privacy policy', () => {
    render(<PrivacyPolicyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Confidentialité' })).toBeInTheDocument()
  })
})
