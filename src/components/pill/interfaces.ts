import type { ReactNode } from 'react'

export type PillTone =
  | 'neutral'
  | 'sage'
  | 'forest-soft'
  | 'forest'
  | 'brand'
  | 'action'
  | 'peach'
  | 'peach-soft'
  | 'lilac'
  | 'lilac-soft'
  | 'clay'
  | 'counter'

export type PillProps = {
  tone: PillTone
  children: ReactNode
  className?: string
}
