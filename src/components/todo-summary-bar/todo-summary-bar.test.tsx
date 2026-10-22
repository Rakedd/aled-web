import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoSummaryBar } from './todo-summary-bar'
import type { TodoSummaryBarProps } from './interfaces'

const buildProps = (overrides: Partial<TodoSummaryBarProps> = {}): TodoSummaryBarProps => ({
  kindCounts: [
    { kind: 'follow_up_due', count: 8 },
    { kind: 'no_news_suggestion', count: 6 },
    { kind: 'job_spec_missing', count: 5 },
    { kind: 'end_client_unknown', count: 4 },
  ],
  selectedAlertKind: null,
  onToggleAlertKind: jest.fn(),
  isExpanded: false,
  onToggleExpanded: jest.fn(),
  detailsId: 'todo-details',
  ...overrides,
})

describe('TodoSummaryBar', () => {
  it('shows the total and one unpressed pill per kind', () => {
    render(<TodoSummaryBar {...buildProps()} />)
    expect(screen.getByRole('heading', { name: 'À faire · 23' })).toBeInTheDocument()
    for (const name of ['8 relances', '6 sans nouvelles', '5 fiches métier', '4 clients inconnus']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('reports the clicked kind', async () => {
    const props = buildProps()
    render(<TodoSummaryBar {...props} />)
    await userEvent.click(screen.getByRole('button', { name: '8 relances' }))
    expect(props.onToggleAlertKind).toHaveBeenCalledWith('follow_up_due')
  })

  it('presses the selected kind with the action tone', () => {
    render(<TodoSummaryBar {...buildProps({ selectedAlertKind: 'follow_up_due' })} />)
    const selectedPill = screen.getByRole('button', { name: '8 relances' })
    expect(selectedPill).toHaveAttribute('aria-pressed', 'true')
    expect(selectedPill).toHaveAttribute('data-tone', 'action')
  })

  it('exposes the expansion state of the details', async () => {
    const props = buildProps()
    const { rerender } = render(<TodoSummaryBar {...props} />)
    const expandButton = screen.getByRole('button', { name: 'Tout déplier' })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(expandButton).toHaveAttribute('aria-controls', 'todo-details')
    await userEvent.click(expandButton)
    expect(props.onToggleExpanded).toHaveBeenCalled()
    rerender(<TodoSummaryBar {...props} isExpanded />)
    expect(screen.getByRole('button', { name: 'Tout replier' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('lets the pills take their own line on small screens', () => {
    render(<TodoSummaryBar {...buildProps()} />)
    const pillsGroup = screen.getByRole('button', { name: '8 relances' }).parentElement
    expect(pillsGroup).toHaveClass('basis-full', 'sm:basis-auto', 'sm:flex-1')
    expect(pillsGroup).not.toHaveClass('flex-1')
    expect(screen.getByRole('region', { name: 'À faire · 23' })).toHaveClass('rounded-3xl', 'sm:rounded-full')
  })

  it('shows an empty message without pills or expand button', () => {
    render(<TodoSummaryBar {...buildProps({ kindCounts: [] })} />)
    expect(screen.getByText("Rien à faire pour l'instant")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tout déplier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('links the cv count to Mes CV instead of filtering job applications', async () => {
    const props = buildProps({ kindCounts: [{ kind: 'follow_up_due', count: 2 }, { kind: 'cv_outdated', count: 1 }] })
    render(<TodoSummaryBar {...props} />)
    expect(screen.getByRole('heading', { name: 'À faire · 3' })).toBeInTheDocument()
    const cvLink = screen.getByRole('link', { name: '1 CV à revoir' })
    expect(cvLink).toHaveAttribute('href', '/cv')
    expect(screen.queryByRole('button', { name: '1 CV à revoir' })).not.toBeInTheDocument()
    await userEvent.click(cvLink)
    expect(props.onToggleAlertKind).not.toHaveBeenCalled()
  })
})
