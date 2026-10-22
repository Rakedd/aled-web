import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CvLibraryItem } from '@/domain/cv-library'
import { CvLibrary } from './cv-library'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const createCvs = (count: number): CvLibraryItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `cv-${index}`,
    label: `CV numéro ${index}`,
    reviewedAt: new Date('2026-03-01T10:00:00Z'),
    currentVersion: { id: `version-${index}`, uploadedAt: new Date('2026-03-01T10:00:00Z'), fileName: 'cv.pdf' },
    sentCount: 0,
    previousSentVersions: [],
  }))

const renderLibrary = (cvs: CvLibraryItem[]) =>
  render(
    <CvLibrary
      cvs={cvs}
      now={new Date('2026-03-20T10:00:00Z')}
      createCv={jest.fn()}
      replaceCvFile={jest.fn()}
      renameCv={jest.fn()}
      deleteCv={jest.fn()}
    />,
  )

describe('CvLibrary', () => {
  it('shows the counter and the add button', () => {
    renderLibrary(createCvs(3))
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter un CV' })).toBeEnabled()
  })

  it('disables the add button at 10 cvs and explains why', () => {
    renderLibrary(createCvs(10))
    expect(screen.getByRole('button', { name: 'Ajouter un CV' })).toBeDisabled()
    expect(screen.getByText('Tu as déjà 10 CV. Supprimes-en un pour en ajouter un nouveau.')).toBeInTheDocument()
  })

  it('explains what the page is for when the library is empty', () => {
    renderLibrary([])
    expect(
      screen.getByText('Ajoute tes CV ici pour retrouver lequel tu as envoyé à chaque candidature.'),
    ).toBeInTheDocument()
  })

  it('opens and closes the add form', async () => {
    renderLibrary([])
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un CV' }))
    expect(screen.getByLabelText('Nom du CV')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByLabelText('Nom du CV')).not.toBeInTheDocument()
  })
})
