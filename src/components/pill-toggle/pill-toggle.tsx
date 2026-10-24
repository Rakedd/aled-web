import { PILL_BASE_CLASS_NAME, PILL_TONE_CLASS_NAMES } from '@/components/pill'
import { cn } from '@/lib/utils'
import type { PillToggleProps } from './interfaces'

export const PILL_TOGGLE_SIZE_CLASS_NAME = 'h-11 px-4 py-0 text-sm sm:h-9'

export const PillToggle = ({ isPressed, onPressedChange, children, tone = 'neutral', disabled = false }: PillToggleProps) => {
  const currentTone = isPressed ? 'action' : tone

  return (
    <button
      type="button"
      aria-pressed={isPressed}
      data-tone={currentTone}
      disabled={disabled}
      onClick={() => onPressedChange(!isPressed)}
      className={cn(
        PILL_BASE_CLASS_NAME,
        PILL_TONE_CLASS_NAMES[currentTone],
        PILL_TOGGLE_SIZE_CLASS_NAME,
        'cursor-pointer outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
      )}
    >
      {children}
    </button>
  )
}
