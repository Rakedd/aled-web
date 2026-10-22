import type { ActionResult } from '@/domain/action-result'
import type { CvLibraryItem } from '@/domain/cv-library'

export type CreateCv = (formData: FormData) => Promise<ActionResult<{ id: string }>>

export type ReplaceCvFile = (cvId: string, formData: FormData) => Promise<ActionResult<null>>

export type RenameCv = (cvId: string, label: string) => Promise<ActionResult<null>>

export type DeleteCv = (cvId: string) => Promise<ActionResult<null>>

export type CvLibraryProps = {
  cvs: CvLibraryItem[]
  now: Date
  createCv: CreateCv
  replaceCvFile: ReplaceCvFile
  renameCv: RenameCv
  deleteCv: DeleteCv
}

export type CvLibraryControllerParameters = Pick<CvLibraryProps, 'cvs'>
