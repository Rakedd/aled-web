import { Button } from '@/components/ui/button'
import type { BlockFormActionsProps } from './interfaces'

export const BlockFormActions = ({ isSaving, errorMessage, onCancel }: BlockFormActionsProps) => (
  <div className="flex flex-col gap-3">
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
  </div>
)
