import { render, screen } from '@testing-library/react'
import { DUPLICATE_POSITIONING_MESSAGES, type PositionedJobApplication } from '@/domain/duplicate-positioning'
import { DuplicatePositioningWarning } from './duplicate-positioning-warning'

const RISK: PositionedJobApplication = {
  id: 'application-2',
  title: 'Développeur React',
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-13T08:00:00Z'),
}

describe('DuplicatePositioningWarning', () => {
  it('keeps an empty status region mounted without risk', () => {
    render(<DuplicatePositioningWarning risks={[]} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows the warning, the detail and a link to each risky application', () => {
    render(<DuplicatePositioningWarning risks={[RISK]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(DUPLICATE_POSITIONING_MESSAGES.warning).tagName).toBe('STRONG')
    expect(screen.getByText(/déjà reçu ton CV/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Développeur React · Autre ESN · 13/10/2026' })).toHaveAttribute(
      'href',
      '/candidatures/application-2',
    )
  })
})
