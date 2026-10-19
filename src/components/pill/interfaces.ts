import type { ReactNode } from 'react'

export type PillTone =
  | 'neutral'
  | 'sage'
  | 'forest-soft'
  | 'forest'
  | 'peach'
  | 'peach-soft'
  | 'lilac'
  | 'lilac-soft'
  | 'clay'
  | 'ink'

export type PillProps = {
  tone: PillTone
  children: ReactNode
  className?: string
}
