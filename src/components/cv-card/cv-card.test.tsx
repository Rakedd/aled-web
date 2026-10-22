import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CvLibraryItem } from '@/domain/cv-library'
import { CvCard } from './cv-card'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const NOW = new Date('2026-03-20T10:00:00Z')

const createCv = (overrides: Partial<CvLibraryItem> = {}): CvLibraryItem => ({
  id: 'cv-1',
  label: 'CV Front',
  reviewedAt: new Date('2026-03-12T10:00:00Z'),
  currentVersion: { id: 'version-current', uploadedAt: new Date('2026-03-12T10:00:00Z'), fileName: 'cv.pdf' },
  sentCount: 2,
  previousSentVersions: [],
  ...overrides,
})

const renderCard = (cv: CvLibraryItem, now = NOW, deleteCv = jest.fn().mockResolvedValue({ ok: true, data: null })) => {
  render(<CvCard cv={cv} now={now} replaceCvFile={jest.fn()} renameCv={jest.fn()} deleteCv={deleteCv} />)
  return { deleteCv }
}

describe('CvCard', () => {
  it('shows the label, the update date and the sent count', () => {
    renderCard(createCv())
    expect(screen.getByRole('heading', { name: 'CV Front' })).toBeInTheDocument()
    expect(screen.getByText(/Mis à jour le 12\/03\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Envoyé dans 2 candidatures/)).toBeInTheDocument()
  })

  it('shows the upload date of the current version even when the cv was reviewed later', () => {
    renderCard(
      createCv({
        reviewedAt: new Date('2026-03-18T10:00:00Z'),
        currentVersion: { id: 'version-current', uploadedAt: new Date('2026-03-02T10:00:00Z'), fileName: 'cv.pdf' },
      }),
    )
    expect(screen.getByText(/Mis à jour le 02\/03\/2026/)).toBeInTheDocument()
  })

  it('falls back to the review date when there is no current version', () => {
    renderCard(createCv({ currentVersion: null, reviewedAt: new Date('2026-03-18T10:00:00Z') }))
    expect(screen.getByText(/Mis à jour le 18\/03\/2026/)).toBeInTheDocument()
  })

  it('shows the À revoir badge only after 90 days', () => {
    const { unmount } = render(
      <CvCard cv={createCv()} now={NOW} replaceCvFile={jest.fn()} renameCv={jest.fn()} deleteCv={jest.fn()} />,
    )
    expect(screen.queryByText('À revoir')).not.toBeInTheDocument()
    unmount()
    renderCard(createCv(), new Date('2026-07-01T10:00:00Z'))
    expect(screen.getByText('À revoir')).toHaveAttribute('data-tone', 'peach-soft')
  })

  it('opens the current pdf in a new tab', () => {
    renderCard(createCv())
    const pdfLink = screen.getByRole('link', { name: 'Voir' })
    expect(pdfLink).toHaveAttribute('href', '/api/cv/versions/version-current/pdf')
    expect(pdfLink).toHaveAttribute('target', '_blank')
    expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('lists previous sent versions in the Anciennes versions envoyées disclosure', () => {
    renderCard(
      createCv({
        previousSentVersions: [{ id: 'version-old', uploadedAt: new Date('2026-01-05T10:00:00Z'), sentCount: 1 }],
      }),
    )
    const disclosure = screen.getByText('Anciennes versions envoyées').closest('details') as HTMLElement
    expect(within(disclosure).getByText('Version du 05/01/2026')).toBeInTheDocument()
    const previousVersionLink = within(disclosure).getByRole('link', { name: 'Voir' })
    expect(previousVersionLink).toHaveAttribute('href', '/api/cv/versions/version-old/pdf')
    expect(previousVersionLink).toHaveAttribute('target', '_blank')
    expect(previousVersionLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(disclosure).getByText('Envoyé dans 1 candidature')).toBeInTheDocument()
  })

  it('hides the disclosure when there is no previous sent version', () => {
    renderCard(createCv())
    expect(screen.queryByText('Anciennes versions envoyées')).not.toBeInTheDocument()
  })

  it('asks for confirmation before deleting', async () => {
    const { deleteCv } = renderCard(createCv())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const confirmation = await screen.findByRole('alertdialog', { name: 'Supprimer CV Front ?' })
    expect(confirmation).toHaveAccessibleDescription('Les candidatures auxquelles tu as envoyé ce CV le garderont.')
    expect(deleteCv).not.toHaveBeenCalled()
  })
})
