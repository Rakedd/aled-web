import { useState } from 'react'
import { formatCvCount, isCvLibraryFull } from '@/domain/cv-library'
import type { CvLibraryControllerParameters } from './interfaces'

export const useController = ({ cvs }: CvLibraryControllerParameters) => {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)

  const openAddForm = () => setIsAddFormOpen(true)

  const closeAddForm = () => setIsAddFormOpen(false)

  return {
    isAddFormOpen,
    openAddForm,
    closeAddForm,
    isLibraryFull: isCvLibraryFull(cvs.length),
    cvCountLabel: formatCvCount(cvs.length),
  }
}
