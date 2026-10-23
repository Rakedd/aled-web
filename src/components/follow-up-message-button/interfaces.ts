import type { RefObject } from 'react'
import type { ActionResult } from '@/domain/action-result'
import type { ActivityLogEntryInput } from '@/domain/activity-log'
import type { CallApiResult } from '@/domain/call-log'
import type { FollowUpMessageDraft, FollowUpMessageRequest } from '@/domain/follow-up-message'

export type RequestFollowUpMessageDraft = (
  followUpMessageRequest: FollowUpMessageRequest,
) => Promise<CallApiResult<FollowUpMessageDraft>>

export type AddActivityLogEntry = (
  jobApplicationId: string,
  activityLogEntryInput: ActivityLogEntryInput,
) => Promise<ActionResult<null>>

export type WriteClipboardText = (text: string) => Promise<void>

export type DraftRequestOutcome = 'drafted' | 'failed' | 'superseded'

export type FollowUpMessageButtonControllerParameters = {
  jobApplicationId: string
  hasAnthropicApiKey: boolean
  requestFollowUpMessageDraft: RequestFollowUpMessageDraft
  addActivityLogEntry: AddActivityLogEntry
  writeClipboardText: WriteClipboardText
  onFollowUpSent: () => void
  shouldAnnounceSentFollowUp: boolean
}

export type FollowUpMessageButtonLabel = { variant: 'full' } | { variant: 'compact'; jobApplicationTitle: string }

export type FollowUpMessageButtonProps = Pick<
  FollowUpMessageButtonControllerParameters,
  'jobApplicationId' | 'hasAnthropicApiKey' | 'addActivityLogEntry'
> & {
  label?: FollowUpMessageButtonLabel
  onFollowUpSent?: () => void
  finalFocusRef?: RefObject<HTMLElement | null>
}
