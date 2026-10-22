import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CV_MESSAGES } from '@/domain/cv-library'
import { SentCvEditForm } from './sent-cv-edit-form'

const renderSentCvEditForm = () => {
  const uploadTailoredCvForJobApplication = jest.fn().mockResolvedValue({
    ok: true,
    data: { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload },
  })
  const onClose = jest.fn()
  render(
    <SentCvEditForm
      jobApplicationId="application-1"
      jobApplicationTitle="Développeur React"
      sentCv={null}
      cvOptions={[{ id: 'cv-1', label: 'CV DevOps' }]}
      attachLibraryCvToJobApplication={jest.fn()}
      uploadTailoredCvForJobApplication={uploadTailoredCvForJobApplication}
      detachSentCvFromJobApplication={jest.fn()}
      onDataChanged={jest.fn()}
      onClose={onClose}
    />,
  )
  return { onClose }
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
})
