import { render, screen, within } from '@testing-library/react'
import type { TodoAlert } from '@/domain/todo-alerts'
import { TodoBanner } from './todo-banner'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderTodoBanner = (title: string, initialAlerts: TodoAlert[] = []) =>
  render(
    <TodoBanner
      title={title}
      initialAlerts={initialAlerts}
      snoozeAlert={jest.fn()}
      confirmCvStillGood={jest.fn()}
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

  it('links the cv reminder and its Mettre à jour button to Mes CV, without snooze buttons', () => {
    renderTodoBanner('À faire', [
      { kind: 'cv_outdated', cvId: 'cv-1', cvLabel: 'CV DevOps', referenceDate: new Date('2026-07-01T10:00:00Z') },
    ])
    const card = screen.getByRole('listitem')
    expect(within(card).getByRole('link', { name: /Ton CV DevOps n'a pas bougé/ })).toHaveAttribute('href', '/cv')
    expect(within(card).getByRole('link', { name: 'Mettre à jour' })).toHaveAttribute('href', '/cv')
    expect(within(card).getByRole('button', { name: 'Il est encore bon' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Reporter/ })).not.toBeInTheDocument()
  })
})
