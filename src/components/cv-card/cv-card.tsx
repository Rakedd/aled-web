'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useRouter } from 'next/navigation'
import { type FormEvent, useRef } from 'react'
import { Pill } from '@/components/pill'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildCvVersionPdfPath,
  CV_PDF_MIME_TYPE,
  formatCvSentCount,
  isCvDueForReview,
  MAXIMUM_CV_LABEL_LENGTH,
} from '@/domain/cv-library'
import { formatParisDate } from '@/domain/paris-time'
import { useController } from './controller'
import type { CvCardProps } from './interfaces'

export const CvCard = ({ cv, now, replaceCvFile, renameCv, deleteCv }: CvCardProps) => {
  const router = useRouter()
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const {
    isRenaming,
    startRenaming,
    cancelRenaming,
    draftLabel,
    setDraftLabel,
    saveLabel,
    replaceWithFile,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    confirmDeletion,
    isPending,
    errorMessage,
  } = useController({ cv, replaceCvFile, renameCv, deleteCv, onDataChanged: router.refresh })

  const reviewDates = { reviewedAt: cv.reviewedAt, currentVersionUploadedAt: cv.currentVersion?.uploadedAt ?? null }

  const handleRenameSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void saveLabel()
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {isRenaming ? (
          <form noValidate onSubmit={handleRenameSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Input
              aria-label="Nom du CV"
              value={draftLabel}
              maxLength={MAXIMUM_CV_LABEL_LENGTH}
              disabled={isPending}
              onChange={(changeEvent) => setDraftLabel(changeEvent.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              Enregistrer
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelRenaming} disabled={isPending}>
              Annuler
            </Button>
          </form>
        ) : (
          <h2 className="font-heading text-lg font-extrabold break-words">{cv.label}</h2>
        )}
        {isCvDueForReview(reviewDates, now) && <Pill tone="peach-soft">À revoir</Pill>}
      </div>
      <p className="text-sm text-muted-foreground">
        Mis à jour le {formatParisDate(cv.currentVersion?.uploadedAt ?? cv.reviewedAt)} · {formatCvSentCount(cv.sentCount)}
      </p>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {cv.currentVersion && (
          <a
            href={buildCvVersionPdfPath(cv.currentVersion.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Voir
          </a>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => replaceInputRef.current?.click()}
        >
          Remplacer
        </Button>
        <input
          ref={replaceInputRef}
          type="file"
          accept={CV_PDF_MIME_TYPE}
          aria-label={`Remplacer le PDF de ${cv.label}`}
          className="hidden"
          onChange={(changeEvent) => {
            void replaceWithFile(changeEvent.target.files?.[0] ?? null)
            changeEvent.target.value = ''
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={isPending || isRenaming} onClick={startRenaming}>
          Renommer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          Supprimer
        </Button>
      </div>
      {cv.previousSentVersions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">Anciennes versions envoyées</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {cv.previousSentVersions.map((previousVersion) => (
              <li key={previousVersion.id} className="flex flex-wrap items-center gap-2">
                <span>Version du {formatParisDate(previousVersion.uploadedAt)}</span>
                <a
                  href={buildCvVersionPdfPath(previousVersion.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Voir
                </a>
                <span className="text-muted-foreground">{formatCvSentCount(previousVersion.sentCount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <AlertDialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-card p-6 shadow-xl outline-none">
            <AlertDialog.Title className="text-lg font-semibold">Supprimer {cv.label} ?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              Les candidatures auxquelles tu as envoyé ce CV le garderont.
            </AlertDialog.Description>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmDeletion()} disabled={isPending}>
                {isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </article>
  )
}
