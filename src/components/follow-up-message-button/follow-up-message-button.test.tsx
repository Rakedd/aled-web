import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { toCallApiError } from '@/domain/call-log'
import type { FollowUpMessageDraft } from '@/domain/follow-up-message'
import { requestFollowUpMessageDraft } from '@/lib/follow-up-message/request-follow-up-message-draft'
import { FollowUpMessageButton } from './follow-up-message-button'
import type { FollowUpMessageButtonProps } from './interfaces'

const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))
jest.mock('@/lib/follow-up-message/request-follow-up-message-draft', () => ({ requestFollowUpMessageDraft: jest.fn() }))

const requestFollowUpMessageDraftMock = jest.mocked(requestFollowUpMessageDraft)

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const buildDraft = (overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft => ({
  subject: 'Suivi de ma candidature',
  message: 'Bonjour Marie, je reviens vers vous.',
  contactEmail: 'marie@malt.fr',
  contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
  ...overrides,
})

const renderButton = (overrides: Partial<FollowUpMessageButtonProps> = {}) => {
  const addActivityLogEntry = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(
    <FollowUpMessageButton
      jobApplicationId={JOB_APPLICATION_ID}
      hasAnthropicApiKey
      addActivityLogEntry={addActivityLogEntry}
      {...overrides}
    />,
  )
  return { addActivityLogEntry }
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Rédiger une relance' }))
  return screen.getByRole('dialog', { name: 'Relance' })
}

describe('FollowUpMessageButton', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    requestFollowUpMessageDraftMock.mockResolvedValue({ ok: true, data: buildDraft() })
  })

  it('drafts with vous as soon as the dialog opens and shows the read only subject and the editable message', async () => {
    const user = userEvent.setup()
    renderButton()
    expect(requestFollowUpMessageDraftMock).not.toHaveBeenCalled()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('button', { name: 'Vous' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Tu' })).toHaveAttribute('aria-pressed', 'false')
    const messageField = await within(dialog).findByRole('textbox', { name: 'Message' })
    expect(messageField).toHaveValue('Bonjour Marie, je reviens vers vous.')
    expect(within(dialog).getByRole('textbox', { name: 'Objet' })).toHaveAttribute('readonly')
    expect(within(dialog).getByRole('textbox', { name: 'Objet' })).toHaveValue('Suivi de ma candidature')
    expect(requestFollowUpMessageDraftMock).toHaveBeenCalledWith({ jobApplicationId: JOB_APPLICATION_ID, formality: 'vous' })
    await user.clear(messageField)
    await user.type(messageField, 'Mon texte')
    expect(messageField).toHaveValue('Mon texte')
  })

  it('marks the dialog busy and announces the drafting while it runs', async () => {
    const user = userEvent.setup()
    let resolveDraft: (draftResult: { ok: true; data: FollowUpMessageDraft }) => void = () => undefined
    requestFollowUpMessageDraftMock.mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve
      }),
    )
    renderButton()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('status')).toHaveTextContent('Rédaction…')
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull()
    resolveDraft({ ok: true, data: buildDraft() })
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Relance rédigée.'))
    expect(dialog.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('drafts again with tu when the formality is switched', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    requestFollowUpMessageDraftMock.mockResolvedValue({ ok: true, data: buildDraft({ message: 'Salut Marie' }) })
    await user.click(within(dialog).getByRole('button', { name: 'Tu' }))
    expect(requestFollowUpMessageDraftMock).toHaveBeenLastCalledWith({ jobApplicationId: JOB_APPLICATION_ID, formality: 'tu' })
    expect(await within(dialog).findByDisplayValue('Salut Marie')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Tu' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('copies the message and announces it', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    await user.click(within(dialog).getByRole('button', { name: 'Copier' }))
    expect(await navigator.clipboard.readText()).toBe('Bonjour Marie, je reviens vers vous.')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Message copié.')
  })

  it('offers a mailto link with the subject and the body when the contact has an email', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    const emailLink = await within(dialog).findByRole('link', { name: 'Envoyer par e-mail' })
    expect(emailLink).toHaveAttribute(
      'href',
      'mailto:marie@malt.fr?subject=Suivi%20de%20ma%20candidature&body=Bonjour%20Marie%2C%20je%20reviens%20vers%20vous.',
    )
  })

  it('offers neither email nor LinkedIn when the contact has none', async () => {
    const user = userEvent.setup()
    requestFollowUpMessageDraftMock.mockResolvedValue({
      ok: true,
      data: buildDraft({ contactEmail: null, contactLinkedinUrl: null }),
    })
    renderButton()
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    expect(within(dialog).queryByRole('link', { name: 'Envoyer par e-mail' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: /Ouvrir LinkedIn/ })).not.toBeInTheDocument()
  })

  it('copies the message and opens the LinkedIn profile in a new tab', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    const linkedinLink = await within(dialog).findByRole('link', { name: /Ouvrir LinkedIn/ })
    expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/marie')
    expect(linkedinLink).toHaveAttribute('target', '_blank')
    expect(linkedinLink).toHaveAttribute('rel', 'noopener noreferrer')
    await user.click(linkedinLink)
    expect(await navigator.clipboard.readText()).toBe('Bonjour Marie, je reviens vers vous.')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Message copié, colle-le dans LinkedIn.')
  })

  it('logs the sent follow up, closes the dialog, gives the focus back and refreshes the page', async () => {
    const user = userEvent.setup()
    const { addActivityLogEntry } = renderButton()
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    await user.click(within(dialog).getByRole('button', { name: "J'ai envoyé la relance" }))
    expect(addActivityLogEntry).toHaveBeenCalledWith(JOB_APPLICATION_ID, { kind: 'message', summary: 'Relance envoyée' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Rédiger une relance' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Relance notée dans le journal.')
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('shows the draft error in an alert and drafts again on retry', async () => {
    const user = userEvent.setup()
    requestFollowUpMessageDraftMock.mockResolvedValueOnce({
      ok: false,
      error: toCallApiError('unknown', 'La rédaction a échoué. Réessaie dans un instant.'),
    })
    renderButton()
    const dialog = await openDialog(user)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La rédaction a échoué. Réessaie dans un instant.')
    await user.click(within(dialog).getByRole('button', { name: 'Réessayer' }))
    expect(await within(dialog).findByRole('textbox', { name: 'Message' })).toHaveValue('Bonjour Marie, je reviens vers vous.')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the missing key notice instead of a draft without a Claude key, and still lets the follow up be logged', async () => {
    const user = userEvent.setup()
    renderButton({ hasAnthropicApiKey: false })
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      'Ajoute ta clé Claude dans tes préférences pour activer la rédaction des relances.',
    )
    expect(within(dialog).queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "J'ai envoyé la relance" })).toBeInTheDocument()
    expect(requestFollowUpMessageDraftMock).not.toHaveBeenCalled()
  })

  it('shows a compact Rédiger label whose accessible name names the job application', () => {
    renderButton({ label: { variant: 'compact', jobApplicationTitle: 'Dev React' } })
    const openingButton = screen.getByRole('button', { name: 'Rédiger une relance pour « Dev React »' })
    expect(openingButton).toHaveTextContent(/^Rédiger$/)
  })

  it('keeps the draft and the focus on Régénérer while a new draft is written', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    let resolveDraft: (draftResult: { ok: true; data: FollowUpMessageDraft }) => void = () => undefined
    requestFollowUpMessageDraftMock.mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve
      }),
    )
    const regenerateButton = within(dialog).getByRole('button', { name: 'Régénérer' })
    await user.click(regenerateButton)
    expect(regenerateButton).toHaveFocus()
    expect(regenerateButton).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByRole('textbox', { name: 'Message' })).toHaveAttribute('readonly')
    expect(within(dialog).getByText('Rédaction…', { selector: 'p:not([role])' })).toBeInTheDocument()
    resolveDraft({ ok: true, data: buildDraft({ message: 'Nouveau' }) })
    expect(await within(dialog).findByDisplayValue('Nouveau')).not.toHaveAttribute('readonly')
    expect(regenerateButton).toHaveFocus()
  })

  it('asks before replacing an edited message, keeps it on Annuler and replaces it on Remplacer', async () => {
    const user = userEvent.setup()
    renderButton()
    const dialog = await openDialog(user)
    const messageField = await within(dialog).findByRole('textbox', { name: 'Message' })
    await user.clear(messageField)
    await user.type(messageField, 'Mon texte')
    await user.click(within(dialog).getByRole('button', { name: 'Régénérer' }))
    expect(within(dialog).getByText('Remplacer ton message modifié ?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Remplacer' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(within(dialog).queryByText('Remplacer ton message modifié ?')).not.toBeInTheDocument()
    expect(messageField).toHaveValue('Mon texte')
    expect(messageField).toHaveFocus()
    expect(requestFollowUpMessageDraftMock).toHaveBeenCalledTimes(1)
    requestFollowUpMessageDraftMock.mockResolvedValue({ ok: true, data: buildDraft({ message: 'Salut Marie' }) })
    await user.click(within(dialog).getByRole('button', { name: 'Tu' }))
    await user.click(within(dialog).getByRole('button', { name: 'Remplacer' }))
    expect(await within(dialog).findByDisplayValue('Salut Marie')).toHaveFocus()
    expect(requestFollowUpMessageDraftMock).toHaveBeenLastCalledWith({ jobApplicationId: JOB_APPLICATION_ID, formality: 'tu' })
  })

  it('hands the focus and the follow up notification to the caller when it asks for them', async () => {
    const user = userEvent.setup()
    const onFollowUpSent = jest.fn()
    const FocusTarget = () => {
      const focusTargetRef = useRef<HTMLHeadingElement | null>(null)
      return (
        <>
          <h2 ref={focusTargetRef} tabIndex={-1}>
            À faire
          </h2>
          <FollowUpMessageButton
            jobApplicationId={JOB_APPLICATION_ID}
            hasAnthropicApiKey
            addActivityLogEntry={jest.fn().mockResolvedValue({ ok: true, data: null })}
            onFollowUpSent={onFollowUpSent}
            finalFocusRef={focusTargetRef}
          />
        </>
      )
    }
    render(<FocusTarget />)
    const dialog = await openDialog(user)
    await within(dialog).findByRole('textbox', { name: 'Message' })
    await user.click(within(dialog).getByRole('button', { name: "J'ai envoyé la relance" }))
    await waitFor(() => expect(onFollowUpSent).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'À faire' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
