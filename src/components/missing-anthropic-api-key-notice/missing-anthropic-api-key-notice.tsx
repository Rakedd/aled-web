import Link from 'next/link'
import type { MissingAnthropicApiKeyNoticeProps } from './interfaces'

export const MissingAnthropicApiKeyNotice = ({ featureDescription }: MissingAnthropicApiKeyNoticeProps) => (
  <p role="note" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
    Ajoute ta clé Claude dans les{' '}
    <Link href="/settings" className="text-primary underline underline-offset-2">
      réglages
    </Link>{' '}
    pour activer {featureDescription}.
  </p>
)
