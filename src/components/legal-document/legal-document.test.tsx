import { render, screen } from '@testing-library/react'
import { LegalDocument } from './legal-document'

const DOCUMENT = {
  title: 'Mentions légales',
  sections: [
    { heading: 'Éditeur', paragraphs: ['Aled'] },
    { heading: 'Hébergeur', paragraphs: ['Vercel Inc.', 'vercel.com'] },
  ],
}

describe('LegalDocument', () => {
  it('titles the page and each section', () => {
    render(<LegalDocument document={DOCUMENT} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
  })

  it('shows every paragraph of a section', () => {
    render(<LegalDocument document={DOCUMENT} />)

    expect(screen.getByText('vercel.com')).toBeInTheDocument()
  })
})
