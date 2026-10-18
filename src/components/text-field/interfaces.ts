import type { ComponentProps } from 'react'
import type { Input } from '@/components/ui/input'

export type TextFieldProps = Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange'> & {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
}
