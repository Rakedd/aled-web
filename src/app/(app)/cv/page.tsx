import type { Metadata } from 'next'
import { CvLibrary } from '@/components/cv-library'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { createCv, deleteCv, listCvs, renameCv, replaceCvFile } from '@/server/actions/cv-actions'

export const metadata: Metadata = { title: 'Mes CV · Aled' }

const CvLibraryPage = async () => {
  const cvsResult = await listCvs()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className={PAGE_TITLE_CLASS_NAME}>Mes CV</h1>
      {cvsResult.ok ? (
        <CvLibrary
          cvs={cvsResult.data}
          now={new Date()}
          createCv={createCv}
          replaceCvFile={replaceCvFile}
          renameCv={renameCv}
          deleteCv={deleteCv}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {cvsResult.errorMessage}
        </p>
      )}
    </div>
  )
}

export default CvLibraryPage
