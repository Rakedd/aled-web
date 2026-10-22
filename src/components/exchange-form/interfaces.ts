import type { ActionResult } from '@/domain/action-result'
import type { ContactExchangeInput } from '@/domain/contacts'

export type AddContactExchange = (contactId: string, input: ContactExchangeInput) => Promise<ActionResult<null>>

export type ExchangeFormParameters = {
  contactId: string
  jobApplicationOptions: { id: string; title: string }[]
  addContactExchange: AddContactExchange
  now: Date
}

export type ExchangeFormControllerParameters = Pick<
  ExchangeFormParameters,
  'contactId' | 'addContactExchange' | 'now'
> & {
  onDataChanged: () => void
}
