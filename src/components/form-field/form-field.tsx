import { Label } from '@/components/ui/label'
import type { FormFieldProps } from './interfaces'

export const FormField = ({ htmlFor, label, hint, children }: FormFieldProps) => (
  <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
)
