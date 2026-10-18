import Link from 'next/link'
import { PREFERENCES_ROUTE } from '@/domain/routes'
import type { MissingAnthropicApiKeyNoticeProps } from './interfaces'

export const MissingAnthropicApiKeyNotice = ({ featureDescription }: MissingAnthropicApiKeyNoticeProps) => (
  <p role="note" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
    Ajoute ta clé Claude dans tes{' '}
    <Link href={PREFERENCES_ROUTE} className="text-primary underline underline-offset-2">
      préférences
    </Link>{' '}
    pour activer {featureDescription}.
  </p>
)
