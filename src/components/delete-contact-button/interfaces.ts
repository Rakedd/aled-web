import type { ActionResult } from '@/domain/action-result'

export type DeleteContact = (contactId: string) => Promise<ActionResult<null>>

export type DeleteContactButtonControllerParameters = {
  contactId: string
  deleteContact: DeleteContact
  navigate: (route: string) => void
}

export type DeleteContactButtonProps = Omit<DeleteContactButtonControllerParameters, 'navigate'>
