import { render, screen } from '@testing-library/react'
import type { Exchange } from '@/domain/contacts'
import { ExchangesSection } from './exchanges-section'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const LINKED_EXCHANGE: Exchange = {
  id: 'exchange-1',
  occurredAt: new Date('2026-10-10T09:00:00Z'),
  kind: 'call',
  summary: 'Appel de qualification',
  jobApplicationId: 'application-1',
  jobApplicationTitle: 'Développeur React',
  contactId: 'contact-1',
  contactName: 'Jeanne Martin',
}

const FREE_EXCHANGE: Exchange = {
  ...LINKED_EXCHANGE,
  id: 'exchange-2',
  summary: 'Café',
  jobApplicationId: null,
  jobApplicationTitle: null,
}

const EXCHANGE_FORM = {
  contactId: 'contact-1',
  jobApplicationOptions: [{ id: 'application-1', title: 'Développeur React' }],
  addContactExchange: jest.fn(),
  now: new Date('2026-10-17T10:00:00Z'),
}

describe('ExchangesSection', () => {
  it('links an exchange to its job application', () => {
    render(<ExchangesSection exchanges={[LINKED_EXCHANGE, FREE_EXCHANGE]} showsContactName={false} exchangeForm={null} />)
    expect(screen.getByText('Appel de qualification')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Développeur React' })).toHaveAttribute('href', '/candidatures/application-1')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('hides the form when exchangeForm is null', () => {
    render(<ExchangesSection exchanges={[]} showsContactName={false} exchangeForm={null} />)
    expect(screen.queryByRole('heading', { name: 'Noter un échange' })).not.toBeInTheDocument()
    expect(screen.getByText("Aucun échange pour l'instant.")).toBeInTheDocument()
  })

  it('shows the form with the job application options when provided', () => {
    render(<ExchangesSection exchanges={[]} showsContactName={false} exchangeForm={EXCHANGE_FORM} />)
    expect(screen.getByRole('heading', { name: 'Noter un échange' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Développeur React' })).toBeInTheDocument()
  })

  it('shows the contact name when asked to', () => {
    render(<ExchangesSection exchanges={[LINKED_EXCHANGE]} showsContactName exchangeForm={null} />)
    expect(screen.getByText(/Jeanne Martin/)).toBeInTheDocument()
  })
})
