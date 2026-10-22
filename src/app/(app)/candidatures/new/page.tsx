import type { Metadata } from 'next'
import { toCvOptions } from '@/domain/cv-library'
import { NewJobApplicationForm } from '@/components/new-job-application-form'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { extractJobPostingForCurrentUser } from '@/server/actions/ai-actions'
import { listCvs } from '@/server/actions/cv-actions'
import { searchEntities } from '@/server/actions/entity-actions'
import { createJobApplication } from '@/server/actions/job-application-actions'
import { hasAnthropicApiKeyConfigured } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Nouvelle candidature · Aled' }

export const maxDuration = 120

const NewJobApplicationPage = async () => {
  const [hasAnthropicApiKey, cvsResult] = await Promise.all([hasAnthropicApiKeyConfigured(), listCvs()])
  const cvOptions = cvsResult.ok ? toCvOptions(cvsResult.data) : []
  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <h1 className={PAGE_TITLE_CLASS_NAME}>Nouvelle candidature</h1>
      <NewJobApplicationForm
        extractJobPosting={extractJobPostingForCurrentUser}
        createJobApplication={createJobApplication}
        searchEntities={searchEntities}
        hasAnthropicApiKey={hasAnthropicApiKey}
        cvOptions={cvOptions}
      />
    </div>
  )
}

export default NewJobApplicationPage
