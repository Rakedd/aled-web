'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useController } from './controller'
import type { DeleteJobApplicationButtonProps } from './interfaces'

export const DeleteJobApplicationButton = (controllerParameters: DeleteJobApplicationButtonProps) => {
  const router = useRouter()
  const {
    isConfirmationOpen,
    openConfirmation,
    closeConfirmation,
    confirmDeletion,
    isDeleting,
    confirmLabel,
    errorMessage,
  } = useController({ ...controllerParameters, navigate: (route) => router.replace(route) })

  return (
    <div className="flex border-t pt-6">
      <Button type="button" variant="destructive" onClick={openConfirmation}>
        Supprimer la candidature
      </Button>
      <AlertDialog.Root
        open={isConfirmationOpen}
        onOpenChange={(isDialogOpen) => {
          if (!isDialogOpen) closeConfirmation()
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
          <AlertDialog.Popup
            className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-xl border bg-background p-6 shadow-xl outline-none"
          >
            <AlertDialog.Title className="text-lg font-semibold">
              Supprimer définitivement cette candidature ?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              Son journal, ses entretiens et sa fiche métier seront supprimés.
            </AlertDialog.Description>
            {errorMessage && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeConfirmation} disabled={isDeleting}>
                Annuler
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmDeletion()} disabled={isDeleting}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
