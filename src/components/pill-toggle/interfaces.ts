import type { ReactNode } from 'react'
import type { PillTone } from '@/components/pill/interfaces'

export type PillToggleProps = {
  isPressed: boolean
  onPressedChange: (isPressed: boolean) => void
  children: ReactNode
  tone?: PillTone
  disabled?: boolean
}
