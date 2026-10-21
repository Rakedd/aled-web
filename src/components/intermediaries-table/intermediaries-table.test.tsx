import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IntermediaryListItem } from '@/domain/contacts'
import { IntermediariesTable } from './intermediaries-table'

const buildIntermediary = (overrides: Partial<IntermediaryListItem>): IntermediaryListItem => ({
  id: 'agency-1',
  name: 'Free-Work',
  kind: null,
  contactCount: 0,
  proposedMissionCount: 0,
  lastExchangeAt: null,
  ...overrides,
})

describe('IntermediariesTable', () => {
  it('shows dashes and zeros for an agency without kind, exchange nor mission', () => {
    render(<IntermediariesTable intermediaries={[buildIntermediary({})]} />)
    const cells = within(screen.getByRole('row', { name: /Free-Work/ })).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual(['Free-Work', '—', '0', '0', '—'])
  })

  it('links the name to the agency page and shows the kind label and the date', () => {
    render(
      <IntermediariesTable
        intermediaries={[
          buildIntermediary({ kind: 'esn', contactCount: 3, proposedMissionCount: 2, lastExchangeAt: new Date('2026-10-10T10:00:00Z') }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Free-Work' })).toHaveAttribute('href', '/agences/agency-1')
    expect(screen.getByText('ESN')).toBeInTheDocument()
    expect(screen.getByText('10/10/2026')).toBeInTheDocument()
  })

  it('explains that agencies appear with contacts and applications when the list is empty', () => {
    render(<IntermediariesTable intermediaries={[]} />)
    expect(screen.getByText("Aucune agence pour l'instant. Elles apparaissent avec tes contacts et tes candidatures.")).toBeInTheDocument()
  })

  it('searches by name', async () => {
    render(
      <IntermediariesTable
        intermediaries={[buildIntermediary({}), buildIntermediary({ id: 'agency-2', name: 'Malt' })]}
      />,
    )
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'malt')
    expect(screen.queryByRole('link', { name: 'Free-Work' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Malt' })).toBeInTheDocument()
  })
})
