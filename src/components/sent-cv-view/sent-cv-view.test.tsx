import { render, screen } from '@testing-library/react'
import { SentCvView } from './sent-cv-view'

describe('SentCvView', () => {
  it('shows the label, the version date and a Voir link in a new tab', () => {
    render(<SentCvView sentCv={{ versionId: 'version-1', label: 'CV DevOps', uploadedAt: new Date('2026-03-12T10:00:00Z') }} />)
    expect(screen.getByText('CV DevOps · version du 12/03/2026')).toBeInTheDocument()
    const openLink = screen.getByRole('link', { name: 'Voir' })
    expect(openLink).toHaveAttribute('href', '/api/cvs/versions/version-1/pdf')
    expect(openLink).toHaveAttribute('target', '_blank')
    expect(openLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says Aucun CV indiqué without sent cv', () => {
    render(<SentCvView sentCv={null} />)
    expect(screen.getByText('Aucun CV indiqué')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
