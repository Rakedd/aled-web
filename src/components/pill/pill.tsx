import { cn } from '@/lib/utils'
import type { PillProps, PillTone } from './interfaces'

export const PILL_TONE_CLASS_NAMES: Record<PillTone, string> = {
  neutral: 'border border-hairline bg-background text-ink',
  sage: 'bg-hairline text-ink',
  'forest-soft': 'bg-forest-soft text-on-forest-soft',
  brand: 'bg-brand-tile text-on-brand-tile',
  action: 'bg-primary text-primary-foreground',
  peach: 'bg-peach text-on-peach',
  'peach-soft': 'bg-peach-soft text-peach-ink',
  lilac: 'bg-lilac text-on-lilac',
  'lilac-soft': 'bg-lilac-soft text-on-lilac-soft',
  clay: 'bg-clay-soft text-clay',
  counter: 'bg-menu-counter text-on-menu-counter',
}

export const PILL_BASE_CLASS_NAME = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap'

export const Pill = ({ tone, children, className }: PillProps) => (
  <span data-tone={tone} className={cn(PILL_BASE_CLASS_NAME, PILL_TONE_CLASS_NAMES[tone], className)}>
    {children}
  </span>
)
