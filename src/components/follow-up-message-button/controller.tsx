import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import {
  buildFollowUpMailtoUrl,
  DEFAULT_FOLLOW_UP_FORMALITY,
  FOLLOW_UP_MESSAGES,
  type FollowUpFormality,
  type FollowUpMessageDraft,
} from '@/domain/follow-up-message'
import type { DraftRequestOutcome, FollowUpMessageButtonControllerParameters } from './interfaces'

export const useController = ({
  jobApplicationId,
  hasAnthropicApiKey,
  requestFollowUpMessageDraft,
  addActivityLogEntry,
  writeClipboardText,
  onFollowUpSent,
  shouldAnnounceSentFollowUp,
}: FollowUpMessageButtonControllerParameters) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formality, setFormality] = useState<FollowUpFormality>(DEFAULT_FOLLOW_UP_FORMALITY)
  const [draft, setDraft] = useState<FollowUpMessageDraft | null>(null)
  const [draftFormality, setDraftFormality] = useState<FollowUpFormality | null>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftErrorMessage, setDraftErrorMessage] = useState<string | null>(null)
  const [hasServerReportedMissingApiKey, setHasServerReportedMissingApiKey] = useState(false)
  const [pendingReplacementFormality, setPendingReplacementFormality] = useState<FollowUpFormality | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [closedDialogAnnouncement, setClosedDialogAnnouncement] = useState('')
  const [isMarkingAsSent, setIsMarkingAsSent] = useState(false)
  const [markAsSentErrorMessage, setMarkAsSentErrorMessage] = useState<string | null>(null)
  const latestDraftRequestNumberRef = useRef(0)
  const isDraftingRef = useRef(false)
  const isDialogSettledRef = useRef(false)
  const hasPendingSentNotificationRef = useRef(false)
  const isMissingApiKey = !hasAnthropicApiKey || hasServerReportedMissingApiKey
  const hasUserEditedMessage = draft !== null && editedMessage !== draft.message

  const requestDraft = async (requestedFormality: FollowUpFormality): Promise<DraftRequestOutcome> => {
    if (!hasAnthropicApiKey) return 'failed'
    latestDraftRequestNumberRef.current += 1
    const draftRequestNumber = latestDraftRequestNumberRef.current
    isDraftingRef.current = true
    setIsDrafting(true)
    if (isDialogSettledRef.current) setAnnouncement(FOLLOW_UP_MESSAGES.drafting)
    const draftResult = await requestFollowUpMessageDraft({ jobApplicationId, formality: requestedFormality })
    if (draftRequestNumber !== latestDraftRequestNumberRef.current) return 'superseded'
    isDraftingRef.current = false
    setIsDrafting(false)
    if (!draftResult.ok) {
      setAnnouncement('')
      if (draftResult.error.kind === 'missing_api_key') setHasServerReportedMissingApiKey(true)
      else setDraftErrorMessage(draftResult.error.message)
      return 'failed'
    }
    setDraftErrorMessage(null)
    setDraft(draftResult.data)
    setDraftFormality(requestedFormality)
    setEditedMessage(draftResult.data.message)
    setAnnouncement(FOLLOW_UP_MESSAGES.drafted)
    return 'drafted'
  }

  const draftWithFormality = async (requestedFormality: FollowUpFormality) => {
    const formalityOfDisplayedDraft = draftFormality
    setFormality(requestedFormality)
    const draftOutcome = await requestDraft(requestedFormality)
    if (draftOutcome === 'failed' && formalityOfDisplayedDraft !== null) setFormality(formalityOfDisplayedDraft)
  }

  const openDialog = () => {
    isDialogSettledRef.current = false
    setIsDialogOpen(true)
    setClosedDialogAnnouncement('')
    setMarkAsSentErrorMessage(null)
    setHasServerReportedMissingApiKey(false)
    if (draft === null && !isDraftingRef.current) void requestDraft(formality)
  }

  const closeDialog = () => {
    latestDraftRequestNumberRef.current += 1
    isDraftingRef.current = false
    isDialogSettledRef.current = false
    setIsDialogOpen(false)
    setIsDrafting(false)
    setPendingReplacementFormality(null)
    setAnnouncement('')
  }

  const completeOpenChange = (isNowOpen: boolean) => {
    if (isNowOpen) {
      isDialogSettledRef.current = true
      if (isDraftingRef.current) setAnnouncement(FOLLOW_UP_MESSAGES.drafting)
      return
    }
    if (!hasPendingSentNotificationRef.current) return
    hasPendingSentNotificationRef.current = false
    onFollowUpSent()
  }

  const changeFormality = async (newFormality: FollowUpFormality) => {
    if (newFormality === formality) return
    if (hasUserEditedMessage) {
      setPendingReplacementFormality(newFormality)
      return
    }
    await draftWithFormality(newFormality)
  }

  const regenerate = async () => {
    if (isDraftingRef.current) return
    if (hasUserEditedMessage) {
      setPendingReplacementFormality(formality)
      return
    }
    await draftWithFormality(formality)
  }

  const confirmReplacement = async () => {
    if (pendingReplacementFormality === null) return
    setPendingReplacementFormality(null)
    await draftWithFormality(pendingReplacementFormality)
  }

  const cancelReplacement = () => setPendingReplacementFormality(null)

  const writeMessageToClipboard = async (successAnnouncement: string) => {
    if (isDraftingRef.current) return
    try {
      await writeClipboardText(editedMessage)
      setAnnouncement(successAnnouncement)
    } catch {
      setAnnouncement(FOLLOW_UP_MESSAGES.copyFailed)
    }
  }

  const copyMessage = () => writeMessageToClipboard(FOLLOW_UP_MESSAGES.copied)

  const copyMessageForLinkedin = () => writeMessageToClipboard(FOLLOW_UP_MESSAGES.linkedinCopied)

  const markAsSent = async () => {
    setIsMarkingAsSent(true)
    setMarkAsSentErrorMessage(null)
    const activityLogResult = await guardActionCall(() =>
      addActivityLogEntry(jobApplicationId, { kind: 'message', summary: FOLLOW_UP_MESSAGES.sentActivitySummary }),
    )
    setIsMarkingAsSent(false)
    if (!activityLogResult.ok) {
      setMarkAsSentErrorMessage(activityLogResult.errorMessage)
      return
    }
    closeDialog()
    setDraft(null)
    setDraftFormality(null)
    setEditedMessage('')
    if (shouldAnnounceSentFollowUp) setClosedDialogAnnouncement(FOLLOW_UP_MESSAGES.sentAnnouncement)
    hasPendingSentNotificationRef.current = true
  }

  const mailtoUrl =
    draft?.contactEmail ? buildFollowUpMailtoUrl(draft.contactEmail, draft.subject, editedMessage) : null

  return {
    isDialogOpen,
    openDialog,
    closeDialog,
    completeOpenChange,
    formality,
    changeFormality,
    draft,
    editedMessage,
    changeMessage: setEditedMessage,
    isDrafting,
    draftErrorMessage,
    isMissingApiKey,
    regenerate,
    isReplacementPending: pendingReplacementFormality !== null,
    confirmReplacement,
    cancelReplacement,
    announcement,
    closedDialogAnnouncement,
    copyMessage,
    copyMessageForLinkedin,
    mailtoUrl,
    markAsSent,
    isMarkingAsSent,
    markAsSentErrorMessage,
  }
}
