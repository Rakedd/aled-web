import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivityLog } from '@/components/activity-log'
import { DeleteJobApplicationButton } from '@/components/delete-job-application-button'
import { InterviewPreparationButton } from '@/components/interview-preparation-button'
import { InterviewsSection } from '@/components/interviews-section'
import { ContactView } from '@/components/contact-view'
import { JobApplicationBlock } from '@/components/job-application-block'
import { JobApplicationHeader } from '@/components/job-application-header'
import { JobApplicationSummary } from '@/components/job-application-summary'
import { JobSpecSection } from '@/components/job-spec-section'
import { MissionDetailsView } from '@/components/mission-details-view'
import { StackView } from '@/components/stack-view'
import type { ActionResult } from '@/domain/action-result'
import type { ContactDetails } from '@/domain/entities'
import type { InterviewPreparation } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE, type JobApplicationOverview } from '@/domain/job-application'
import { updateEndClientNotes } from '@/server/actions/client-brief-actions'
import {
  getContactDetails,
  searchEntities,
  setEndClientParent,
  updateContactDetails,
  updateIntermediaryKind,
} from '@/server/actions/entity-actions'
import {
  createInterview,
  deleteInterview,
  listInterviewsForJobApplication,
  updateInterview,
} from '@/server/actions/interview-actions'
import { generateInterviewPreparation, getInterviewPreparation } from '@/server/actions/interview-preparation-actions'
import {
  addActivityLogEntry,
  changeJobApplicationStatus,
  deleteJobApplication,
  getJobApplication,
  listActivityLogEntries,
  updateJobApplication,
} from '@/server/actions/job-application-actions'
import {
  confirmJobSpecStack,
  discardPendingJobSpecStack,
  getJobSpec,
  saveJobSpecText,
  uploadJobSpecPdf,
} from '@/server/actions/job-spec-actions'
import { hasAnthropicApiKeyConfigured } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Candidature · Freeclutch' }

export const maxDuration = 300

const DEFAULT_BRIEF_LANGUAGE = 'fr'

const loadInitialInterviewPreparation = async (jobApplicationId: string): Promise<ActionResult<InterviewPreparation>> => {
  const defaultLanguagePreparationResult = await getInterviewPreparation(jobApplicationId, DEFAULT_BRIEF_LANGUAGE)
  if (!defaultLanguagePreparationResult.ok) return defaultLanguagePreparationResult
  const { lastUsedLanguage } = defaultLanguagePreparationResult.data
  if (lastUsedLanguage === null || lastUsedLanguage === DEFAULT_BRIEF_LANGUAGE) return defaultLanguagePreparationResult
  return getInterviewPreparation(jobApplicationId, lastUsedLanguage)
}

type JobApplicationWithContactDetails = {
  jobApplicationResult: ActionResult<JobApplicationOverview>
  contactDetailsResult: ActionResult<ContactDetails> | null
}

const loadJobApplicationWithContactDetails = async (
  jobApplicationId: string,
): Promise<JobApplicationWithContactDetails> => {
  const jobApplicationResult = await getJobApplication(jobApplicationId)
  if (!jobApplicationResult.ok || jobApplicationResult.data.contactId === null) {
    return { jobApplicationResult, contactDetailsResult: null }
  }
  return { jobApplicationResult, contactDetailsResult: await getContactDetails(jobApplicationResult.data.contactId) }
}

const JobApplicationDetailPage = async ({ params }: { params: Promise<{ jobApplicationId: string }> }) => {
  const { jobApplicationId } = await params
  const [
    { jobApplicationResult, contactDetailsResult },
    activityLogEntriesResult,
    jobSpecResult,
    interviewsResult,
    interviewPreparationResult,
    hasAnthropicApiKey,
  ] = await Promise.all([
    loadJobApplicationWithContactDetails(jobApplicationId),
    listActivityLogEntries(jobApplicationId),
    getJobSpec(jobApplicationId),
    listInterviewsForJobApplication(jobApplicationId),
    loadInitialInterviewPreparation(jobApplicationId),
    hasAnthropicApiKeyConfigured(),
  ])

  if (!jobApplicationResult.ok) {
    if (jobApplicationResult.errorMessage === JOB_APPLICATION_NOT_FOUND_MESSAGE) notFound()
    return (
      <p role="alert" className="text-sm text-destructive">
        {jobApplicationResult.errorMessage}
      </p>
    )
  }

  if (!activityLogEntriesResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {activityLogEntriesResult.errorMessage}
      </p>
    )
  }

  if (!jobSpecResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {jobSpecResult.errorMessage}
      </p>
    )
  }

  if (!interviewsResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {interviewsResult.errorMessage}
      </p>
    )
  }

  const jobApplication = jobApplicationResult.data
  const now = new Date()

  if (!interviewPreparationResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {interviewPreparationResult.errorMessage}
      </p>
    )
  }

  const contactDetails = contactDetailsResult?.ok ? contactDetailsResult.data : null
  const contactDetailsErrorMessage =
    contactDetailsResult !== null && !contactDetailsResult.ok ? contactDetailsResult.errorMessage : null

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <JobApplicationBlock
          title="En-tête"
          isTitleHidden
          view={<JobApplicationSummary jobApplication={jobApplication} interviews={interviewsResult.data} now={now} />}
          form={{
            kind: 'header',
            props: { jobApplication, updateJobApplication, setEndClientParent, updateIntermediaryKind, searchEntities },
          }}
        />
        <JobApplicationHeader jobApplication={jobApplication} changeJobApplicationStatus={changeJobApplicationStatus} />
      </div>
      <JobApplicationBlock
        title="Stack"
        view={<StackView stack={jobApplication.stack} />}
        form={{ kind: 'stack', props: { jobApplication, updateJobApplication } }}
      />
      <InterviewPreparationButton
        key={`${jobApplication.id}-${jobApplication.endClientId ?? 'unknown-end-client'}`}
        jobApplicationId={jobApplication.id}
        initialPreparation={interviewPreparationResult.data}
        getInterviewPreparation={getInterviewPreparation}
        generateInterviewPreparation={generateInterviewPreparation}
        updateEndClientNotes={updateEndClientNotes}
        hasAnthropicApiKey={hasAnthropicApiKey}
      />
      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        <JobSpecSection
          key={jobApplication.id}
          jobApplicationId={jobApplication.id}
          jobSpec={jobSpecResult.data}
          uploadJobSpecPdf={uploadJobSpecPdf}
          saveJobSpecText={saveJobSpecText}
          confirmJobSpecStack={confirmJobSpecStack}
          discardPendingJobSpecStack={discardPendingJobSpecStack}
          hasAnthropicApiKey={hasAnthropicApiKey}
        />
        <div className="flex min-w-0 flex-col gap-8">
          <JobApplicationBlock
            title="Infos mission"
            view={<MissionDetailsView jobApplication={jobApplication} />}
            form={{ kind: 'missionDetails', props: { jobApplication, updateJobApplication } }}
          />
          <JobApplicationBlock
            title="Contact"
            view={
              <ContactView
                contactName={jobApplication.contactName}
                contactDetails={contactDetails}
                loadErrorMessage={contactDetailsErrorMessage}
              />
            }
            form={{
              kind: 'contact',
              props: { jobApplication, contactDetails, updateJobApplication, updateContactDetails, searchEntities },
            }}
          />
        </div>
      </div>
      <InterviewsSection
        key={jobApplication.id}
        jobApplicationId={jobApplication.id}
        initialInterviews={interviewsResult.data}
        createInterview={createInterview}
        updateInterview={updateInterview}
        deleteInterview={deleteInterview}
        listInterviewsForJobApplication={listInterviewsForJobApplication}
      />
      <ActivityLog
        jobApplicationId={jobApplication.id}
        initialEntries={activityLogEntriesResult.data}
        addActivityLogEntry={addActivityLogEntry}
        listActivityLogEntries={listActivityLogEntries}
        now={now}
      />
      <DeleteJobApplicationButton jobApplicationId={jobApplication.id} deleteJobApplication={deleteJobApplication} />
    </div>
  )
}

export default JobApplicationDetailPage
