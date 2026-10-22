import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CV_MESSAGES, type CvOption, type SentCv } from '@/domain/cv-library'
import { SentCvEditForm } from './sent-cv-edit-form'

type RenderOptions = { sentCv?: SentCv | null; cvOptions?: CvOption[]; hasCvLoadFailed?: boolean }

const SENT_CV: SentCv = { versionId: 'version-1', label: 'CV Mission', uploadedAt: new Date('2026-03-12T10:00:00Z') }

const renderSentCvEditForm = ({
  sentCv = null,
  cvOptions = [{ id: 'cv-1', label: 'CV DevOps' }],
  hasCvLoadFailed = false,
}: RenderOptions = {}) => {
  const uploadTailoredCvForJobApplication = jest.fn().mockResolvedValue({
    ok: true,
    data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload },
  })
  const detachSentCvFromJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  const onClose = jest.fn()
  render(
    <SentCvEditForm
      jobApplicationId="application-1"
      jobApplicationTitle="Développeur React"
      sentCv={sentCv}
      cvOptions={cvOptions}
      hasCvLoadFailed={hasCvLoadFailed}
      attachLibraryCvToJobApplication={jest.fn()}
      uploadTailoredCvForJobApplication={uploadTailoredCvForJobApplication}
      detachSentCvFromJobApplication={detachSentCvFromJobApplication}
      onDataChanged={jest.fn()}
      onClose={onClose}
    />,
  )
  return { onClose, detachSentCvFromJobApplication }
}

describe('SentCvEditForm', () => {
  it('shows the tailored fields when the tailored choice is selected', async () => {
    renderSentCvEditForm()
    expect(screen.queryByLabelText('Nom du CV')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Déposer un CV sur mesure' }))
    expect(screen.getByLabelText('Nom du CV')).toBeInTheDocument()
    expect(screen.getByLabelText("L'ajouter aussi à ma bibliothèque")).not.toBeChecked()
  })

  it('shows the full library notice after a tailored upload and closes on OK', async () => {
    const { onClose } = renderSentCvEditForm()
    await userEvent.click(screen.getByRole('radio', { name: 'Déposer un CV sur mesure' }))
    await userEvent.upload(
      screen.getByLabelText('Fichier PDF'),
      new File(['%PDF-1.7'], 'mon-cv.pdf', { type: 'application/pdf' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('status')).toHaveTextContent(CV_MESSAGES.libraryFullAfterTailoredUpload)
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks for confirmation before removing the sent cv', async () => {
    const { detachSentCvFromJobApplication } = renderSentCvEditForm({ sentCv: SENT_CV })
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le CV envoyé' }))
    const confirmation = await screen.findByRole('alertdialog', { name: 'Retirer le CV envoyé ?' })
    expect(confirmation).toHaveAccessibleDescription(
      'Ce CV ne sera plus rattaché à la candidature. Un CV sur mesure sera supprimé.',
    )
    expect(detachSentCvFromJobApplication).not.toHaveBeenCalled()
  })

  it('removes the sent cv once the confirmation is accepted', async () => {
    const { detachSentCvFromJobApplication, onClose } = renderSentCvEditForm({ sentCv: SENT_CV })
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le CV envoyé' }))
    const confirmation = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Retirer' }))
    expect(detachSentCvFromJobApplication).toHaveBeenCalledWith('application-1')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const { detachSentCvFromJobApplication } = renderSentCvEditForm({ sentCv: SENT_CV })
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le CV envoyé' }))
    const confirmation = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(detachSentCvFromJobApplication).not.toHaveBeenCalled()
  })

  it('shows the empty library hint when the library has no cv', async () => {
    renderSentCvEditForm({ cvOptions: [] })
    await userEvent.click(screen.getByRole('radio', { name: 'Choisir dans ma bibliothèque' }))
    expect(screen.getByText("Ta bibliothèque n'a pas encore de CV.")).toBeInTheDocument()
  })

  it('shows a loading failure hint instead of the empty library hint when the cvs could not be loaded', async () => {
    renderSentCvEditForm({ cvOptions: [], hasCvLoadFailed: true })
    await userEvent.click(screen.getByRole('radio', { name: 'Choisir dans ma bibliothèque' }))
    expect(screen.getByText('Impossible de charger tes CV pour le moment.')).toBeInTheDocument()
    expect(screen.queryByText("Ta bibliothèque n'a pas encore de CV.")).not.toBeInTheDocument()
  })
})
