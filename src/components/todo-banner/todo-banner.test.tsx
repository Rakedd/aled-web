import { render, screen } from '@testing-library/react'
import { TodoBanner } from './todo-banner'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderTodoBanner = (title: string) =>
  render(
    <TodoBanner
      title={title}
      initialAlerts={[]}
      snoozeAlert={jest.fn()}
      changeJobApplicationStatus={jest.fn()}
      jobApplicationSummaries={[]}
      interviews={[]}
      now={new Date('2026-10-20T10:00:00Z')}
    />,
  )

describe('TodoBanner', () => {
  it('names its region after the title prop', () => {
    renderTodoBanner('Tous les rappels')
    expect(screen.getByRole('region', { name: 'Tous les rappels' })).toBeInTheDocument()
  })

  it('keeps the labels of two instances apart', () => {
    renderTodoBanner('À faire')
    renderTodoBanner('Tous les rappels')
    expect(screen.getByRole('region', { name: 'À faire' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tous les rappels' })).toBeInTheDocument()
  })
})
