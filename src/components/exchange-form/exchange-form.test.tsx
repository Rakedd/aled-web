import { render, screen } from '@testing-library/react'
import { ExchangeForm } from './exchange-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

describe('ExchangeForm', () => {
  it('lists the job application options', () => {
    render(
      <ExchangeForm
        contactId="contact-1"
        jobApplicationOptions={[{ id: 'application-1', title: 'Développeur React' }]}
        addContactExchange={jest.fn()}
        now={new Date('2026-10-17T10:00:00Z')}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Noter un échange' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Développeur React' })).toBeInTheDocument()
  })
})
