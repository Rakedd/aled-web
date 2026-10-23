import { act, renderHook, waitFor } from '@testing-library/react'
import { type CallApiResult, toCallApiError } from '@/domain/call-log'
import { FOLLOW_UP_MESSAGES, type FollowUpMessageDraft } from '@/domain/follow-up-message'
import { useController } from './controller'
import type { FollowUpMessageButtonControllerParameters } from './interfaces'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const buildDraft = (overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft => ({
  subject: 'Suivi de ma candidature',
  message: 'Bonjour Marie,\nje reviens vers vous.',
  contactEmail: 'marie@malt.fr',
  contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
  ...overrides,
})

type Deferred<Value> = { promise: Promise<Value>; resolve: (value: Value) => void }

const createDeferred = <Value,>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const buildParameters = (
  overrides: Partial<FollowUpMessageButtonControllerParameters> = {},
): jest.Mocked<FollowUpMessageButtonControllerParameters> =>
  ({
    jobApplicationId: JOB_APPLICATION_ID,
    hasAnthropicApiKey: true,
    requestFollowUpMessageDraft: jest.fn().mockResolvedValue({ ok: true, data: buildDraft() }),
    addActivityLogEntry: jest.fn().mockResolvedValue({ ok: true, data: null }),
    writeClipboardText: jest.fn().mockResolvedValue(undefined),
    onFollowUpSent: jest.fn(),
    shouldAnnounceSentFollowUp: true,
    ...overrides,
  }) as jest.Mocked<FollowUpMessageButtonControllerParameters>

const renderOpenedController = async (parameters = buildParameters()) => {
  const rendered = renderHook(() => useController(parameters))
  act(() => rendered.result.current.openDialog())
  await waitFor(() => expect(rendered.result.current.isDrafting).toBe(false))
  return { ...rendered, parameters }
}

describe('follow up message button controller', () => {
  it('does not draft before the dialog opens, then drafts with the formal vous on open', async () => {
    const parameters = buildParameters()
    const { result } = renderHook(() => useController(parameters))
    expect(parameters.requestFollowUpMessageDraft).not.toHaveBeenCalled()
    act(() => result.current.openDialog())
    expect(result.current.isDialogOpen).toBe(true)
    expect(result.current.isDrafting).toBe(true)
    expect(result.current.announcement).toBe('')
    act(() => result.current.completeOpenChange(true))
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.drafting)
    await waitFor(() => expect(result.current.draft).toEqual(buildDraft()))
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledWith({
      jobApplicationId: JOB_APPLICATION_ID,
      formality: 'vous',
    })
    expect(result.current.editedMessage).toBe('Bonjour Marie,\nje reviens vers vous.')
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.drafted)
  })

  it('keeps the draft when the dialog is reopened', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.closeDialog())
    act(() => result.current.openDialog())
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledTimes(1)
    expect(result.current.draft).toEqual(buildDraft())
  })

  it('drafts again with the informal tu when the formality changes', async () => {
    const { result, parameters } = await renderOpenedController()
    parameters.requestFollowUpMessageDraft.mockResolvedValue({ ok: true, data: buildDraft({ message: 'Salut Marie' }) })
    await act(async () => result.current.changeFormality('tu'))
    expect(result.current.formality).toBe('tu')
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenLastCalledWith({
      jobApplicationId: JOB_APPLICATION_ID,
      formality: 'tu',
    })
    expect(result.current.editedMessage).toBe('Salut Marie')
  })

  it('does not draft again when the same formality is chosen', async () => {
    const { result, parameters } = await renderOpenedController()
    await act(async () => result.current.changeFormality('vous'))
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledTimes(1)
  })

  it('ignores the answer of a draft superseded by a newer one', async () => {
    const slowFormalDraft = createDeferred<CallApiResult<FollowUpMessageDraft>>()
    const requestFollowUpMessageDraft = jest
      .fn()
      .mockReturnValueOnce(slowFormalDraft.promise)
      .mockResolvedValue({ ok: true, data: buildDraft({ message: 'Salut Marie' }) })
    const parameters = buildParameters({ requestFollowUpMessageDraft })
    const { result } = renderHook(() => useController(parameters))
    act(() => result.current.openDialog())
    await act(async () => result.current.changeFormality('tu'))
    await act(async () => slowFormalDraft.resolve({ ok: true, data: buildDraft({ message: 'Bonjour Marie' }) }))
    expect(result.current.editedMessage).toBe('Salut Marie')
    expect(result.current.isDrafting).toBe(false)
  })

  it('regenerates directly with the current formality when the message was not edited, keeping the draft meanwhile', async () => {
    const slowRegeneration = createDeferred<CallApiResult<FollowUpMessageDraft>>()
    const { result, parameters } = await renderOpenedController()
    parameters.requestFollowUpMessageDraft.mockReturnValue(slowRegeneration.promise)
    act(() => {
      void result.current.regenerate()
    })
    expect(result.current.isDrafting).toBe(true)
    expect(result.current.draft).toEqual(buildDraft())
    await act(async () => slowRegeneration.resolve({ ok: true, data: buildDraft({ message: 'Nouveau' }) }))
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenLastCalledWith({
      jobApplicationId: JOB_APPLICATION_ID,
      formality: 'vous',
    })
    expect(result.current.editedMessage).toBe('Nouveau')
  })

  it('asks before regenerating over an edited message, and keeps it on cancel', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.changeMessage('Mon texte'))
    await act(async () => result.current.regenerate())
    expect(result.current.isReplacementPending).toBe(true)
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledTimes(1)
    act(() => result.current.cancelReplacement())
    expect(result.current.isReplacementPending).toBe(false)
    expect(result.current.editedMessage).toBe('Mon texte')
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledTimes(1)
  })

  it('replaces the edited message once the replacement is confirmed', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.changeMessage('Mon texte'))
    await act(async () => result.current.regenerate())
    parameters.requestFollowUpMessageDraft.mockResolvedValue({ ok: true, data: buildDraft({ message: 'Nouveau' }) })
    await act(async () => result.current.confirmReplacement())
    expect(result.current.isReplacementPending).toBe(false)
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenCalledTimes(2)
    expect(result.current.editedMessage).toBe('Nouveau')
  })

  it('asks before switching the formality over an edited message, then drafts with the new one', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.changeMessage('Mon texte'))
    await act(async () => result.current.changeFormality('tu'))
    expect(result.current.isReplacementPending).toBe(true)
    expect(result.current.formality).toBe('vous')
    parameters.requestFollowUpMessageDraft.mockResolvedValue({ ok: true, data: buildDraft({ message: 'Salut Marie' }) })
    await act(async () => result.current.confirmReplacement())
    expect(result.current.formality).toBe('tu')
    expect(parameters.requestFollowUpMessageDraft).toHaveBeenLastCalledWith({
      jobApplicationId: JOB_APPLICATION_ID,
      formality: 'tu',
    })
    expect(result.current.editedMessage).toBe('Salut Marie')
  })

  it('puts the formality of the displayed draft back when switching fails', async () => {
    const { result, parameters } = await renderOpenedController()
    parameters.requestFollowUpMessageDraft.mockResolvedValue({ ok: false, error: toCallApiError('timeout', 'Trop long') })
    await act(async () => result.current.changeFormality('tu'))
    expect(result.current.formality).toBe('vous')
    expect(result.current.draftErrorMessage).toBe('Trop long')
    expect(result.current.editedMessage).toBe('Bonjour Marie,\nje reviens vers vous.')
  })

  it('ignores copies while a draft is being written', async () => {
    const slowRegeneration = createDeferred<CallApiResult<FollowUpMessageDraft>>()
    const { result, parameters } = await renderOpenedController()
    parameters.requestFollowUpMessageDraft.mockReturnValue(slowRegeneration.promise)
    act(() => {
      void result.current.regenerate()
    })
    await act(async () => result.current.copyMessage())
    expect(parameters.writeClipboardText).not.toHaveBeenCalled()
    await act(async () => slowRegeneration.resolve({ ok: true, data: buildDraft() }))
  })

  it('builds the mailto link from the edited message, and none without an email', async () => {
    const { result } = await renderOpenedController()
    act(() => result.current.changeMessage('Bonjour & merci'))
    expect(result.current.mailtoUrl).toBe(
      'mailto:marie@malt.fr?subject=Suivi%20de%20ma%20candidature&body=Bonjour%20%26%20merci',
    )
    const withoutEmail = await renderOpenedController(
      buildParameters({
        requestFollowUpMessageDraft: jest.fn().mockResolvedValue({ ok: true, data: buildDraft({ contactEmail: null }) }),
      }),
    )
    expect(withoutEmail.result.current.mailtoUrl).toBeNull()
  })

  it('copies the edited message and announces it', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.changeMessage('Mon texte'))
    await act(async () => result.current.copyMessage())
    expect(parameters.writeClipboardText).toHaveBeenCalledWith('Mon texte')
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.copied)
  })

  it('copies the message for LinkedIn with its own announcement', async () => {
    const { result, parameters } = await renderOpenedController()
    await act(async () => result.current.copyMessageForLinkedin())
    expect(parameters.writeClipboardText).toHaveBeenCalledWith('Bonjour Marie,\nje reviens vers vous.')
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.linkedinCopied)
  })

  it('announces a failed copy', async () => {
    const { result } = await renderOpenedController(
      buildParameters({ writeClipboardText: jest.fn().mockRejectedValue(new Error('denied')) }),
    )
    await act(async () => result.current.copyMessage())
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.copyFailed)
  })

  it('logs the sent follow up, closes the dialog, forgets the draft and refreshes the data', async () => {
    const { result, parameters } = await renderOpenedController()
    await act(async () => result.current.markAsSent())
    expect(parameters.addActivityLogEntry).toHaveBeenCalledWith(JOB_APPLICATION_ID, {
      kind: 'message',
      summary: 'Relance envoyée',
    })
    expect(result.current.isDialogOpen).toBe(false)
    expect(result.current.draft).toBeNull()
    expect(result.current.closedDialogAnnouncement).toBe(FOLLOW_UP_MESSAGES.sentAnnouncement)
    expect(parameters.onFollowUpSent).not.toHaveBeenCalled()
    act(() => result.current.completeOpenChange(false))
    expect(parameters.onFollowUpSent).toHaveBeenCalledTimes(1)
    act(() => result.current.completeOpenChange(false))
    expect(parameters.onFollowUpSent).toHaveBeenCalledTimes(1)
  })

  it('leaves the announcement to the caller when it does not want the button to announce the sent follow up', async () => {
    const { result, parameters } = await renderOpenedController(buildParameters({ shouldAnnounceSentFollowUp: false }))
    await act(async () => result.current.markAsSent())
    act(() => result.current.completeOpenChange(false))
    expect(result.current.closedDialogAnnouncement).toBe('')
    expect(parameters.onFollowUpSent).toHaveBeenCalledTimes(1)
  })

  it('does not notify the caller when the dialog closes without a sent follow up', async () => {
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.closeDialog())
    act(() => result.current.completeOpenChange(false))
    expect(parameters.onFollowUpSent).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with the error when the follow up cannot be logged', async () => {
    const { result, parameters } = await renderOpenedController(
      buildParameters({ addActivityLogEntry: jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Enregistrement impossible' }) }),
    )
    await act(async () => result.current.markAsSent())
    expect(result.current.isDialogOpen).toBe(true)
    expect(result.current.markAsSentErrorMessage).toBe('Enregistrement impossible')
    expect(parameters.onFollowUpSent).not.toHaveBeenCalled()
  })

  it('shows the draft error and drafts again on retry', async () => {
    const requestFollowUpMessageDraft = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: toCallApiError('timeout', "Claude n'a pas répondu à temps, réessaie.") })
      .mockResolvedValue({ ok: true, data: buildDraft() })
    const { result } = await renderOpenedController(buildParameters({ requestFollowUpMessageDraft }))
    expect(result.current.draftErrorMessage).toBe("Claude n'a pas répondu à temps, réessaie.")
    expect(result.current.draft).toBeNull()
    await act(async () => result.current.regenerate())
    expect(result.current.draftErrorMessage).toBeNull()
    expect(result.current.draft).toEqual(buildDraft())
  })

  it('never drafts without a Claude key and reports the missing key', async () => {
    const parameters = buildParameters({ hasAnthropicApiKey: false })
    const { result } = renderHook(() => useController(parameters))
    act(() => result.current.openDialog())
    await act(async () => result.current.regenerate())
    expect(parameters.requestFollowUpMessageDraft).not.toHaveBeenCalled()
    expect(result.current.isMissingApiKey).toBe(true)
  })

  it('reports the missing key when the server answers that the key is missing', async () => {
    const { result } = await renderOpenedController(
      buildParameters({
        requestFollowUpMessageDraft: jest
          .fn()
          .mockResolvedValue({ ok: false, error: toCallApiError('missing_api_key', 'Ajoute ta clé') }),
      }),
    )
    expect(result.current.isMissingApiKey).toBe(true)
    expect(result.current.draftErrorMessage).toBeNull()
  })

  it('tries again on the next open after the server reported a missing key', async () => {
    const requestFollowUpMessageDraft = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: toCallApiError('missing_api_key', 'Ajoute ta clé') })
      .mockResolvedValue({ ok: true, data: buildDraft() })
    const { result } = await renderOpenedController(buildParameters({ requestFollowUpMessageDraft }))
    expect(result.current.isMissingApiKey).toBe(true)
    act(() => result.current.closeDialog())
    act(() => result.current.openDialog())
    expect(result.current.isMissingApiKey).toBe(false)
    await waitFor(() => expect(result.current.draft).toEqual(buildDraft()))
  })

  it('announces the drafting at once when a regeneration starts in a dialog already open', async () => {
    const slowRegeneration = createDeferred<CallApiResult<FollowUpMessageDraft>>()
    const { result, parameters } = await renderOpenedController()
    act(() => result.current.completeOpenChange(true))
    parameters.requestFollowUpMessageDraft.mockReturnValue(slowRegeneration.promise)
    act(() => {
      void result.current.regenerate()
    })
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.drafting)
    await act(async () => slowRegeneration.resolve({ ok: true, data: buildDraft() }))
    expect(result.current.announcement).toBe(FOLLOW_UP_MESSAGES.drafted)
  })

  it('drafts again on the next open when the dialog was closed during a draft', async () => {
    const slowDraft = createDeferred<CallApiResult<FollowUpMessageDraft>>()
    const requestFollowUpMessageDraft = jest
      .fn()
      .mockReturnValueOnce(slowDraft.promise)
      .mockResolvedValue({ ok: true, data: buildDraft({ message: 'Deuxième' }) })
    const parameters = buildParameters({ requestFollowUpMessageDraft })
    const { result } = renderHook(() => useController(parameters))
    act(() => result.current.openDialog())
    act(() => result.current.closeDialog())
    await act(async () => slowDraft.resolve({ ok: true, data: buildDraft({ message: 'Premier' }) }))
    expect(result.current.draft).toBeNull()
    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.editedMessage).toBe('Deuxième'))
  })
})
