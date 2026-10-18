import type { ReactNode } from 'react'

export type FormFieldProps = {
  htmlFor: string
  label: string
  hint?: string
  children: ReactNode
}
