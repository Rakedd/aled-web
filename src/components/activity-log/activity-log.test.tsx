import { render, screen, within } from '@testing-library/react'
import type { ActivityLogEntry } from '@/domain/activity-log'
import { ActivityLog } from './activity-log'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const ENTRY: ActivityLogEntry = {
  id: 'entry-1',
  jobApplicationId: 'application-1',
  occurredAt: new Date('2026-10-17T09:00:00Z'),
  kind: 'call',
  summary: 'Appel de qualification',
}

const renderActivityLog = (initialEntries: ActivityLogEntry[] = [ENTRY]) =>
  render(
    <ActivityLog
      jobApplicationId="application-1"
      initialEntries={initialEntries}
      addActivityLogEntry={jest.fn()}
      listActivityLogEntries={jest.fn()}
      now={new Date('2026-10-17T10:00:00Z')}
    />,
  )

describe('ActivityLog', () => {
  it('lists the entries under « Journal des échanges »', () => {
    renderActivityLog()

    const journal = screen.getByRole('region', { name: 'Journal des échanges' })
    expect(within(journal).getByText('Appel de qualification')).toBeInTheDocument()
    expect(within(journal).queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument()
  })

  it('puts the form in a « Noter un échange » column', () => {
    renderActivityLog()

    const logForm = screen.getByRole('region', { name: 'Noter un échange' })
    expect(within(logForm).getByRole('heading', { level: 2, name: 'Noter un échange' })).toBeInTheDocument()
    expect(within(logForm).getByLabelText('Type')).toBeInTheDocument()
    expect(within(logForm).getByLabelText('Date et heure')).toBeInTheDocument()
    expect(within(logForm).getByLabelText('Résumé')).toBeInTheDocument()
    expect(within(logForm).getByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  })

  it('says when there is no entry yet', () => {
    renderActivityLog([])

    const journal = screen.getByRole('region', { name: 'Journal des échanges' })
    expect(within(journal).getByText("Aucun échange pour l'instant.")).toBeInTheDocument()
  })
})
