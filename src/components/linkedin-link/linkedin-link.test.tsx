import { render, screen } from '@testing-library/react'
import { LinkedinLink } from './linkedin-link'

const LINKEDIN_URL = 'https://www.linkedin.com/in/jeanne'

describe('LinkedinLink', () => {
  it('links to the profile in a new tab with the logo and the word LinkedIn', () => {
    render(<LinkedinLink url={LINKEDIN_URL} />)
    const link = screen.getByRole('link', { name: 'LinkedIn' })
    expect(link).toHaveAttribute('href', LINKEDIN_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveClass('text-linkedin')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows only the logo, named by the label, when compact', () => {
    render(<LinkedinLink url={LINKEDIN_URL} label="Profil LinkedIn de Jeanne Martin" isCompact />)
    const link = screen.getByRole('link', { name: 'Profil LinkedIn de Jeanne Martin' })
    expect(link).toHaveAttribute('href', LINKEDIN_URL)
    expect(link).not.toHaveTextContent('LinkedIn')
    expect(link.querySelector('svg')).toBeInTheDocument()
  })

  it.each(['javascript:alert(1)', 'www.linkedin.com/in/jeanne', 'ftp://linkedin.com/in/jeanne'])(
    'renders nothing for the refused url %s',
    (refusedUrl) => {
      const { container } = render(<LinkedinLink url={refusedUrl} />)
      expect(container).toBeEmptyDOMElement()
    },
  )
})
