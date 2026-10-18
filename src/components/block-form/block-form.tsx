import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { BlockFormProps } from './interfaces'

export const BlockForm = ({ isSaving, errorMessage, onSave, onCancel, children }: BlockFormProps) => {
  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void onSave()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {children}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
