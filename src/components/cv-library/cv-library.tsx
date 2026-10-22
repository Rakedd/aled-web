'use client'

import { useRouter } from 'next/navigation'
import { AddCvForm } from '@/components/add-cv-form'
import { CvCard } from '@/components/cv-card'
import { Button } from '@/components/ui/button'
import { CV_MESSAGES } from '@/domain/cv-library'
import { useController } from './controller'
import type { CvLibraryProps } from './interfaces'

export const CvLibrary = ({ cvs, now, createCv, replaceCvFile, renameCv, deleteCv }: CvLibraryProps) => {
  const router = useRouter()
  const { isAddFormOpen, openAddForm, closeAddForm, isLibraryFull, cvCountLabel } = useController({ cvs })

  const handleCreated = () => {
    closeAddForm()
    router.refresh()
  }

  return (
    <section aria-label="Bibliothèque de CV" className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{cvCountLabel}</p>
        <Button type="button" onClick={openAddForm} disabled={isLibraryFull || isAddFormOpen}>
          Ajouter un CV
        </Button>
        {isLibraryFull && <p className="text-sm text-muted-foreground">{CV_MESSAGES.libraryFull}</p>}
      </div>
      {isAddFormOpen && <AddCvForm createCv={createCv} onCreated={handleCreated} onCancel={closeAddForm} />}
      {cvs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ajoute tes CV ici pour retrouver lequel tu as envoyé à chaque candidature.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {cvs.map((cv) => (
            <li key={cv.id}>
              <CvCard cv={cv} now={now} replaceCvFile={replaceCvFile} renameCv={renameCv} deleteCv={deleteCv} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
