import { render, screen, within } from '@testing-library/react'
import type { PositionedJobApplication } from '@/domain/duplicate-positioning'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { HeaderEditForm } from './header-edit-form'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const buildPositioning = (overrides: Partial<PositionedJobApplication>): PositionedJobApplication => ({
  id: 'application-9',
  title: 'Lead React',
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-01T08:00:00Z'),
  ...overrides,
})

const renderHeaderEditForm = (positionedJobApplications: PositionedJobApplication[]) =>
  render(
    <HeaderEditForm
      jobApplication={buildJobApplicationOverview()}
      updateJobApplication={jest.fn()}
      setEndClientParent={jest.fn()}
      updateIntermediaryKind={jest.fn()}
      searchEntities={jest.fn().mockResolvedValue({ ok: true, data: [] })}
      positionedJobApplications={positionedJobApplications}
      onDataChanged={jest.fn()}
      onClose={jest.fn()}
    />,
  )

describe('HeaderEditForm', () => {
  it('shows the duplicate positioning warning and never lists the edited application itself', () => {
    renderHeaderEditForm([buildPositioning({}), buildPositioning({ id: 'application-1', title: 'Développeur React' })])
    const warning = screen.getByRole('status')
    expect(warning).toHaveTextContent('Ce positionnement risque de faire doublon, attention.')
    const links = within(warning).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/candidatures/application-9')
  })

  it('shows no warning without a risky positioning', () => {
    renderHeaderEditForm([])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
