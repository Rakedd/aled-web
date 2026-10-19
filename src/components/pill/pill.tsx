import { cn } from '@/lib/utils'
import type { PillProps, PillTone } from './interfaces'

export const PILL_TONE_CLASS_NAMES: Record<PillTone, string> = {
  neutral: 'border border-hairline bg-background text-ink',
  sage: 'bg-hairline text-ink',
  'forest-soft': 'bg-hairline text-forest',
  forest: 'bg-forest text-primary-foreground',
  peach: 'bg-peach text-ink',
  'peach-soft': 'bg-peach-tint text-peach-ink',
  lilac: 'bg-lilac text-ink',
  'lilac-soft': 'bg-lilac-tint text-ink',
  clay: 'bg-clay-soft text-clay',
  ink: 'bg-ink text-primary-foreground',
}

export const PILL_BASE_CLASS_NAME = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap'

export const Pill = ({ tone, children, className }: PillProps) => (
  <span data-tone={tone} className={cn(PILL_BASE_CLASS_NAME, PILL_TONE_CLASS_NAMES[tone], className)}>
    {children}
  </span>
)
