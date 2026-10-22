import type { Exchange } from '@/domain/contacts'
import type { ExchangeFormParameters } from '@/components/exchange-form/interfaces'

export type ExchangesSectionProps = {
  exchanges: Exchange[]
  showsContactName: boolean
  exchangeForm: ExchangeFormParameters | null
}
