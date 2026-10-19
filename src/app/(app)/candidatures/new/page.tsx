import type { Metadata } from 'next'
import { NewJobApplicationForm } from '@/components/new-job-application-form'
import { extractJobPostingForCurrentUser } from '@/server/actions/ai-actions'
import { searchEntities } from '@/server/actions/entity-actions'
import { createJobApplication } from '@/server/actions/job-application-actions'
import { hasAnthropicApiKeyConfigured } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Nouvelle candidature · Aled' }

export const maxDuration = 120

const NewJobApplicationPage = async () => {
  const hasAnthropicApiKey = await hasAnthropicApiKeyConfigured()
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nouvelle candidature</h1>
      <NewJobApplicationForm
        extractJobPosting={extractJobPostingForCurrentUser}
        createJobApplication={createJobApplication}
        searchEntities={searchEntities}
        hasAnthropicApiKey={hasAnthropicApiKey}
      />
    </div>
  )
}

export default NewJobApplicationPage
