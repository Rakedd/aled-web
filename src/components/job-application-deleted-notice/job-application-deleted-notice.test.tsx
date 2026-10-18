import { render, screen } from '@testing-library/react'
import { JobApplicationDeletedNotice } from './job-application-deleted-notice'

const mockedReplace = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockedReplace }) }))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('JobApplicationDeletedNotice', () => {
  it('shows the notice and strips the query parameter without scrolling', () => {
    render(<JobApplicationDeletedNotice isJobApplicationDeleted />)

    expect(screen.getByRole('status')).toHaveTextContent('Candidature supprimée')
    expect(mockedReplace).toHaveBeenCalledTimes(1)
    expect(mockedReplace).toHaveBeenCalledWith('/candidatures', { scroll: false })
  })

  it('keeps showing the notice once the query parameter is gone', () => {
    const { rerender } = render(<JobApplicationDeletedNotice isJobApplicationDeleted />)

    rerender(<JobApplicationDeletedNotice isJobApplicationDeleted={false} />)

    expect(screen.getByRole('status')).toHaveTextContent('Candidature supprimée')
  })

  it('renders nothing and leaves the URL alone without the query parameter', () => {
    render(<JobApplicationDeletedNotice isJobApplicationDeleted={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(mockedReplace).not.toHaveBeenCalled()
  })
})
