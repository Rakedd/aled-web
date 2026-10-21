import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IntermediaryListItem } from '@/domain/contacts'
import { IntermediaryHeader } from './intermediary-header'

const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

const buildIntermediary = (overrides: Partial<IntermediaryListItem>): IntermediaryListItem => ({
  id: 'agency-1',
  name: 'Free-Work',
  kind: null,
  contactCount: 0,
  proposedMissionCount: 0,
  lastExchangeAt: null,
  ...overrides,
})

describe('IntermediaryHeader', () => {
  it('summarises contacts, proposed missions and last exchange', () => {
    const intermediary = buildIntermediary({
      contactCount: 3,
      proposedMissionCount: 2,
      lastExchangeAt: new Date('2026-10-10T10:00:00Z'),
    })
    render(<IntermediaryHeader intermediary={intermediary} updateIntermediaryKind={jest.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Free-Work' })).toBeInTheDocument()
    expect(screen.getByText('3 contacts · 2 missions proposées · dernier échange le 10/10/2026')).toBeInTheDocument()
  })

  it('uses singular forms and says there is no exchange yet', () => {
    const intermediary = buildIntermediary({ contactCount: 1, proposedMissionCount: 1 })
    render(<IntermediaryHeader intermediary={intermediary} updateIntermediaryKind={jest.fn()} />)
    expect(screen.getByText('1 contact · 1 mission proposée · aucun échange')).toBeInTheDocument()
  })

  it('saves the new kind and refreshes the page', async () => {
    const updateIntermediaryKind = jest.fn().mockResolvedValue({ ok: true, data: null })
    render(<IntermediaryHeader intermediary={buildIntermediary({})} updateIntermediaryKind={updateIntermediaryKind} />)
    await userEvent.selectOptions(screen.getByLabelText("Type d'intermédiaire"), 'esn')
    expect(updateIntermediaryKind).toHaveBeenCalledWith('agency-1', 'esn')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows the error returned by the action', async () => {
    const updateIntermediaryKind = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Enregistrement impossible' })
    render(<IntermediaryHeader intermediary={buildIntermediary({ kind: 'esn' })} updateIntermediaryKind={updateIntermediaryKind} />)
    await userEvent.selectOptions(screen.getByLabelText("Type d'intermédiaire"), 'platform')
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible')
  })
})
