import type { ReactNode } from 'react'

export type EditableBlockProps = {
  title: string
  view: ReactNode
  renderEdit: (close: () => void) => ReactNode
  heading?: ReactNode
}
