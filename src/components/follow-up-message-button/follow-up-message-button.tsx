'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRouter } from 'next/navigation'
import { type MouseEvent, useEffect, useId, useRef } from 'react'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FOLLOW_UP_FORMALITIES,
  FOLLOW_UP_MESSAGES,
  formatCompactFollowUpButtonAccessibleLabel,
} from '@/domain/follow-up-message'
import { TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { requestFollowUpMessageDraft } from '@/lib/follow-up-message/request-follow-up-message-draft'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { FollowUpMessageButtonLabel, FollowUpMessageButtonProps, WriteClipboardText } from './interfaces'

const writeClipboardText: WriteClipboardText = (text) => navigator.clipboard.writeText(text)

const FULL_LABEL: FollowUpMessageButtonLabel = { variant: 'full' }

const DISABLED_WHILE_DRAFTING_CLASS_NAME = 'aria-disabled:opacity-50'

const DIALOG_ACTION_LINK_CLASS_NAME = cn(
  buttonVariants({ variant: 'outline', size: 'lg' }),
  DISABLED_WHILE_DRAFTING_CLASS_NAME,
)

export const FollowUpMessageButton = ({
  jobApplicationId,
  hasAnthropicApiKey,
  addActivityLogEntry,
  label = FULL_LABEL,
  onFollowUpSent,
  finalFocusRef,
}: FollowUpMessageButtonProps) => {
  const router = useRouter()
  const openingButtonRef = useRef<HTMLButtonElement | null>(null)
  const messageFieldRef = useRef<HTMLTextAreaElement | null>(null)
  const replaceButtonRef = useRef<HTMLButtonElement | null>(null)
  const subjectFieldId = useId()
  const messageFieldId = useId()
  const {
    isDialogOpen,
    openDialog,
    closeDialog,
    completeOpenChange,
    formality,
    changeFormality,
    draft,
    editedMessage,
    changeMessage,
    isDrafting,
    draftErrorMessage,
    isMissingApiKey,
    regenerate,
    isReplacementPending,
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
  } = useController({
    jobApplicationId,
    hasAnthropicApiKey,
    requestFollowUpMessageDraft,
    addActivityLogEntry,
    writeClipboardText,
    onFollowUpSent: onFollowUpSent ?? router.refresh,
    shouldAnnounceSentFollowUp: onFollowUpSent === undefined,
  })
  const isCompact = label.variant === 'compact'

  useEffect(() => {
    if (isReplacementPending) replaceButtonRef.current?.focus()
  }, [isReplacementPending])

  const answerReplacementAndFocusMessage = (isReplacementConfirmed: boolean) => {
    if (isReplacementConfirmed) void confirmReplacement()
    else cancelReplacement()
    messageFieldRef.current?.focus()
  }

  const blockLinkWhileDrafting = (clickEvent: MouseEvent<HTMLAnchorElement>) => {
    if (isDrafting) clickEvent.preventDefault()
  }

  return (
    <>
      <Button
        ref={openingButtonRef}
        type="button"
        variant="outline"
        size={isCompact ? 'sm' : 'default'}
        className={isCompact ? undefined : 'font-bold'}
        aria-label={label.variant === 'compact' ? formatCompactFollowUpButtonAccessibleLabel(label.jobApplicationTitle) : undefined}
        onClick={openDialog}
      >
        {isCompact ? FOLLOW_UP_MESSAGES.compactOpenButton : FOLLOW_UP_MESSAGES.openButton}
      </Button>
      <p role="status" className="sr-only">
        {closedDialogAnnouncement}
      </p>
      <Dialog.Root
        open={isDialogOpen}
        onOpenChange={(isDialogNowOpen) => {
          if (!isDialogNowOpen) closeDialog()
        }}
        onOpenChangeComplete={completeOpenChange}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Popup
            finalFocus={finalFocusRef ?? openingButtonRef}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">{FOLLOW_UP_MESSAGES.dialogTitle}</Dialog.Title>
            <p role="status" className="sr-only">
              {announcement}
            </p>
            {isMissingApiKey ? (
              <MissingAnthropicApiKeyNotice featureDescription={FOLLOW_UP_MESSAGES.missingApiKeyFeature} />
            ) : (
              <div aria-busy={isDrafting} className="flex flex-col gap-4">
                <div role="group" aria-label={FOLLOW_UP_MESSAGES.formalityLegend} className="flex gap-2">
                  {FOLLOW_UP_FORMALITIES.map((formalityOption) => (
                    <Button
                      key={formalityOption}
                      type="button"
                      size="lg"
                      variant={formality === formalityOption ? 'default' : 'outline'}
                      aria-pressed={formality === formalityOption}
                      onClick={() => void changeFormality(formalityOption)}
                    >
                      {FOLLOW_UP_MESSAGES.formalityLabels[formalityOption]}
                    </Button>
                  ))}
                </div>
                {isDrafting && <p className="text-sm text-ink-secondary">{FOLLOW_UP_MESSAGES.drafting}</p>}
                {draftErrorMessage !== null && (
                  <div className="flex flex-col items-start gap-2">
                    <p role="alert" className="text-sm text-destructive">
                      {draftErrorMessage}
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      aria-disabled={isDrafting}
                      className={DISABLED_WHILE_DRAFTING_CLASS_NAME}
                      onClick={() => void regenerate()}
                    >
                      {FOLLOW_UP_MESSAGES.retry}
                    </Button>
                  </div>
                )}
                {draft !== null && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={subjectFieldId}>{FOLLOW_UP_MESSAGES.subjectLabel}</Label>
                      <Input id={subjectFieldId} readOnly value={draft.subject} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={messageFieldId}>{FOLLOW_UP_MESSAGES.messageLabel}</Label>
                      <textarea
                        ref={messageFieldRef}
                        id={messageFieldId}
                        rows={8}
                        readOnly={isDrafting}
                        className={cn(TEXTAREA_CLASS_NAME, 'min-h-40 w-full resize-y read-only:opacity-60')}
                        value={editedMessage}
                        onChange={(changeEvent) => changeMessage(changeEvent.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        aria-disabled={isDrafting}
                        className={DISABLED_WHILE_DRAFTING_CLASS_NAME}
                        onClick={() => void copyMessage()}
                      >
                        {FOLLOW_UP_MESSAGES.copy}
                      </Button>
                      {mailtoUrl !== null && (
                        <a
                          href={mailtoUrl}
                          aria-disabled={isDrafting}
                          className={DIALOG_ACTION_LINK_CLASS_NAME}
                          onClick={blockLinkWhileDrafting}
                        >
                          {FOLLOW_UP_MESSAGES.sendByEmail}
                        </a>
                      )}
                      {draft.contactLinkedinUrl !== null && (
                        <a
                          href={draft.contactLinkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-disabled={isDrafting}
                          className={DIALOG_ACTION_LINK_CLASS_NAME}
                          onClick={(clickEvent) => {
                            blockLinkWhileDrafting(clickEvent)
                            void copyMessageForLinkedin()
                          }}
                        >
                          {FOLLOW_UP_MESSAGES.openLinkedin}
                          <span className="sr-only">{FOLLOW_UP_MESSAGES.newTabHint}</span>
                        </a>
                      )}
                      <Button
                        type="button"
                        size="lg"
                        variant="ghost"
                        aria-disabled={isDrafting}
                        className={DISABLED_WHILE_DRAFTING_CLASS_NAME}
                        onClick={() => void regenerate()}
                      >
                        {FOLLOW_UP_MESSAGES.regenerate}
                      </Button>
                    </div>
                    {isReplacementPending && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3">
                        <p className="text-sm font-semibold">{FOLLOW_UP_MESSAGES.replaceEditedMessageQuestion}</p>
                        <Button
                          ref={replaceButtonRef}
                          type="button"
                          size="lg"
                          onClick={() => answerReplacementAndFocusMessage(true)}
                        >
                          {FOLLOW_UP_MESSAGES.confirmReplace}
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          onClick={() => answerReplacementAndFocusMessage(false)}
                        >
                          {FOLLOW_UP_MESSAGES.cancelReplace}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {markAsSentErrorMessage !== null && (
              <p role="alert" className="text-sm text-destructive">
                {markAsSentErrorMessage}
              </p>
            )}
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-4">
              <Dialog.Close className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
                {FOLLOW_UP_MESSAGES.close}
              </Dialog.Close>
              <Button type="button" size="lg" disabled={isMarkingAsSent} onClick={() => void markAsSent()}>
                {isMarkingAsSent ? FOLLOW_UP_MESSAGES.markingAsSent : FOLLOW_UP_MESSAGES.markAsSent}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
