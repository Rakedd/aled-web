import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import type { TextFieldProps } from './interfaces'

export const TextField = ({ id, label, value, onValueChange, ...inputProps }: TextFieldProps) => (
  <FormField htmlFor={id} label={label}>
    <Input id={id} value={value} onChange={(changeEvent) => onValueChange(changeEvent.target.value)} {...inputProps} />
  </FormField>
)
