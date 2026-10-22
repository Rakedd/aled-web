import type { DeleteCv, RenameCv, ReplaceCvFile } from '@/components/cv-library/interfaces'
import type { CvLibraryItem } from '@/domain/cv-library'

export type CvCardProps = {
  cv: CvLibraryItem
  now: Date
  replaceCvFile: ReplaceCvFile
  renameCv: RenameCv
  deleteCv: DeleteCv
}

export type CvCardControllerParameters = Omit<CvCardProps, 'now'> & {
  onDataChanged: () => void
}
